---
sidebar_position: 2
title: "Features & usage comparison"
---

# Features & usage comparison (xLua / toLua / SLua / ZLua)

> **Nature:** evaluation material, not a ZLua behavior Spec.
> **ZLua status:** Mono (Editor) and Il2Cpp (Player) are **both done** (see [impl/MONO.md](/docs/impl/MONO/)).

---

## 1. Overview

| Dimension | xLua | toLua / tolua# | SLua | ZLua |
|------|------|----------------|------|------|
| **Lua engine** | Separate **libxlua** (P/Invoke) | Embedded or bound native lua | Embedded lua | Linked into **libil2cpp** (Player) / embedded (Editor) |
| **Type entry** | `CS.Namespace.Type` | `Namespace.Type` (BeginModule chain) | Like toLua + config | `CSharp[assembly]['Full.Name']` lazy load |
| **Lua→C# bridge** | Generated **C# Wrap** + `LuaDLL` | Generated `*.Wrap.cs` | Auto-bind + export | C++ MethodBridge (Il2Cpp) / Expression Emit (Mono) |
| **C#→Lua** | `LuaEnv` + `LuaFunction` + many `LuaDLL` | `LuaState` / `LuaFunction` | `LuaSvr` / `LuaFunction` | `GetFunction<T>` + Delegate bridge |
| **Whitelist / export** | `[LuaCallCSharp]` / `[CSharpCallLua]` + Generate | Manual lists / Binder | Export config / Attribute | **No** LuaCall whitelist; by **public** + lazy Bind |
| **Editor vs Player** | Mostly same (libxlua + Wrap) | Mostly same | Mostly same | **Dual track**: Mono Emit vs Il2Cpp native (semantics must match) |
| **Unity invasiveness** | Plugin + native | Plugin | Plugin | **fork libil2cpp** (Player) |
| **Event** | Dedicated support | Depends on version | Depends on version | **None**; use ordinary `add_` / `remove_` methods |
| **Docs / community** | Strong | Weak (stale risk) | Weak | Building |

---

## 2. Type access

### 2.1 Syntax (same type `MyGame.Demo`)

| Solution | Typical syntax |
|------|----------|
| xLua | `CS.MyGame.Demo` |
| toLua | `UnityEngine.GameObject` (BeginModule namespace chain; not only global short names) |
| SLua | `UnityEngine.GameObject` (auto-exported namespaces) |
| ZLua | `CSharp['Assembly-CSharp']['MyGame.Demo']` or `CSharp.AC['MyGame.Demo']` |

**ZLua rule highlights:**

- Types **with namespaces** must use a **bracket key** for the full `typeFullName`; `CSharp.AC.MyGame.Demo` is forbidden (`.` is not a table path).
- Nested types use `+`: `CSharp.AC['Outer+Inner']`.
- Assembly names are simple names: `Assembly-CSharp`, `mscorlib`.

See [spec/02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) §2.

### 2.2 Lazy load vs pre-export

| Solution | Model | Package / link impact |
|------|------|-----------------|
| xLua | Generate whitelisted types → Wrap in package | Unexported types unreachable; size controllable |
| toLua / SLua | Export list decides Wrap count | More exports → more generated code |
| ZLua | First `CSharp[asm][type]` access triggers **EnsureBinding** | Runtime bind + Il2Cpp stub tables; **unaccessed types take no bridge table slots** (link still keeps metadata) |

### 2.3 Generics & arrays

| Capability | xLua | toLua | SLua | ZLua |
|------|------|-------|------|------|
| Closed generics | `CS.System.Collections.Generic.List(CS.System.Int32)` etc. | Pre-export or reflection | Config export | `zlua.make_generic_type(base, ...)` |
| Array types | Export or reflection | Export | Export | `zlua.make_szarray_type` / `make_mdarray_type` |
| Runtime array construction | Supported (depends on export) | Limited | Limited | `zlua.new_szarray_by_element_type` etc. |

---

## 3. Member calls (Lua→C#)

### 3.1 Static / instance

**Shared example:** static `Demo.Add(1, 2)`, instance `obj:GetX()`.

| Solution | Static | Instance |
|------|------|------|
| xLua | `CS.Demo.Add(1, 2)` | `obj:GetX()` |
| toLua | `Demo.Add(1, 2)` | `obj:GetX()` |
| SLua | Same as toLua | Same as toLua |
| ZLua | `Demo.Add(1, 2)` (`Demo` is type table) | `obj:GetX()` |

ZLua separates static/instance into **three tables** (method / fieldGetter / fieldSetter); inherited members are **flattened at Bind time** — no runtime walk up the inheritance chain.

### 3.2 Fields & properties

