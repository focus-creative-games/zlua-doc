---
sidebar_position: 1
title: "Mono Expression Emit"
---

# Mono Expression Emit

> **Target directory:** `Runtime/Mono/Emit/` (from Phase 3)
> **Il2Cpp counterpart:** [STUBS-IL2CPP.md](/docs/impl/codegen/STUBS-IL2CPP/) (build-time stub tables)
> **Constraints:** [../MONO.md](/docs/impl/MONO/) D3, D6, D7

## 1. Design principles

At **type bind time** (after `MetaBinding.EnsureBinding`, when a Lua closure is first needed), Mono Editor generates a **unique** Lua C# callback for **each** public field, property accessor, method, and constructor:

```
System.Linq.Expressions → Compile() → LuaCSFunction / delegate
    → lua_pushcfunction → write into three tables (method / fieldGetter / fieldSetter)
```

Unlike Il2Cpp **ReducedType signature reuse**, Mono does **not** maintain a global stub hash table; each `(Type, MemberInfo, isStatic, isByVal)` combo gets one specialized bridge.

## 2. Failure policy (D3)

| Case | Behavior |
|------|----------|
| Signature in Expression-expressible set | Normal Compile |
| Unsupported signature (e.g. open generic method, certain byref combos) | **Bind-time `InvalidOperationException`**, message includes type and member full names |
| **Forbidden** | Silent fallback to `Method.Invoke` + `object[]` |

Known supported sets are covered by `Tests/Lua/**`; new signature kinds must **extend Emit first**, then open binding.

## 3. Implementation order (Phase 3)

[../MONO.md](/docs/impl/MONO/) suggests simple → complex by dependency:

| Step | Member | Write table | Notes |
|------|--------|-------------|-------|
| 1 | **Field** static/instance | getter → `fieldGetterTable`; writable → `fieldSetterTable` | Expression or emit IL for `FieldInfo.Get/SetValue` |
| 2 | **Property** no-arg | Same as Field; call property getter/setter MethodInfo | Indexer property → **methodTable** (dispatch) |
| 3 | **Method** single overload | `methodTable` direct closure | Capture `MethodInfo` + typed pop/push |
| 4 | **Method** multi-overload | `methodTable` dispatch closure | Calls managed `MethodOverloadResolver` (align [../marshal/OVERLOAD-RESOLVER.md](/docs/impl/marshal/OVERLOAD-RESOLVER/)) |
| 5 | **Constructor** | `SMT.__call` | Reuse ctor overload grouping |
| 6 | **Aliases** | Extra keys in `methodTable` | `[LuaAlias]`, `zlua.register_method` |

Run corresponding Lua cases after each step before continuing.

## 4. Closure shape (D7)

### 4.1 Forbidden upvalue pattern

Il2Cpp direct method closures use:

- `ClosureKind` + `TypeBinding*` + `MethodMarshalCtx*`

Mono Emit must **not** copy `MethodMarshalCtx` / methodId into Lua upvalues. Specialized bridges should:

- Directly `Compile` to `(IntPtr L) => int` delegates;
- Hold statically or capture in closures **already resolved** `MethodInfo`/`FieldInfo` and prebuilt pop/push delegates;
- Overload dispatch captures a **read-only** candidate array, not runtime string lookup.

### 4.2 Writing the three tables

After Emit:

```csharp
// Pseudocode
LuaDll.lua_rawgeti(L, RegistryIndex, binding.StaticTables.MethodTableRef);
LuaDll.lua_pushcfunction(L, compiledDelegate);
LuaDll.lua_setfield(L, -2, methodName);
LuaDll.lua_pop(L, 1);
```

Aligned with [../metatable/INDEXER-MONO.md](/docs/impl/metatable/INDEXER-MONO/): method tables store the **closure itself**, not a wrapper.

## 5. `this` and ByVal / ByObj

Instance method Emit must branch:

| Target kind | `this` source |
|-------------|---------------|
| class ByObj | `ObjectRegistry.PopThis(L, 1)` |
| struct ByVal | `InstanceTarget` equivalent: payload pointer / copy |
| struct ByObj | boxed ByObj userdata |

Align with Il2Cpp `InstanceTarget::GetResolveMethodThisFunc`; helpers live in `Mt/InstanceTarget.cs` (placeholder exists).

## 6. Marshal and Emit cooperation

Pop/push logic **reuses** typed APIs in `Marshaling/*Marshaling*.cs`; do not re-encode spec rules inside Emit:

- At bind time, build a **delegate chain** per parameter/return (same idea as Il2Cpp `MarshalMetaInfo` writers);
- Hot path must **not** allocate `object[]` per call (unless boxing is required by the spec itself).

`[LuaMarshalAs]`: Emit reads attributes to choose pop/push strategy (align [../../spec/marshal/02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/).

## 7. Boundary with GetFunction / Delegate

| Path | Implementation |
|------|----------------|
| Lua→C# members | **Emit/** (this doc) |
| C#→Lua `GetFunction` | `DelegateImpl/` + `LuaCallInvoker` (not Emit) |
| Lua function → C# delegate | `DelegateImpl/` Expression (Phase 4) |

Do not store C#→Lua delegate bridge logic under the Emit directory.

## 8. Suggested layout

```
Emit/
├── FieldEmitter.cs
├── PropertyEmitter.cs
├── MethodEmitter.cs
├── ConstructorEmitter.cs
├── MemberTableEmitter.cs   // Fill three tables + BindCall
├── BridgeMarshaling.cs
├── EmitMethods.cs          // MethodInfo cache for Expression
├── ClosurePin.cs
└── EmitException.cs
```

Namespace: `ZLua.Emit`. Finer overload (better-member) and `OverloadDispatchEmitter` may split later.

## 9. Acceptance

- [x] Unsupported signatures at bind → `EmitException`; no silent Invoke
- [ ] Three-table members match Il2Cpp member set (same type public API)
- [x] Hot path has no `Method.Invoke`, no `object[]` arg arrays (Field uses `FieldInfo.Get/SetValue`)
- [ ] Overload selects same overload as Il2Cpp (currently arity MVP)
- [x] MetaBinding / closures have no methodId upvalue
- [ ] `Tests/Lua/manifest.lua` Phase 3 cases all green

## 10. Related docs

- Three-table attach: [../metatable/INDEXER-MONO.md](/docs/impl/metatable/INDEXER-MONO/)
- Overload: [../marshal/OVERLOAD-RESOLVER.md](/docs/impl/marshal/OVERLOAD-RESOLVER/)
- Il2Cpp stub counterpart: [STUBS-IL2CPP.md](/docs/impl/codegen/STUBS-IL2CPP/)
