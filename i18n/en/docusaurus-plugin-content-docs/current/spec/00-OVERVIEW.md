---
sidebar_position: 1
title: "Overview"
---

# 00 — Overview

> ZLua product goals, dual-runtime architecture, documentation map, and initialization flow.
> Terminology: [GLOSSARY.md](/docs/concepts/glossary/).

---

## 1. Product goals

### 1.1 Usage model

ZLua aligns conceptually with P/Invoke, `MonoPInvokeCallback`, and `MarshalAs`:

| Concept | ZLua counterpart |
|------|-----------|
| P/Invoke | C# ↔ Lua interop; C#→Lua via **`GetFunction<T>`** |
| `MarshalAs` | **`[LuaMarshalAs]`** — parameter / return Marshal |
| C# calling Lua | **`LuaAppDomain.GetFunction<T>`** — obtain a Delegate, then `Invoke` |

**Unified interaction model:**

- **C#→Lua:** `LuaAppDomain.GetFunction<T>(module, method)` binds a Delegate by module and method name; callers `Invoke` and cache on the hot path themselves.
- **Lua→C#:** types are **lazily registered**; members bind on first access to `CSharp[assembly][typeFullName]`. Static members go through the type table; instance members via `obj:Method()`, with semantics close to C#.
- **Codegen:** Lua→C# bridges are generated in the Editor (Mono: Expression Emit; Il2Cpp: C++ stub + metadata), transparent to app developers; **C#→Lua uses the `GetFunction` + Delegate bridge** and does not rewrite user assemblies.

**Deep integration:** on host startup, initialize the CLR and `lua_State`, then load the `zlua` standard library and the `CSharp` root table.

### 1.2 Player release optimizations (Il2Cpp)

| Optimization | Notes |
|------|------|
| Native bridge | Hot paths are C++; no layer-by-layer jumps through `LuaDLL` extern |
| Stub reuse | Identical ReducedType signatures reuse bridge functions — not “one standalone C function per member” |
| Fields / properties | Il2Cpp may use offsets + `methodPointer` for direct access |
| Managed objects | userdata records the object pointer; `ObjectRegistry` slots are registered as **GC roots**, cleared when Lua releases the userdata |

Mono (Editor) may use reflection / Emit slow paths, but **Lua-visible semantics must match Il2Cpp**.

### 1.3 Explicitly unsupported

| Item | Spec behavior |
|----|----------|
| **Dedicated Event metatable** | **No** `{ get, set, fire }`; scripts use `add_EventName` / `remove_EventName` (same as ordinary methods) |
| **`__index` miss** | **`error`** (`zlua: member not found: {key}`, etc.) |
| **`__newindex` miss** | **`error`** |
| **Runtime inheritance lookup for instances** | **None**; inherited members are **flattened at Bind time** into the current type’s three tables (see [02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) §5) |

---

## 2. Dual-runtime architecture

```
                    LuaAppDomain.Initialize(moduleLoader)
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
            ZLua.Mono (Editor)              ZLua.Il2Cpp (Player)
            LuaMonoAppDomain                LuaIl2CppAppDomain
                    │                               │
        three-table Lua indexer / Emit bridge          libil2cpp/zlua (C++)
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
                         Same Lua-visible semantics (spec/**)
```

| Layer | Mono | Il2Cpp |
|----|------|--------|
| Assembly | `ZLua.Mono` | `ZLua.Il2Cpp` (thin InternalCall shell) |
| Interop implementation | C# + Lua indexer | `libil2cpp/zlua/**` |
| Bridging | Expression Emit per public member | ReducedType stub + generated metadata |
| Indexer | three-table Lua closure | native `Dispatch*` + `MetaBinding` / `TypeRegistry` |
| Shared definitions | `ZLua.Common`: `LuaMarshalAsAttribute`, `LuaAliasAttribute`, `LuaAppDomain` | same |

**Il2Cpp source layout (Unity build):**