| Solution | Read field | Write read-only property |
|------|--------|------------|
| xLua | Often via Wrap / property | Wrap errors |
| toLua / SLua | Wrap or getter | Same |
| ZLua | `obj.x` → fieldGetter table; Il2Cpp can **read by offset** | `__newindex` miss → **error** |

### 3.3 Method overloads

| Solution | Strategy |
|------|------|
| xLua | Overload dispatch inside generated Wrap |
| toLua / SLua | Dispatch inside Wrap or single signature |
| ZLua | Registered at Bind; default **best match**; `[LuaAlias]` / `register_method` for explicit binds (see [spec/04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/)) |

**ZLua-specific capabilities:**

```lua
-- Bind-time [LuaAlias("foo_str")] single-candidate direct closure
obj:foo_str("a")

-- Or attach a new name at runtime (must be free)
local run = demo.run_i32
zlua.register_method("run_hot", run)
demo:run_hot(1)
```

### 3.4 `__index` miss semantics

| Solution | Missing member |
|------|------------|
| xLua | Usually `nil` or error (depends on Wrap) |
| toLua / SLua | Often error |
| ZLua | **`nil`** (read); write unknown key → **`error`** |

---

## 4. C#→Lua

### 4.1 Entry points

| Solution | C# calls Lua function | Lua function → C# delegate |
|------|----------------|------------------------|
| xLua | `LuaEnv.DoString` / `LuaFunction.Call` / `[CSharpCallLua]` | `LuaFunction` / `Delegate` bridge |
| toLua | `LuaState.DoFile` / `LuaFunction` | `LuaFunction.ToDelegate` etc. |
| SLua | `LuaSvr` + `LuaFunction` | SLua delegate binding |
| ZLua | `LuaAppDomain.GetFunction<Action<float>>("game", "OnTick")` | Method params **implicit marshal** (`Action`/`Func` etc.) |

**ZLua `GetFunction` example:**

```csharp
static readonly Action<float> OnTick =
    LuaAppDomain.GetFunction<Action<float>>("game", "OnTick");
OnTick(0.016f);
```

- Editor / Player: **same API**; runtime calls Lua via Delegate bridge (cache the delegate on hot paths).

### 4.2 Module loading

| Solution | Loading |
|------|------|
| xLua | `require` + custom loader |
| toLua / SLua | Custom loader |
| ZLua | `LuaAppDomain.Initialize(moduleLoader)`; integrates with `require` (see [spec/01-HOST-API.md](/docs/spec/01-HOST-API/)) |

---

## 5. Value types, ref, struct

| Topic | xLua | toLua / SLua | ZLua |
|------|------|--------------|------|
| struct args | Often boxing or table | Depends on Wrap | **ByVal userdata** copy / **ByObj** boxed |
| struct returns | Often allocate | Same | ByVal payload or boxed (see [spec/marshal/05-STRUCT.md](/docs/spec/marshal/05-STRUCT/)) |
| `ref`/`out` Lua→C# | Multi-return or table | Multi-return | StructUserData (`Type(...)` / C# push) or copy semantics |
| C#→Lua `ref`/`out` | Depends on version | Limited | **OpaqueValue** (valid only for that call frame) |
| enum | number / exported type | Export | integer default; optional ByObj boxed |
| `zlua.cast` | — | — | Declared-type facade conversion |

**Opaque boundaries (ZLua-specific; easy migration pitfalls):**

- On a C# `GetFunction` delegate, `ref int` pushed to Lua is **OpaqueValue**, not integer; use `zlua.get_opaquevalue` / `set_opaquevalue`.
- Opaque **must not persist across pcall**.

---

## 6. Hotupdate, codegen & stripping

