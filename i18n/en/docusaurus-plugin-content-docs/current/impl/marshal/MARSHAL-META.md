---
sidebar_position: 6
title: "MarshalMeta and Writers"
---

# MarshalMeta and Writers

> **Il2Cpp:** `marshal/MarshalMeta.cpp`, `marshal/MarshalDefs.h`
> **Mono:** `Runtime/Mono/Marshaling/MarshalDefs.cs` and `TypedMarshal` / `PrimitiveMarshal` / `ObjectMarshal`, etc.
> **Spec:** [../../spec/marshal/](/docs/spec/marshal/) (Default / MarshalAs / per-type push-pop rules)

## 1. Core struct: `MarshalMetaInfo`

Defined in `MarshalDefs.h`:

```cpp
struct MarshalMetaInfo {
    FnMarshalLua2Cs lua2csWriter;   // Lua stack → C# memory
    FnMarshalCs2Lua cs2luaWriter;   // C# memory → Lua stack
    const Il2CppType* type;
    Il2CppClass* typeKlass;         // Declared-type façade
    int32_t size;                   // Non-ref value-type bytes; reference types sizeof(void*)
    int luaByValRefIndex;           // Lazy-bound ByVal IMT ref
    int luaByObjRefIndex;           // Lazy-bound ByObj IMT ref
    bool passByValue;               // Whether bridge alloca path passes by value
};
```

Writers are **function pointers**, resolved once at bind time; no reflection at runtime:

```cpp
typedef void (*FnMarshalLua2Cs)(lua_State* L, int valueIdx, void* address, const MarshalMetaInfo* ctx);
typedef void (*FnMarshalCs2Lua)(lua_State* L, void* address, const MarshalMetaInfo* ctx);
```

Mono Phase 1+ simulates the same “fixed at bind, direct call at runtime” semantics with managed delegates / compiled closures.

## 2. Creation entry: `MarshalMeta::Create`

| Overload | Use |
|----------|-----|
| `Create(L, MethodInfo*, argIndex)` | Method parameter; `argIndex == -1` means **return value** |
| `Create(L, FieldInfo*)` | Field offset R/W |
| `Create(L, PropertyInfo*)` | property (often forwards to accessor MethodInfo) |

Create flow (Il2Cpp):

1. Classify by `Il2CppType*` (primitive / string / enum / class / struct / array / delegate / pointer …);
2. Pick predefined `Lua2CSMarshalXxx` / `CS2LuaMarshalXxx` or `ObjectMarshal` / `StructMarshal` / `OpaqueValueMarshal` subpaths;
3. Apply `[LuaMarshalAs]` if present → switch `LuaMarshalType` (UserData, Bytes, Opaque, Table, UnpackedValues, etc.; see spec [02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/));
4. Fill `size`, `passByValue`, `typeKlass`;
5. `luaByValRefIndex` / `luaByObjRefIndex` start as `LUA_NOREF`; first push lazily binds via `EnsureByValMetatableRefSlow`.

Allocator: `LuaMetadataAlloc` (AppDomain lifetime, coexists with `LuaEnv`).

## 3. Writer dispatch matrix (Default path)

| CLR category | lua2cs | cs2lua | Implementation file |
|--------------|--------|--------|---------------------|
| void | no-op | no-op | Inline in `MarshalMeta.cpp` |
| bool / integers / floats | `PrimitiveMarshal::Pop*` | `Push*` | `PrimitiveMarshal.cpp` |
| char / string | `StringMarshal` | Same | `StringMarshal.cpp` |
| enum | Underlying integer writer | Same | `PrimitiveMarshal` + metadata |
| class / interface / object | `ObjectMarshal` | Same | `ObjectMarshal.cpp` |
| struct ByVal | `StructMarshal` copy-in | copy-out / push userdata | `StructMarshal.cpp` |
| struct ByObj | boxed / ByObj userdata | Same | `StructMarshal.cpp` |
| array | `ArrayMarshal` | Same | `ArrayMarshal.cpp` |
| delegate | `DelegateMarshal` | Same | `DelegateMarshal.cpp` |
| IntPtr / pointer | `OpaqueValueMarshal` | Same | `OpaqueValueMarshal.cpp` |
| Vector2/3/4 etc. | `IntrinsicTypes` | Same | `IntrinsicTypes.cpp` |