- `libil2cpp/lua` — Install overlays the selected engine: **PUC-Rio** is a compileable source tree (patched; see [build/01-OFFICIAL-LUA.md](/docs/spec/build/01-OFFICIAL-LUA/)); **LuaJIT** is public headers only (static libs placed by the developer under Plugins; see [build/02-LUAJIT.md](/docs/spec/build/02-LUAJIT/))
- `libil2cpp/zlua` — ZLua native implementation (from package `ZLua~/zlua-runtime`)

Editable development reference: `build-win64/Il2CppOutputProject/IL2CPP/libil2cpp/zlua`.
Package layout, multi-Unity / multi-Lua, patches, DLL naming, Il2Cpp `ZLuaConf.inc` / Compatible headers → [11-MULTI-VERSION.md](/docs/spec/11-MULTI-VERSION/) (§12).

---

## 3. Documentation map

```
Docs/
├── GLOSSARY.md                 Glossary
├── spec/
│   ├── 00-OVERVIEW.md          ← this file
│   ├── 01-HOST-API.md          LuaAppDomain, GetFunction
│   ├── 02-TYPE-SYSTEM.md       CSharp, type tables, constructors, arrays
│   ├── 04-METHOD-OVERLOAD.md   dispatch, aliases, signatures
│   ├── 05-LIB.md               zlua.* API
│   ├── 10-LIFETIME.md          Registry, GC, exception boundaries
│   ├── 11-MULTI-VERSION.md     Unity/Lua multi-version, Install, DLL, ZLuaConf
│   ├── 12-MIGRATION-ADAPTORS.md xLua/toLua/SLua Lua→C# type-path adaptors
│   ├── 13-EXTENSION-METHODS.md C# Extension → extended type IMT
│   ├── build/                  Official Lua / LuaJIT build; Mono gate; EmmyLua debugger
│   ├── metatable/              __index, three tables, layout
│   └── marshal/                Push/Pop, [LuaMarshalAs]
├── impl/                       Implementation notes (do not change Lua semantics)
├── guides/                     Tests, migration
└── compare/                    Comparison with xLua / toLua / SLua
```

**Suggested reading order:**

