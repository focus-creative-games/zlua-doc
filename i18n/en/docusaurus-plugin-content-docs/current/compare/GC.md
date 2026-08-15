---
sidebar_position: 3
title: "GC differences"
---

# GC differences — theoretical comparison

> **Nature:** theory, not a benchmark.
> **ZLua details:** follow [spec/10-LIFETIME.md](/docs/spec/10-LIFETIME/), [spec/marshal/](/docs/spec/marshal/).

---

## 1. Analysis axes

| Axis | Question |
|----|------|
| Hot-path allocation | Does every Lua↔C# call force `object[]`, boxing, new `string`? |
| userdata vs managed objects | One-to-one? Weak tables? registry slots? |
| struct | Copy / pooling / Opaque temporary handles |
| Strings | Does Push/Pop allocate a new managed `string` every time? |
| Delegate / closures | Bridge object lifetime and refs |
| Peak vs steady state | First Bind / first delegate vs hot loop |

---

## 2. Four-way hot-path allocation profiles (typical)

### 2.1 xLua

| Path | Typical allocation |
|------|----------|
| Lua→C# simple method | Generated Wrap **usually no** `object[]`; cleaner with value-type args |
| Lua→C# overload / reflection fallback | May `object[]`, `params` boxing |
| C#→Lua | `LuaFunction.Call` etc. may allocate; many LuaDLL calls |
| userdata ↔ object | **ObjectTranslator** pool + weak refs; Pushing new objects may allocate wrapper info |
| string | Lua string ↔ UTF-16 **usually allocates** a new `string` |
| struct | Often **boxing** or table staging (depends on Wrap) |
| Delegate | DelegateBridge + translator entries; first bind allocates |

**“Zero GC”:** neither official nor community **promises** hot-path zero GC; blittable hot loops can approach zero alloc; string/object always allocate.

### 2.2 toLua / tolua#

| Path | Typical allocation |
|------|----------|
| Wrap calls | Similar to xLua; earlier versions rougher on hot paths |
| Out / ref | Often tables or multi-return; may temp tables |
| string / object | Same order of magnitude as xLua |
| struct | Depends on export strategy; boxing common |

**“Zero GC”:** **not** a general promise.

### 2.3 SLua

| Path | Typical allocation |
|------|----------|
| Auto-bind | Similar to toLua |
| Value-type opts | Some versions optimize structs; still export-dependent |
| Delegate | LuaFunction conversion often allocates |

**“Zero GC”:** **not** general; needs per-API profiling.

### 2.4 ZLua (Il2Cpp Player design goals)

| Path | Typical allocation |
|------|----------|
| Lua→C# blittable methods | C++ bridge reads stack → `methodPointer`; **target zero GC** |
| Lua→C# string / class | `string` alloc; class **ObjectRegistry** Push (slots + weak cache) |
| C#→Lua `GetFunction` blittable | Delegate bridge PushDefault*; **target zero GC** |
| C#→Lua `ref`/`out` | **OpaqueValue** (lightuserdata, no managed boxing) |
| struct ByVal | **payload copy** inside userdata; non-blittable may have boxed companion |
| Delegate | closed delegate + funcRef; first bind allocates; steady state **TBD** |
| Mono Editor Emit | Designed for **no** hot-path `object[]` + `Method.Invoke`; semantics match Player |

---

## 3. ZLua core mechanisms

### 3.1 ObjectRegistry (ByObj)

Manages ByObj userdata for **class / string / array / delegate / boxed enum**, etc.:

```text
Push → allocate slotIndex → _registeredObjects[] + GC root (Il2Cpp)
     → weak-value cache (obj, viewKlass) → avoid duplicate Push
__gc → UnregisterObject → drop root
```

| Item | GC meaning |
|----|---------|
| slot + root | While Lua holds userdata, **prevent** Il2Cpp from collecting that object |
| Weak cache | Hit → no new Push; miss → one Push cost |
| Pop | No alloc; slot lookup only |

See [spec/10-LIFETIME.md](/docs/spec/10-LIFETIME/) §2.

### 3.2 ByVal struct

| Shape | Allocation |
|------|------|
| ByVal userdata | payload **copied** inside userdata; `__gc` frees native copy |
| non-blittable ByVal | May **boxed companion** + `NotBlittableStructRegistry` scan |
| `zlua.box` → ByObj | boxing to ByObj via ObjectRegistry |

**Lua→C# struct args:** default ByVal copy; **not** boxing every time (unless ByObj path).

### 3.3 OpaqueValue (C#→Lua)

| Item | Notes |
|----|------|
| Shape | lightuserdata handle pointing at C# ref slot |
| Lifetime | **Only** that C#→Lua call frame; save across pcall → error |
| GC | Handle itself does **not** bump managed object counts; pointed ref slot valid during invoke |

