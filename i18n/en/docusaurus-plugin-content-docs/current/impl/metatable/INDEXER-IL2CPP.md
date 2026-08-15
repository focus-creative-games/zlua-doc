---
sidebar_position: 10
title: "Il2Cpp Dispatch* Indexer"
---

# Il2Cpp Dispatch* Indexer

> **Source:** `mt/TypeRegistryCommon.cpp`, `mt/MetaBinding.cpp`
> **Semantic authority:** [../../spec/metatable/02-INDEX.md](/docs/spec/metatable/02-INDEX/)

## 1. Path

Il2Cpp Player member indexing uses native **`Dispatch*`** C closures: `__index` / `__newindex` with **one upvalue** (`TypeBinding*` lightuserdata).

`TypeRegistryCommon.cpp` fills IMT/SMT by calling `FillInstanceMetatable(..., DispatchInstanceIndex, DispatchInstanceNewIndex)`.

Static type table SMT uses symmetric `DispatchStaticIndex` / `DispatchStaticNewIndex` (lookup `binding->staticMap`).

## 2. Core data structures

### 2.1 `TypeBinding` (`MetaBinding.h`)

| Field | Use |
|-------|-----|
| `Il2CppClass* klass` | Declared type |
| `NameMetaMap staticMap` | Static members: name → `MetaInfo` |
| `NameMetaMap byobjInstanceMap` | Reference / struct ByObj instance members |
| `NameMetaMap byvalInstanceMap` | struct ByVal instance members |
| `MethodGroups* ctorGroups` | Constructor overload (not via indexer) |

`NameMetaMap` = `AppendOnlyStringHashMap<MetaInfo>`: written at bind time, read-only at runtime; key is member name string (Il2Cpp persisted name).

### 2.2 `MetaInfo`

```cpp
enum class MetaKind { Method, Field, Property };  // Event removed

struct MetaInfo {
    MetaKind kind;
    union {
        struct { int closureRef; } method;
        FieldMarshalCtx field;
        PropertyMarshalCtx property;
    };
};
```

- **Method:** `closureRef` is a registry direct bridge or dispatch closure.
- **Field:** `FieldMarshalCtx` (offset + `MarshalMetaInfo*` + `cs2luaWriter`).
- **Property:** `PropertyMarshalCtx` (getter/setter function pointers + sealed flags).

## 3. `DispatchInstanceIndex` algorithm

Template parameters:

- `ResolveInstanceMethodTargetFn` — resolve `this` (ByVal / ByObj value / reference type).
- `MetaTableKind` — choose `byvalInstanceMap` or `byobjInstanceMap`.

```cpp
template <ResolveInstanceMethodTargetFn resolveMethodTarget, MetaTableKind kind>
static int DispatchInstanceIndex(lua_State* L)
{
    TypeBinding* binding = (TypeBinding*)lua_touserdata(L, lua_upvalueindex(1));
    const char* key = luaL_checkstring(L, 2);
    const MetaInfo* info = LookupMeta(map, key);
    if (info == nullptr) {
        return luaL_error(L, "zlua: member not found: %s.%s", typeFullName, key);
    }
    switch (info->kind) {
    case MetaKind::Method:
        return LuaUtil::PushRef(L, info->method.closureRef);
    case MetaKind::Field:
        writer(L, fieldPtr, meta); return 1;
    case MetaKind::Property:
        PropertyBridge::InvokeGetter(L, target, &info->property); return 1;
    }
}
```

**Spec alignment:**

| Spec requirement | Dispatch* behavior |
|------------------|--------------------|
| method returns closure directly | `PushRef(closureRef)`, no call |
| field/property auto-invoke getter | Call writer/getter inside C closure |
| `__index` miss | `luaL_error` (`zlua: member not found: …`; **forbid** `lua_pushnil`) |
| method preferred over same-named field | Resolved when `MetaBinding` writes map; single-table lookup |

