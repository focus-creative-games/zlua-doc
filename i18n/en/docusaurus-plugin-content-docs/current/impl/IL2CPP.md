---
sidebar_position: 5
title: "Il2Cpp Implementation Map"
---

# Il2Cpp Implementation Map

> **Editable source root:** `build-win64/Il2CppOutputProject/IL2CPP/libil2cpp/zlua`
> **In-package mirror (manual sync; do not edit directly):** `Packages/com.code-philosophy.zlua/ZLua~/libil2cpp-2022/zlua`
> **Lua-visible semantics:** [../spec/](/docs/spec/00-OVERVIEW/) — this doc only covers C++ module layout, init order, and file responsibilities.

## 1. Module map

The Il2Cpp runtime splits into seven top-level directories, aligned 1:1 with rewritten Mono `Runtime/Mono/` (see [MONO.md](/docs/impl/MONO/) §2).

```
zlua/
├── lvm/          Host lifetime, Lua state, ZLuaLib, InternalCall, Loader
├── mt/           Type registration, metatable binding, member index (`Dispatch*` + `MetaBinding`)
├── marshal/      Push/Pop, Registry, MarshalMeta, Overload resolution
├── bridge/       Method / Property / Field / Delegate call bodies
├── generated/    Build-time Codegen output (stub tables, BuiltinScripts.inc)
├── utils/        Cross-cutting: MetadataUtil, exceptions, stack guard, allocators
├── ZLuaCommon.*  Shared headers, macro gates, ABI with Lua VM
└── LuaConsts.h   Metatable field names, userdata kind constants
```

**Dependency direction (hard constraint):**

- `marshal/` must **not** `#include` `mt/` (Mt via `MetatableHooks` callbacks or upper assembly).
- `bridge/` may depend on `marshal/` and `generated/`; `mt/` calls `bridge/` and `MarshalMeta` at bind time.
- `generated/` is referenced only by `lvm/` and `bridge/`; it does not participate in runtime logic branches.

## 2. Initialization order

### 2.1 AppDomain level (`lvm/LuaAppDomain.cpp`)

After the Player process enters Il2Cpp, managed code calls `LuaAppDomain::Initialize()` in fixed order:

| Step | Call | Responsibility |
|------|------|----------------|
| 1 | `LuaMetadataAlloc::Initialize()` | Bind-time metadata heap (`MethodMarshalCtx`, `MarshalMetaInfo`, etc.) |
| 2 | `MetadataUtil::Initialize()` | Assembly / type / method resolution caches |
| 3 | `PropertyBridge::Initialize()` | Load getter/setter function table from `generated/PropertyBridgeStub.h` |
| 4 | `MethodBridge::Initialize()` | Load `lua2CsInvoker` table from `generated/MethodBridgeStub.h` |
| 5 | `DelegateBridge::Initialize()` | Load `generated/DelegateBridgeStub.h` |
| 6 | `LuaInternalCalls::RegisterCoreInternalCalls()` | Core InternalCalls |
| 7 | `LuaLoader::RegisterRoots()` | StreamingAssets / module search roots |
| 8 | `LuaEnv::Initialize()` | Create `lua_State` and finish Lua-side bootstrap (next section) |

Optional: `LuaAppDomain::InitializeFromManaged(Il2CppDelegate*)` injects a managed `moduleLoader` delegate after step 8.

### 2.2 Lua state level (`lvm/LuaEnv.cpp`)

`LuaEnv::Initialize()` runs on a **single global** `lua_State*`:

| Step | Call | Responsibility |
|------|------|----------------|
| 1 | `luaL_newstate()` | Allocate VM |
| 2 | `RegisterGlobals()` | `__ZLUA_IL2CPP_PLAYER__=true`; embed `globals.lua` (`generated/BuiltinScripts.inc`); cache `__zluaErrorHandler` ref |
| 3 | `RegisterLibs()` | `luaL_openlibs`; redirect `print` → Unity `Debug.Log`; `ZLuaLib::RegisterGlobals` + embed `zlualib.lua` |
| 4 | `ObjectRegistry::Initialize(L)` | ByObj weak cache table + slot strong-ref table |
| 5 | `StructRegistry::Initialize(L)` | non-blittable ByVal GC root registration |
| 6 | `MetaTableCache::Initialize(L)` | Type metatable registry cache |
| 7 | `LuaLoader::InstallHooks()` | `package.searchers` / custom loader |
| 8 | `AssemblyRegistry::InitializeCSharpRoot(L)` | Attach `csharp` root table; deferred type-bind entry |

**Shutdown** (`LuaEnv::Shutdown`) releases in **reverse** order: `ProcessPendingRefReleases` → `MetaTableCache` → `StructRegistry` → `ObjectRegistry` → `LuaGlobalRefs::Clear` → release error handler ref → `lua_close` → `LuaLoader::Clear`.

## 3. File → responsibility table

### 3.1 `lvm/`

| File | Responsibility |
|------|----------------|
| `LuaAppDomain.cpp/.h` | Il2Cpp entry: `Initialize` / `InitializeFromManaged` / `Shutdown` forwarding |
| `LuaEnv.cpp/.h` | Global `lua_State`, globals/libs registration, error handler, dostring, pending ref queue |
| `ZLuaLib.cpp` | C API: `zlua.import_type`, `zlua.cast`, `zlua.box`, etc. (semantics: [../spec/05-LIB.md](/docs/spec/05-LIB/)) |
| `LuaInternalCalls.cpp/.h` | InternalCall registration |
| `LuaGlobalRefs.cpp/.h` | Centralized registry strong refs |
| `LuaLoader.cpp/.h` | Module search, StreamingAssets loader, managed delegate loader |

