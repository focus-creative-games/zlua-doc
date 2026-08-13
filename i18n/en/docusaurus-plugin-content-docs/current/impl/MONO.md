---
sidebar_position: 13
title: "Mono Implementation Notes"
---

# Mono Implementation Notes

> **Source root:** `Packages/com.code-philosophy.zlua/Runtime/Mono/`
> **Lua-visible semantics:** [../spec/](/docs/spec/00-OVERVIEW/) — this doc covers Editor Mono layout, init, and differences from Il2Cpp.

## 1. Background and goals

The old `Runtime/Mono` was backed up to `_archive/Mono-pre-rewrite-20260723/` and rewritten from scratch. Goal: **Editor development** matches Il2Cpp Player **interaction behavior**, with directories readable against Il2Cpp `zlua/` modules.

Mono member indexing uniformly uses Lua three-table closures (see [metatable/INDEXER-MONO.md](/docs/impl/metatable/INDEXER-MONO/).

## 2. Directory mapping

```
Runtime/Mono/              ←→  Il2Cpp zlua/
├── Lvm/                   ←→  lvm/
├── Mt/                    ←→  mt/
├── Marshaling/            ←→  marshal/     (must not depend on Mt; avoid System.Marshal clash)
├── Bridge/                ←→  bridge/
├── Emit/                  ←→  generated/   (runtime Expression gen, not build-time stubs)
├── Utils/                 ←→  utils/
└── DelegateImpl/          ←    (avoid System.Delegate name clash)
```

**Namespaces:** `ZLua.Lvm` / `ZLua.Mt` / `ZLua.Marshaling` / `ZLua.Bridge` / `ZLua.Emit` / `ZLua.Utils` / `ZLua.DelegateImpl`.

**Entry type name kept:** `LuaMonoAppDomain` remains in root namespace `ZLua` for Common reflection; Il2Cpp counterpart is `LuaAppDomain`.

## 3. Locked decisions

| # | Decision | Mono landing |
|---|----------|--------------|
| D1 | Delete old Mono; full rewrite | Current `Runtime/Mono/` is Phase 0–4 |
| D2 | Lua **three-table indexer**; no C# `Dispatch*` | `Mt/TypeMemberLuaIndexer.cs` |
| D3 | Cannot Expression-specialize → **explicit bind-time error** | `Emit/EmitException.cs` |
| D4 | C#→Lua unified **`GetFunction` + Delegate bridge**; delete legacy `object[]` slow path | `DelegateImpl/`, `Marshaling/DelegateMarshal.cs` |
| D5 | **No Event-specific support**; `add_Xxx`/`remove_Xxx` are ordinary methods | `MetaBinding` does not scan Event subtables |
| D6 | Il2Cpp reuses stubs; Mono **Emits one bridge per member** | `Emit/` vs Il2Cpp `generated/` |
| D7 | MetaBinding hot path has no `methodId` / `MethodMarshalCtx` upvalue | Emit closures bind `MethodInfo`/`FieldInfo` directly |
| D8 | Directories PascalCase; `generated/` → **`Emit/`** | See §2 |

## 4. Initialization order

### 4.1 AppDomain level (`Lvm/LuaMonoAppDomain.cs`)

First `LuaAppDomain.Initialize(moduleLoader)`:

| Step | Call | Il2Cpp counterpart |
|------|------|--------------------|
| 1 | `new LuaEnv()` | Main body of `LuaEnv::Initialize` |
| 1a | └ `luaL_openlibs` + `RegisterPrint` | First half of `RegisterLibs` |
| 1b | └ `ObjectRegistry.Initialize` | Same |
| 1c | └ `StructRegistry.Initialize` | Same |
| 1d | └ `MetaTableCache.Initialize` | Same |
| 1e | └ `TypeMemberLuaIndexer.EnsureLoaded` | Mono-only: load indexer factory |
| 2 | `SetModuleLoader(moduleLoader)` | `LuaLoader::SetModuleLoader` |
| 3 | `LoadBuiltinGlobals()` | `RegisterGlobals` |
| 4 | `AssemblyRegistry.EnsureCSharpRoot()` | `AssemblyRegistry::InitializeCSharpRoot` |
| 5 | `ZLuaLib.RegisterGlobals(_luaEnv)` | `ZLuaLib::RegisterGlobals` |
| 6 | `EnsureBuiltinZLuaLib()` | Embed `zlualib.lua` equivalent |
| 7 | `DelegateBridges.Warmup()` | Warmup for `DelegateBridge::Initialize` |

**Repeat Initialize:** Calling `Initialize` again when a main `lua_State` already exists → **throws** (use `LuaAppDomain.Reset`; **no** longer supports “swap loader only”).

**Reset:** Host schedules; `LuaFramePump` applies at **EndOfFrame**: internal teardown (same as Shutdown) + Initialize again per the table above. Public API has **no** `Shutdown`.

**Internal Shutdown / Dispose:** `ProcessPendingRefReleases` → `LuaEnv.Dispose()` (reverse-order Registry / MetaTableCache release; see `LuaEnv.cs`).

Il2Cpp additionally loads stub tables early at AppDomain level (`MethodBridge::Initialize`, etc.); Mono bridges are written into the three tables by **Emit at type bind** (Phase 3).

## 5. Phase progress and module landing

| Phase | Status | Highlights | Main files |
|-------|--------|------------|------------|
| 0 | ✅ | Backup, skeleton | `ZLua.asmdef` |
| 1 | ✅ | Lvm chain, ObjectRegistry, cast/box, struct ByVal/ByObj | `Lvm/LuaEnv.cs`, `Marshaling/*` |
| 2 | ✅ | `TypeRegistry*`, SMT/IMT, three-table indexer, `MetaBinding` scan | `Mt/TypeRegistry*.cs`, `Mt/MetaBinding.cs`, `Mt/TypeMemberLuaIndexer.cs` |
| 3 | ✅ | Emit into three tables; ctor/`__call`; arity overload MVP | `Emit/*`, `MemberTableEmitter.Fill` |
| 4 | ✅ | Delegate Emit, most of `ZLuaLib`, `GetFunction` Delegate bridge, delete legacy | `DelegateImpl/`, `Marshaling/DelegateMarshal.cs` |
| 5 | ✅ impl / ⏳ acceptance | NYI fill-in, Vector delegate catalog, MethodClosureTag, LuaAlias, Pointer/`params`; manifest pending Editor green | `Emit/*`, `Marshaling/PointerMarshal`, `ZLuaLib` |

**Phase 5:** `register_method` / `make_generic_method` / opaque get/set implemented; open generic methods write throw stubs + tags; Unity Vector delegate catalog added; `[LuaAlias]` matches Il2Cpp (alias replaces default key); Pointer lightuserdata + DynamicMethod; TypedReference/decimal/ByRefLike rejected at call time; `params T[]` marshals as array.

## 6. Key differences from Il2Cpp

| Topic | Il2Cpp | Mono |
|-------|--------|------|
| **Member index** | C `Dispatch*` + `MetaBinding` / `TypeRegistry` | Lua function `__index`/`__newindex` + three-table upvalues |
| **Lua→C# bridge** | Build-time C++ stubs; `MethodBridge::ResolveMethodInvoker` by signature | Bind-time `Expression.Compile()` → `lua_pushcfunction`; does **not** share ReducedType stubs |
| **MetaBinding context** | `MethodMarshalCtx` + registry ref closure | Specialized closures have **no** runtime methodId upvalue |
| **C#→Lua** | `GetFunction` + Delegate bridge | Same |
| **Legacy object[] path** | N/A | **Deleted** `RunLuaFunc(object[])` and similar slow paths |
| **Event** | No dedicated `MetaKind::Event` | No Event subtable; `add_*`/`remove_*` go into `methodTable` |
| **GC / performance** | Il2Cpp GC + slot pin | Slot strong refs + weak cache; non-blittable ByVal uses boxed companion |

Semantic acceptance follows [../spec/](/docs/spec/00-OVERVIEW/); different implementation paths are **allowed**, but miss/strict, overload, cast, struct, etc. must match Il2Cpp.

## 7. Acceptance criteria

After implementation:

- [ ] Editor Mono: `Tests/Lua/manifest.lua` all green
- [ ] Match Il2Cpp: type façade, `zlua.cast`, virtuals, overload, struct, delegate, arrays
- [ ] No Event-specific API; `add_`/`remove_` only as ordinary methods
- [ ] No `object[]` legacy slow path; no ReducedType shared bridge
- [ ] MetaBinding hot path has no `methodId` / MarshalCtx upvalue
- [ ] Hot path has no massive GC / `Method.Invoke` fallback

## 8. Related docs

- Il2Cpp module map: [IL2CPP.md](/docs/impl/IL2CPP/)
- Three-table indexer: [metatable/INDEXER-MONO.md](/docs/impl/metatable/INDEXER-MONO/)
- Expression Emit: [codegen/EMIT-MONO.md](/docs/impl/codegen/EMIT-MONO/)
- Codegen: [codegen/index.md](/docs/impl/codegen/) · Emit: [codegen/EMIT-MONO.md](/docs/impl/codegen/EMIT-MONO/)