Used as the default path for **GetFunction delegates** / delegate bridge `ref`/`out`/`in` (see [spec/marshal/04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/)).

### 3.4 Indexer & allocation

| Mode | Allocation impact |
|------|----------|
| Il2Cpp `Dispatch*` indexer | C++ path; **no** extra alloc because of indexer |
| Mono three-table Lua indexer | Pure Lua table lookup; miss → **error**, **no** temps |

---

## 4. Boundaries of “zero GC” claims

Here “zero GC” means **steady-state hot loop, GC Alloc ≈ 0** (Unity Profiler / dotMemory sense), **not** absolute absence of native malloc.

### 4.1 ZLua paths that can approach zero GC (Il2Cpp Player)

| Condition | Example |
|------|------|
| Fully blittable signature | `void Tick(float)`, `int Add(int,int)` |
| Lua→C# with no new string / class | numbers + existing userdata only |
| C#→Lua blittable returns | `int`, `float`, no `string` |
| Already Bound; no first EnsureBinding | Inside hot loop |
| No cross-frame Opaque for ref/out | Opaque only within a single invoke |

### 4.2 Paths that necessarily or almost always allocate

| Path | All four solutions |
|------|--------|
| **new `string`** across boundary | May allocate UTF-16 `string` |
| **new class** returned from C# to Lua | ZLua ObjectRegistry Push; xLua translator |
| **Boxing** enum / struct (if ByObj) | Possible for all |
| **First** type Bind / delegate bind | Possible for all |
| **Lua table** ↔ C# collection | Depends on `[LuaMarshalAs]` / API; often allocates |
| **Overload dispatch** fail/retry | May temp objects (**TBD**) |

### 4.3 Four-way “zero GC” honesty check

| Claim | Valid range |
|------|----------|
| xLua hot path can be optimized | Needs Generate + avoid reflection; **not** global zero GC |
| toLua / SLua | **Generally do not** advertise zero GC |
| ZLua Il2Cpp | **Only** blittable hot paths **target** zero managed GC; string/object/first delegate bind **no** |

---

## 5. Peak vs steady state

| Phase | xLua | toLua / SLua | ZLua |
|------|------|--------------|------|
| First type access | Wrap ready if Generate done | Export already generated | **EnsureBinding** + stub register (Il2Cpp) |
| First Push of an object | translator register | pool register | ObjectRegistry slot + cache |
| Hot loop 1M × P1 | Alloc should ≈0 (good Wrap) | Similar | **Target** ≈0 |
| 1000 string APIs / frame | Alloc + GC pressure dominate | Same | Same |

---

## 6. Delegate & Lua ref lifetime

| Solution | Model |
|------|------|
| xLua | DelegateBridge holds refs; Dispose / GC at the right time |
| toLua / SLua | Manage LuaFunction lifetime manually |
| ZLua | funcRef + closed delegate; `ProcessPendingRefReleases` frame-pump delayed release ([spec/10-LIFETIME.md](/docs/spec/10-LIFETIME/)) |

**Migration note:** don’t assume a Lua function frees immediately when the C# delegate is unreferenced; understand ZLua ref-release semantics.

---

## 7. Il2Cpp GC integration (ZLua-specific)

| Mechanism | Purpose |
|------|------|
| ObjectRegistry slot **GC root** | Lua userdata alive → managed object not collected by Il2Cpp alone |
| non-blittable struct **push_other_roots** | Scan reference fields inside struct memory |
| userdata `__gc` | Unregister in sync with Lua GC |

xLua / toLua / SLua **generally do not change** Boehm/Il2Cpp GC root policy; ZLua **intentionally** integrates for correctness.

---

## 8. Analysis tips (engineering)

1. **Pick the scenario first:** P1-style hot loops vs P6-style string-heavy.
2. **Profiler Alloc:** if every call shows `System.String` / `Box` / `object[]`, interop optimization pays little.
3. **Run both ends:** Mono and Player GC may differ; **Player is truth**.
4. **Read the Spec:** struct/ref paths in [spec/marshal/03-BYREF.md](/docs/spec/marshal/03-BYREF/), [05-STRUCT.md](/docs/spec/marshal/05-STRUCT/).

---

## Related

| Doc | Content |
|------|------|
| [PERFORMANCE.md](/docs/compare/PERFORMANCE/) | Measured performance summary |
| [impl/marshal/REGISTRIES.md](/docs/impl/marshal/REGISTRIES/) | Registry implementation |
| [FEATURES.md](/docs/compare/FEATURES/) | Value-type usage differences |

---

*Theory draft; same-scenario GC Alloc comparison across four solutions **TBD**.*