| Dimension | xLua | toLua / SLua | ZLua |
|------|------|--------------|------|
| Hotupdate practice | Many ready solutions (bytecode, assets) | Project-built | **Build your own**; ZLua does not bind a specific hotupdate framework |
| Codegen | XLua Generate All | Export Wrap | Il2Cpp: **Codegen C++ stubs** (Lua→C#); Mono: **Emit** (not in Player package); C#→Lua **no codegen** |
| Reflection fallback | Yes (slow path) | Partial | **Forbids** silent hot-path `Method.Invoke`; Emit failure → **bind-time failure** |
| Link / strip | Whitelist controls Wrap | Export list | Public types can lazy Bind; Il2Cpp **ReducedType** controls stub size (see [BRIDGE.md](/docs/compare/BRIDGE/)) |
| Unity upgrade | Mostly bump xLua package | High risk | **Merge libil2cpp patches** (engineering debt) |

---

## 7. Editor / Player consistency

| Solution | Dual ends |
|------|------|
| xLua / toLua / SLua | Usually same lib + Wrap; Editor ≈ Player |
| ZLua | Mono and Il2Cpp **must** share **Lua-visible semantics**; implementations differ (Emit vs C++ stubs) |

**Testing requirement:** run the same cases once in Editor and once on Il2Cpp Player; any failure fails (see [guides/TESTING.md](/docs/community/testing/)).

**Indexer properties / open generics etc.:** see [compatibility matrix](https://doc.zlua.cn/docs/getting-started/compatibility) and [Spec](/docs/spec/00-OVERVIEW/); dual-end semantics match; limited items are limited on both ends.

---

## 8. Invasiveness & maintenance

```text
Shallow ←────────────────────────────────────────→ Deep (Il2Cpp invasiveness)

Pure C# reflection bridge
  xLua / toLua / SLua (plugin + native / Wrap)
    ★ ZLua Player target (embed libil2cpp)
      HybridCLR-level VM changes (ZLua does not do this)
```

| Layer | xLua | toLua / SLua | ZLua |
|------|------|--------------|------|
| Modify libil2cpp | No | No | **Yes** (Player) |
| Separate native | libxlua | Optional | No (same binary as il2cpp) |
| GC hooks | Usually none | Usually none | non-blittable struct etc. may hook `push_other_roots` |
| Maintenance focus | Package versions | Stale risk | **Unity versions + zlua patch merges** |

---

## 9. Config & whitelist

| Solution | Mechanism |
|------|------|
| xLua | `[LuaCallCSharp]`, `[CSharpCallLua]`, `[ReflectionUse]`, Generate config |
| toLua | Custom `CustomSettings.cs` export list |
| SLua | `[CustomLuaClass]`, export XML / code |
| ZLua | **No** LuaCall-style whitelist; **public** members can Bind; `[LuaMarshalAs]` / `[LuaAlias]` affect Marshal and aliases |

**Migration meaning:** leaving xLua means **deleting** Generate config and confirming which public APIs in assemblies should be exposed to Lua; sensitive APIs should become **non-public**, not rely on an export list.

---

## 10. Unsupported or weak items (migration checklist)

| Item | xLua | toLua / SLua | ZLua |
|----|------|--------------|------|
| C# **Event** sugar | Yes | Depends on version | **None** → `add_Xxx` / `remove_Xxx` |
| Runtime inheritance lookup | Yes | Yes | **None** (Bind-time flattening) |
| `CS.` / `UnityEngine.*` etc. | Yes | Yes (different shapes) | Native uses **`CSharp`**; migration period can use [adaptors](/docs/spec/12-MIGRATION-ADAPTORS/) |
| Hot-path reflection Invoke | Fallback | Partial | **Explicit error** |
| Cross-frame Opaque | N/A | N/A | **Forbidden** |
| Arbitrary Lua function as permanent delegate without GC concerns | Watch translator | Watch carefully | Must understand [spec/10-LIFETIME.md](/docs/spec/10-LIFETIME/) |

---

## 11. Same example, four columns

**Need:** call `MyGame.Demo.Add(1, 2)`, create instance, read field `x`.

```lua
-- xLua
local Demo = CS.MyGame.Demo
local sum = Demo.Add(1, 2)
local obj = Demo()
local x = obj.x

-- toLua (Demo already exported globally)
local sum = Demo.Add(1, 2)
local obj = Demo.New()
local x = obj.x

-- SLua
local Demo = MyGame.Demo
local sum = Demo.Add(1, 2)
local obj = Demo()
local x = obj.x

-- ZLua (native)
local Demo = CSharp['Assembly-CSharp']['MyGame.Demo']
local sum = Demo.Add(1, 2)
local obj = Demo()
local x = obj.x

-- ZLua + xlua adaptor (migration transition; CS.* still works on the checklist)
-- after require + adaptor.init(export_types):
-- local Demo = CS.MyGame.Demo
```

Type-path adaptor details: [guides/migration](/docs/guides/migration/) and [spec/12-MIGRATION-ADAPTORS](/docs/spec/12-MIGRATION-ADAPTORS/).

---

## 12. Selection summary

| Better fit | Solution |
|--------|------|
| Ship now, fewer pitfalls, team already has xLua assets | **xLua** |
| Legacy toLua/SLua already stable, small change surface | **Keep current** (migrating to ZLua is costly) |
| Player performance boundary is the bottleneck; willing to maintain libil2cpp; want C#-aligned semantics | **ZLua** |
| Unwilling to change engine layer; don’t need extreme interop perf | **xLua** over ZLua |

Migration steps: [guides/migration/](/docs/guides/migration/).

---

## Related

| Doc | Content |
|------|------|
| [PERFORMANCE.md](/docs/compare/PERFORMANCE/) | Performance comparison ([zlua-benchmark](https://github.com/focus-creative-games/zlua-benchmark)) |
| [GC.md](/docs/compare/GC/) | GC comparison |
| [spec/02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) | ZLua type system Spec |