Concrete rules and `[LuaMarshalAs]` overrides are in the spec fascicles; **this doc does not repeat** the Lua-visible conversion tables.

## 4. Relation to bind contexts

### 4.1 Field: `FieldMarshalCtx`

```cpp
struct FieldMarshalCtx {
    const MarshalMetaInfo* meta;
    const FieldInfo* field;
    union {
        void* staticAddress;              // Static field
        int32_t instanceOffsetIncludingHeader;  // Instance field (incl. userdata header)
    };
};
```

Indexer reads field via `cs2luaWriter(L, fieldPtr, meta)` (inside `Dispatch*` `__index`).

### 4.2 Property: `PropertyMarshalCtx`

Contains `FnPropertyGetter` / `FnPropertySetter` (usually pointing at `PropertyBridge` stubs), `getterSealed` / `setterSealed` (virtual-call optim), `valueTypeKlass`.

When property does **not** use a separate `MarshalMetaInfo` getter function-pointer branch, `PropertyBridge::InvokeGetter` dispatches internally to generated stubs.

### 4.3 Method: `MethodMarshalCtx`

```cpp
struct MethodMarshalCtx {
    const MethodInfo* method;
    FnResolveMethodThis resolveThis;
    FnLua2CsInvoker lua2CsInvoker;      // Often generated stub or DefaultInvokeLuaMethod
    const MarshalMetaInfo** paramsMeta;
    const MarshalMetaInfo* retMeta;
    int32_t valueSize;
    int32_t totalParamsSize;
    bool byVal;
    bool sealed;
};
```

`MetaBinding::CreateMethodMarshalCtx` builds one per AOT method; each param/ret calls `MarshalMeta::Create` once.

## 5. `TypedMarshal.h` façade

`TypedMarshal::PushByType` / `PopByType`: dynamic push/pop by `Il2CppType*` when **not** bound to a member (temporary delegate-invoke paths, `zlua.cast`, etc.).

Relation to `MarshalMetaInfo`: the façade reuses the same writer logic or temporarily creates meta.

## 6. Codegen-side Meta

Editor `MarshalMetaUtil` (C#) analyzes at **build time** for stub generation:

- `LuaMarshalMetaInfo` / `ParamMarshalInfo` → bridge signatures written into `MethodBridgeStub.h`;
- Independent from runtime `MarshalMeta::Create` but **rule-aligned** (both follow spec marshal).

`MarshalAsCodegen` generates `MarshalBindings.*` extended writers.

## 7. Mono alignment notes

| Il2Cpp | Mono (Phase 1–2 status / Phase 3 goal) |
|--------|----------------------------------------|
| `FnMarshalLua2Cs` function pointer | Emit-generated typed pop sequence or static helper |
| `MarshalMeta::Create` | Bind-time `MarshalMeta` descriptor (`MarshalDefs.cs` extensions) |
| `EnsureByValMetatableRef` | `MetatableHooks.PushByValMetatable(type)` |

Mono Emit bridges must **not** re-`MarshalMeta::Create` on every call; cache layout at bind time.

## 8. Performance notes

- Writer bodies are **outside** `Dispatch*` indexer optimization (see [../metatable/INDEXER-IL2CPP.md](/docs/impl/metatable/INDEXER-IL2CPP/).
- `DefaultInvokeLuaMethod` (when no dedicated stub) uses alloca + per-arg writers, slower than generated stubs; Player should cover hot-path signatures.

## 9. Related files

| File | Responsibility |
|------|----------------|
| `marshal/MarshalMeta.cpp/.h` | Create, Ensure*MetatableRef |
| `marshal/MarshalDefs.h` | All marshal context structs |
| `marshal/TypedMarshal.cpp/.h` | Push/Pop façade |
| `marshal/PrimitiveMarshal.*` … | Type writer implementations |
| `Editor/CppCodeGen/MarshalMetaUtil.cs` | Build-time meta analysis |