### 3.2 `mt/`

| File | Responsibility |
|------|----------------|
| `AssemblyRegistry.cpp/.h` | `csharp` root; assembly scan triggered by `import_type` |
| `TypeRegistry.cpp/.h` | Type façade dispatch entry (reference / valuetype / array / enum) |
| `TypeRegistryCommon.cpp/.h` | Shared: type-table fields, IMT/SMT fill, `Dispatch*` attach |
| `TypeRegistryReference.cpp/.h` | class / interface / delegate binding |
| `TypeRegistryValueType.cpp/.h` | struct / Nullable binding |
| `TypeRegistryArray.cpp/.h` | Array types, `__len` |
| `MetaBinding.cpp/.h` | Bind-time scan of public members → `NameMetaMap`; build method closure refs; overload groups |
| `MetaTableCache.cpp/.h` | Cache IMT/SMT registry refs by `Il2CppClass*` |
| `InstanceTarget.cpp/.h` | userdata → `this` pointer / ByVal payload address resolution |

### 3.3 `marshal/`

| File | Responsibility |
|------|----------------|
| `TypedMarshal.cpp/.h` | Push/Pop façade dispatched by `Il2CppType*` |
| `MarshalMeta.cpp/.h` | Create `MarshalMetaInfo` and writer function pointers for field/property/method params |
| `MarshalDefs.h` | Core structs: `MarshalMetaInfo`, `MethodMarshalCtx`, `MethodGroups`, `ConversionKind`, etc. |
| `ObjectRegistry.cpp/.h` | ByObj userdata: `(obj, viewKlass)` weak cache + slot strong refs |
| `StructRegistry.cpp/.h` | non-blittable ByVal: GC root tracking |
| `ObjectMarshal.cpp/.h` | Reference-type push/pop |
| `StructMarshal.cpp/.h` | Value-type ByVal/ByObj |
| `PrimitiveMarshal.cpp/.h` | Primitive R/W |
| `StringMarshal.cpp/.h` | string |
| `ArrayMarshal.cpp/.h` | arrays |
| `DelegateMarshal.cpp/.h` | delegate / Lua function |
| `OpaqueValueMarshal.cpp/.h` | opaque / lightuserdata path |
| `IntrinsicTypes.cpp/.h` | Built-in struct specializations (Vector2/3/4, etc.) |
| `MethodOverloadResolver.cpp/.h` | Runtime overload selection (spec [../spec/04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/)) |

Details: [marshal/README.md](/docs/impl/marshal/).

### 3.4 `bridge/`

| File | Responsibility |
|------|----------------|
| `MethodBridge.cpp/.h` | Resolve stub table → `FnLua2CsInvoker`; default alloca + writer slow path |
| `PropertyBridge.cpp/.h` | property getter/setter stub dispatch |
| `FieldBridge.cpp/.h` | Field offset R/W (with `FieldMarshalCtx`) |
| `DelegateBridge.cpp/.h` | C# delegate ↔ Lua function; **C#→Lua `GetFunction` calls** also go here |
| `BridgeDefs.h` | Shared bridge typedefs |

### 3.5 `generated/` (build output; do not hand-edit)

| Artifact | Generator | Responsibility |
|----------|-----------|----------------|
| `MethodBridgeStub.h` | `MethodBridgeCodegen` | One `Bridge_*` + `lua2CsInvoker` entry per AOT method |
| `PropertyBridgeStub.h` | `PropertyBridgdeCodegen` | property accessor stubs |
| `DelegateBridgeStub.h` | `DelegateBridgeCodgen` | delegate invoke stubs |
| `MarshalBindings.*` | `MarshalAsCodegen` | `[LuaMarshalAs]` extended writers |
| `BuiltinScripts.inc` | `BuiltinScriptsCodegen` | Embed `globals.lua` / `zlualib.lua` |

Details: [codegen/STUBS-IL2CPP.md](/docs/impl/codegen/STUBS-IL2CPP/).

### 3.6 `utils/`

| File | Responsibility |
|------|----------------|
| `MetadataUtil.cpp/.h` | Il2Cpp reflection: type lookup, method sealed checks, value size |
| `LuaException.cpp/.h` | C++ → managed exception / Lua error |
| `LuaUtil.cpp/.h` | registry refs, strings, stack helpers |
| `LuaStackGuard.h` | RAII stack balance |
| `LuaMetadataAlloc.cpp/.h` | Bind-time allocator |
| `Collection.h` | Bind-time containers such as `AppendOnlyStringHashMap` |

## 4. Comparison with Mono

| Dimension | Il2Cpp | Mono |
|-----------|--------|------|
| Member index | `Dispatch*` + `MetaBinding` / `TypeRegistry` ([INDEXER-IL2CPP.md](/docs/impl/metatable/INDEXER-IL2CPP/)) | Lua three-table indexer ([INDEXER-MONO.md](/docs/impl/metatable/INDEXER-MONO/)) |
| Lua→C# bridge | Codegen **stub reuse** (by ReducedType signature) | **Emit/** per-member `Expression.Compile` |
| C#→Lua | `GetFunction` + Delegate bridge (`LuaCallInvoker`) | Same |
| Event | Dedicated metadata removed; `add_*`/`remove_*` are ordinary methods | Same |

## 5. Related docs

- Metatable implementation: [metatable/README.md](/docs/impl/metatable/)
- Marshal implementation: [marshal/README.md](/docs/impl/marshal/)
- Codegen: [codegen/README.md](/docs/impl/codegen/)
- Mono implementation map: [MONO.md](/docs/impl/MONO/)