### 3.1 Instance variant entry points

| C closure | Map | this resolution |
|-----------|-----|-----------------|
| `InstanceByValIndex` | `byvalInstanceMap` | `ResolveByValMethodTarget` |
| `InstanceByObjIndex` | `byobjInstanceMap` (boxed value type) | `ResolveByObjValueTypeMethodTarget` |
| `InstanceReferenceIndex` | `byobjInstanceMap` | `ResolveByObjReferenceMethodTarget` |

`FillInstanceMetatable` binds the matching Index/NewIndex pair when creating IMT.

## 4. `DispatchInstanceNewIndex`

```cpp
const MetaInfo* info = LookupMeta(map, key);
if (info == nullptr)
    return luaL_error(L, "zlua: member not found: %s", key);
// Field → lua2csWriter; Property → PropertyBridge::InvokeSetter
// Method / no setter → error
```

On miss → **strict error** (per spec). Read-only field (`cs2luaWriter == nullptr` on write attempt) errors in the field branch.

## 5. Bind time: `MetaBinding`

`MetaBinding::EnsureBinding(Il2CppClass*)` on **first** `import_type` / type touch:

1. Flatten public instance/static members into three maps.
2. Create `MethodMarshalCtx` per method; single overload → `CreateDirectMethodClosureRef`; multi → `CreateMethodDispatchClosureRef` + `MethodGroups`.
3. Write Field/Property into `MetaInfo`; `Dispatch*` looks up the same map at runtime.

**Event:** No `MetaKind::Event`; `add_*` / `remove_*` enter the map as ordinary methods.

Direct method closure upvalue layout:

- `[1]` ClosureKind (number)
- `[2]` `TypeBinding*`
- `[3]` `MethodMarshalCtx*`

Dispatch closures also carry `MethodGroups*` upvalue.

## 6. Cooperation with `TypeRegistryCommon`

| Function | Responsibility |
|----------|----------------|
| `WriteCommonTypeFields` | `__fullname`, `__typeid`, `__klass`, etc. |
| `RegisterStaticLiteralFields` | enum/const written directly on type table T |
| `FillInstanceMetatable` | `__type`, `__udkind`, `__gc`, `Dispatch*` |
| `AttachStaticMetatable` | SMT + `__call` (ctor dispatch) |
| `PushTypeTable` | Ensure `MetaBinding::EnsureBinding` has run |

`MetaTableCache` caches `(Il2CppClass* → IMT ref, SMT ref)` to avoid rebinding tables.

## 7. Hot-path cost

Each `obj.field` / `obj:Method` **member fetch** via Dispatch* has fixed overhead:

1. Lua: look up mt → call C `__index` closure
2. C: `lua_touserdata` + `luaL_checkstring` + `LookupMeta` (string hash)
3. Method extra: `lua_rawgeti(REGISTRY, closureRef)`

**Note:** This path does **not** change Lua-visible semantics in [../../spec/metatable/02-INDEX.md](/docs/spec/metatable/02-INDEX/); only the implementation mechanism differs.

## 8. Debugging

- On `LookupMeta` miss → **`luaL_error`** (**not** `pushnil`), and **do not** call C# reflection fallback (spec forbids).
- When comparing with Mono, Il2Cpp and Mono miss/member sets should match (Mono uses Lua three-table indexer; see [INDEXER-MONO.md](/docs/impl/metatable/INDEXER-MONO/)).

## 9. Related files

| File | Contents |
|------|----------|
| `mt/TypeRegistryCommon.cpp` | `Dispatch*` templates, `FillInstanceMetatable` |
| `mt/MetaBinding.cpp` | Map fill, closure ref creation |
| `mt/InstanceTarget.cpp` | this / field addresses |
| `bridge/PropertyBridge.cpp` | getter/setter invoke |
| `marshal/MarshalMeta.cpp` | Field writer function pointers |