1. This file → [01-HOST-API.md](/docs/spec/01-HOST-API/) (host integration)
2. [02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) + [metatable/README.md](/docs/spec/metatable/) (how Lua accesses C#)
3. [marshal/README.md](/docs/spec/marshal/) (how arguments are passed)
4. [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) + [05-LIB.md](/docs/spec/05-LIB/) (overloads and standard library)
5. [10-LIFETIME.md](/docs/spec/10-LIFETIME/) (memory and GC)
6. Packaging / switching Unity or Lua versions → [11-MULTI-VERSION.md](/docs/spec/11-MULTI-VERSION/)
7. Official Lua build → [build/01-OFFICIAL-LUA.md](/docs/spec/build/01-OFFICIAL-LUA/)
8. LuaJIT build → [build/02-LUAJIT.md](/docs/spec/build/02-LUAJIT/)
9. Editor Mono callback error boundary (all series) → [build/03-MONO-LUAJIT-CALLBACK-GATE.md](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/)
10. Editor EmmyLua debugger → [build/04-EMMYLUA-DEBUGGER.md](/docs/spec/build/04-EMMYLUA-DEBUGGER/)
11. Third-party native modules (socket / cjson, etc.) → [build/05-NATIVE-MODULES.md](/docs/spec/build/05-NATIVE-MODULES/)
12. Migrating type-access adaptors from xLua / toLua / SLua → [12-MIGRATION-ADAPTORS.md](/docs/spec/12-MIGRATION-ADAPTORS/)
13. C# Extension methods → [13-EXTENSION-METHODS.md](/docs/spec/13-EXTENSION-METHODS/)

**Conflict resolution:** `spec/**` > Il2Cpp source > `impl/**`.

---

## 4. Initialization flow

### 4.1 C# entry

```csharp
LuaAppDomain.Initialize(moduleName => {
    // Return module source string, or byte[] / other loader-agreed type
    return LoadLuaModule(moduleName);
});
```

`LuaAppDomain` resolves the backend by `Application.isEditor`:

- Editor → `ZLua.LuaMonoAppDomain.Initialize`
- Player → `ZLua.LuaIl2CppAppDomain.Initialize` → native `InitializeInternal`

After init, register `LuaFramePump` for housekeeping such as pending ref releases on Unity frame callbacks.

Optional Editor: when Settings `enableDebugger` is on, start EmmyLua at the end of Mono `Initialize` (see [build/04-EMMYLUA-DEBUGGER.md](/docs/spec/build/04-EMMYLUA-DEBUGGER/)).

### 4.2 Native / Mono side (conceptual order)

| Step | Action |
|------|------|
| 1 | Create the main `lua_State` (**single-state** model; see [10-LIFETIME.md](/docs/spec/10-LIFETIME/)) |
| 2 | Open standard libraries; run `zlualib.lua` (`ZLuaLib::RegisterGlobals` registers `__zlua_*`) |
| 3 | Initialize registries: `ObjectRegistry`, `TypeRegistry`, Opaque scope, etc. |
| 4 | Create the global `CSharp` root table (assembly / type lazy `__index`) |
| 5 | Install the module loader (`__zlua_load_module` searcher) |
| 6 | Optional: run project scripts such as `globals.lua` |

### 4.3 First type access

```
CSharp.__index(assemblyName)
  → create assembly table, rawset cache

assembly.__index(typeFullName)
  → CLR resolve Type, EnsureBinding
  → build SMT / IMT, three tables, dispatch
  → PushTypeTable, rawset cache
```

Afterwards Lua accesses members via the type table / userdata metatable — **no** `[MonoLuaCallback]` or manual Export required.

### 4.4 Domain Reset / shutdown

The public host API has **no** `Shutdown`; for hot reload or clearing the script world use `LuaAppDomain.Reset(loader)` (schedule only at the call site; this frame’s **EndOfFrame** runs teardown + rebuild via the Initialize path). Internal teardown conceptually:

1. Drain the pending Lua ref release queue
2. `ObjectRegistry::Shutdown`, struct registry shutdown
3. Close `lua_State` (then rebuild and install the new loader)

Old `GetFunction` delegates are all invalid after Reset takes effect. Ordering details: [10-LIFETIME.md](/docs/spec/10-LIFETIME/) §7 and [impl/IL2CPP.md](/docs/impl/IL2CPP/).

---

## 5. Boundaries with other docs

| Topic | Document |
|------|----------|
| `__index` / three tables / miss semantics | [metatable/](/docs/spec/metatable/) |
| Push / Pop / ref / Opaque | [marshal/](/docs/spec/marshal/) |
| `zlua.make_*` / `register_method` | [05-LIB.md](/docs/spec/05-LIB/) |
| `GetFunction` and Delegate bridge | [01-HOST-API.md](/docs/spec/01-HOST-API/) |
| ObjectRegistry / GC root | [10-LIFETIME.md](/docs/spec/10-LIFETIME/) |
| xLua / toLua / SLua type-path adaptors | [12-MIGRATION-ADAPTORS.md](/docs/spec/12-MIGRATION-ADAPTORS/) |

---

## 6. Example: minimal script

```lua
-- Assembly alias (optional)
CSharp.AC = CSharp['Assembly-CSharp']

local Demo = CSharp.AC.Demo
local demo = Demo()

demo:SetX(10)
print(demo:GetX())

-- Explicit overload (see 04-METHOD-OVERLOAD)
demo['Run(System.Int32)'](demo, 42)          -- full-signature key
local run = demo['Run(System.Int32)']
zlua.register_method("run_i32", run)         -- short name then colon call
demo:run_i32(42)
```

C# side:

```csharp
var onStart = LuaAppDomain.GetFunction<Action>("main", "OnStart");
onStart();

public event Action<int> ValueChanged;
// Lua: demo:add_ValueChanged(function(v) ... end)
//      demo:remove_ValueChanged(handler)
```
