---
sidebar_position: 1
title: "Bridge & size"
---

# Bridge functions — performance & code size

> **Nature:** architecture and size-model analysis; measurements **TBD**.
> **Core question:** is bridge code **one entry per member** or **stubs reused by signature**? How indirection affects ns/call and `.so`/`.dll` size.

---

## 1. Analysis axes

| Axis | Question |
|----|------|
| **Generation granularity** | Per method/field bridge vs ReducedType / signature-hash reuse |
| **Call cost** | Indirect jumps, dispatch tables, shared marshal writers |
| **Binary size** | Generated file totals, symbol counts; linear in members or sublinear in signatures |
| **Editor** | Mono Emit count vs Il2Cpp shared stubs |
| **Stripping** | Do unused types / signatures enter the Player package? |

---

## 2. How the four solutions generate bridges

### 2.1 xLua

| Item | Notes |
|----|------|
| Granularity | **One C# Wrap set per type**; member-level C# statics (`MonoPInvokeCallback`) |
| Lua→C# | Wrap inlines or calls `LuaDLL`; **at least one C# entry per exported member** |
| C#→Lua | `DelegateBridge` etc.; templates by signature but still C#-heavy |
| Size | Roughly linear in **exported member count**; Generate whitelist controllable |
| Player | Wrap compiled into Il2Cpp; **no** C++ stub reuse |

```text
Type T with M members → O(M) Wrap functions (C#)
```

### 2.2 toLua / tolua#

| Item | Notes |
|----|------|
| Granularity | **Per exported type** `*Wrap.cs`; member-level tolua bind functions |
| Model | Like xLua: **members × wrappers** |
| Size | Larger export list → more Wrap |
| Perf | Via C# Wrap + lua binding layer; indirection similar to xLua |

### 2.3 SLua

| Item | Notes |
|----|------|
| Granularity | Auto-bind generation; mainly **member-level** wrappers |
| Size / perf | Like toLua; depends on export config |

### 2.4 ZLua

| Backend | Granularity | Notes |
|------|------|------|
| **Il2Cpp Player** | **Signature stub reuse** | Codegen emits C++ `MethodBridge` / `PropertyBridge` / `DelegateBridge` by **ReducedType** (arg+return marshal shape); **many members share one stub** |
| **Mono Editor** | **One Emit per member** | Expression.Compile → `lua_pushcfunction` into three tables; **not in Player package** |

```text
Il2Cpp: Type T with M members, S distinct ReducedTypes → O(S) stubs, S ≤ M
Mono:   M members → M Emit bridges (dev-time specialization; more direct calls)
```

See [impl/codegen/](/docs/impl/codegen/), [impl/MONO.md](/docs/impl/MONO/) D6.

---

## 3. ReducedType & stub reuse (ZLua Il2Cpp)

**ReducedType** abstracts: ignore member names; keep only **marshal shape** (e.g. `int,int→int`, `userdata→void`).

| Member examples | May share |
|----------|----------|
| `Add(int,int):int` | stub A |
| `Sub(int,int):int` | stub A (same shape) |
| `GetX():int` | stub B |
| `set_x(int):void` | stub C |

**Benefits:**

- Player binary: **size ~ O(signature kinds)** not O(member count).
- icache: hot-path stub bodies stay small; can inline lua API + `methodPointer`.

**Costs:**

- Stub entry needs **methodId / dispatch metadata** (one table lookup, ~0–50 ns — see [PERFORMANCE.md](/docs/compare/PERFORMANCE/)).
- Codegen + metadata tables are more complex than xLua Generate.

---

## 4. Size model (estimate)

Let:

- `W_wrap` = average xLua/toLua per-member Wrap size (incl. P/Invoke attrs etc.)
- `W_stub` = ZLua per ReducedType stub size
- `M` = member count
- `S` = distinct ReducedType count (often `S << M` for large APIs)

| Solution | Bridge code volume (order) |
|------|-------------------|
| xLua / toLua / SLua | **≈ M × W_wrap** (by exported members) |
| ZLua Il2Cpp | **≈ S × W_stub** + metadata tables + `generated/` registration |
| ZLua Mono (Editor only) | M × Emit dynamic methods (**not counted in Player**) |

**Example (estimate only):** a type with 200 methods, 80 signature shapes:

