---
sidebar_position: 3
title: "Il2Cpp Generated Stubs"
---

# Il2Cpp Generated Stubs

> **Output directory:** `libil2cpp/zlua/generated/` (build writes `build-win64/.../zlua/generated/`)
> **Generator:** `Packages/com.code-philosophy.zlua/Editor/CppCodeGen/`
> **Runtime load:** `LuaAppDomain::Initialize` → `*Bridge::Initialize`

## 1. Design principles

Il2Cpp Player **cannot** JIT or use `Method.Invoke`. The Lua→C# hot path depends on build-time scanning of user assemblies, generating C++ stubs for each **AOT-reachable signature**, looked up at runtime via **function-pointer tables**.

Versus Mono ([EMIT-MONO.md](/docs/impl/codegen/EMIT-MONO/)):

| Il2Cpp | Mono |
|--------|------|
| Build-time C++ codegen | Bind-time `Expression.Compile` |
| **Reuse stubs by ReducedType signature** | **One specialized bridge per member**; no shared ReducedType table |
| Artifacts in `generated/` | Logic in `Runtime/Mono/Emit/` |

## 2. Generation entry: `CodeGenerator.Generate`

`Editor/CppCodeGen/CodeGenerator.cs` calls in order:

| Order | Generator | Artifact |
|-------|-----------|----------|
| 1 | `BuiltinScriptsCodegen` | `BuiltinScripts.inc` |
| 2 | `PropertyBridgdeCodegen` | `PropertyBridgeStub.h` |
| 3 | `MethodBridgeCodegen` | `MethodBridgeStub.h` |
| 4 | `DelegateBridgeCodgen` | `DelegateBridgeStub.h` |
| 5 | `MarshalAsCodegen` | `MarshalBindings.h/.cpp` (`[LuaMarshalAs]` extensions) |

Unity Editor Il2Cpp builds write into target `zlua/generated/`; **do not hand-edit** generated files.

## 3. `MethodBridgeStub.h`

### 3.1 Analysis

`MethodBridgeAnalyzer.Collect` walks non-generic types/methods in user assemblies, skips `.cctor`, and builds `MethodBindingInfo` per `MethodDef`:

- `uniqueName` / `stubName` (`NameUtil.CreateStubName`)
- Parameter/return `ParamMarshalInfo` / `LuaMarshalMetaInfo` (`MarshalMetaUtil`)

### 3.2 Artifact structure

```cpp
namespace methodbridge {
struct MethodBridgeEntry {
    const char* stubName;
    FnLua2CsInvoker lua2CsInvoker;
};
static const MethodBridgeEntry g_methodBridges[] = {
    { "Stub_MyType_DoWork_int", Bridge_MyType_DoWork_int },
    ...
    { nullptr, nullptr }
};
}
```

Each `Bridge_*` function:

- Pops arguments from the Lua stack (typed writers or inline primitives);
- `alloca` / stack layout;
- Calls `method->invoker_method(...)`;
- Pushes the return value.

### 3.3 Runtime registration

`MethodBridge::Initialize()` walks `g_methodBridges` into `AppendOnlyStringHashMap<FnLua2CsInvoker>`.

`MethodBridge::ResolveMethodInvoker(method)` looks up stubName by **ReducedType signature**; on miss, falls back to `DefaultInvokeLuaMethod` (alloca + `MarshalMeta` writers, slower).

`MetaBinding::CreateMethodMarshalCtx` writes the resolved result into `MethodMarshalCtx::lua2CsInvoker`.

## 4. `PropertyBridgeStub.h`

Generates `FnPropertyGetter` / `FnPropertySetter` function-pointer tables for property getters/setters.

`PropertyBridge::Initialize()` registers; `MetaBinding` fills `PropertyMarshalCtx::getter/setter`.

Fields do **not** get a separate stub table: field R/W uses `MarshalMetaInfo::cs2luaWriter` / `lua2csWriter` + offset (`FieldMarshalCtx`).

## 5. `DelegateBridgeStub.h`

Stub tables for C# delegate invoke and Lua function → delegate.

`DelegateBridge::Initialize()` loads at AppDomain level; aligned with [../../spec/marshal/09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/).

## 6. C#→Lua (GetFunction)

**Not under `generated/`.** C#→Lua binds a module function as a closed delegate via `LuaAppDomain.GetFunction<T>` at runtime; `Invoke` goes through the **Delegate bridge** (same as [../../spec/marshal/09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/). Il2Cpp and Mono share the same **API**.

## 7. `MarshalBindings.*`

`MarshalAsCodegen` generates extra writers/readers for **non-default** `[LuaMarshalAs]` signatures, referenced by stubs or `MarshalMeta::Create`.

Rules: [../../spec/marshal/02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/).

## 8. `BuiltinScripts.inc`

Embeds `globals.lua`, `zlualib.lua`, etc. as C string arrays; `LuaEnv.cpp` `#include`s them and `dostring`s in `RegisterGlobals` / `RegisterZLuaApi`.

Mono equivalent: `Lvm/BuiltinScripts.cs` loads same-named scripts from resources.

## 9. Failure policy

| Scenario | Behavior |
|----------|----------|
| Signature cannot generate a stub (unsupported generic, etc.) | Codegen **errors** or skips with a record; do not emit a silent slow path into Player |
| Runtime stub table miss | `DefaultInvokeLuaMethod` (explicit slow path; add stubs in development) |

Mono counterpart: cannot Emit → **throw at bind time** (see [../MONO.md](/docs/impl/MONO/) D3).

## 10. Relation to MetaBinding / Indexer

- Stubs do **not** decide whether a member enters the indexer; `MetaBinding` still creates closure refs.
- Direct method closure upvalues include `MethodMarshalCtx*` → already-resolved `lua2CsInvoker`.
- `Dispatch*` only affects **how** the closure is obtained, not the stub body.

## 11. Related files

| Path | Responsibility |
|------|----------------|
| `Editor/CppCodeGen/CodeGenerator.cs` | Top entry |
| `Editor/CppCodeGen/MethodBridgeCodegen.cs` | Method stubs |
| `Editor/CppCodeGen/PropertyBridgdeCodegen.cs` | Property stubs |
| `Editor/CppCodeGen/DelegateBridgeCodgen.cs` | Delegate stubs |
| `bridge/MethodBridge.cpp` | Stub table load |
| `lvm/LuaAppDomain.cpp` | Initialize order |