- xLua: 200 Wrap functions
- ZLua Player: ~80 C++ stubs + dispatch tables

**TBD:** for the same assembly, count Generate `.cs` lines vs ZLua `generated/*.cpp` symbols.

---

## 5. Performance: stub indirection vs specialized direct call

| Model | Call path | Size | Per call |
|------|----------|------|-----------|
| xLua per-member Wrap | Specialized C# + LuaDLL × N | Large | Mid–high (LuaDLL) |
| ZLua shared stub | C++ stub + methodId dispatch | Small | Low–mid (fewer crossings) |
| ZLua Mono per-member Emit | Specialized C# → direct call | Large in Editor | **Lowest** (dev-time) |

**Conclusion (theory):**

- Il2Cpp: **one stub indirection** is usually far cheaper than xLua’s **many LuaDLL** costs (see [PERFORMANCE.md](/docs/compare/PERFORMANCE/)).
- Mono Emit: **per-member direct calls** help Editor profiling; semantics match Player stubs but **implementations differ**.

---

## 6. Field / property bridges

| Solution | Read `int` field |
|------|---------------|
| xLua | Wrap → getter or property |
| ZLua Il2Cpp | **PropertyBridge / offset getter**; can share “read int field” stub |
| ZLua Mono | Per-field Emit getter/setter |

Field fast paths are one of ZLua’s **size + perf** wins (fewer Wrap, direct memory reads).

---

## 7. C#→Lua: Delegate bridge

| Solution | Model |
|------|------|
| xLua | C# DelegateBridge + many LuaDLL calls |
| ZLua | **`GetFunction<T>`** binds function → closed delegate at runtime; `Invoke` via **Delegate bridge** (Mono / Il2Cpp paths differ; semantics match) |

See [spec/01-HOST-API.md](/docs/spec/01-HOST-API/) and [guides/csharp-calling-lua.md](/docs/guides/csharp-calling-lua/).

---

## 8. Stripping & linking

| Solution | Unused APIs |
|------|------------|
| xLua | Types not Generated are **not in the package** |
| toLua / SLua | Unexported are **not in the package** |
| ZLua | **Lazy Bind**; unaccessed types may **not** register stubs, but Il2Cpp **still links** assembly metadata; stub tables follow Codegen input scope |

**Migration:** when leaving xLua whitelists for ZLua, don’t assume “uncalled types cost nothing” — understand Codegen inputs (typically test assemblies + game assembly public APIs).

---

## 9. vs HybridCLR / other approaches

| Track | Bridge shape |
|------|----------|
| HybridCLR etc. | Change execution model; bridge ideas can reuse **signature sharing** |
| xLua | Member-level C# Wrap; mature and controllable |
| ZLua | **Il2Cpp embed + ReducedType**; Player-extreme oriented |

ZLua is **not** a HybridCLR replacement; the bridge layer is analogous to “native stub table + methodPointer”.

---

## 10. Reproducible size measurement (suggested)

1. **xLua:** after Generate, count `.cs` lines under `Wrap/` and IL size (dotnet ilspy / `ildasm`).
2. **ZLua:** count `.cpp/.h` under `libil2cpp/zlua/generated/` and `MarshalBindings` table entries.
3. **Player:** compare `libil2cpp.so` / `GameAssembly.dll` size before/after link (control for bridge-only differences).

Fill results below (**TBD**):

| Metric | xLua | toLua | SLua | ZLua Il2Cpp |
|------|------|-------|------|-------------|
| Bridge sources total KB | TBD | TBD | TBD | TBD |
| Distinct stub count | N/A | N/A | N/A | TBD |
| Player so delta | TBD | TBD | TBD | TBD |

---

## Related

| Doc | Content |
|------|------|
| [PERFORMANCE.md](/docs/compare/PERFORMANCE/) | ns/call and indirection |
| [impl/codegen/STUBS-IL2CPP.md](/docs/impl/codegen/STUBS-IL2CPP/) | Stub type inventory |
| [impl/codegen/EMIT-MONO.md](/docs/impl/codegen/EMIT-MONO/) | Mono Emit |
| [FEATURES.md](/docs/compare/FEATURES/) | Generation & whitelist differences |

---

*Size and stub counts pending measured supplements.*
