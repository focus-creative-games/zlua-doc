---
sidebar_position: 9
title: "ObjectRegistry / StructRegistry"
---

# ObjectRegistry / StructRegistry

> **Il2Cpp:** `marshal/ObjectRegistry.cpp`, `marshal/StructRegistry.cpp`
> **Mono:** `Runtime/Mono/Marshaling/ObjectRegistry.cs`, `StructRegistry.cs`
> **Semantics:** [../../spec/10-LIFETIME.md](/docs/spec/10-LIFETIME/), [../../spec/marshal/06-CLASS.md](/docs/spec/marshal/06-CLASS/), [../../spec/marshal/05-STRUCT.md](/docs/spec/marshal/05-STRUCT/)

## 1. Responsibility overview

| Registry | Manages | Purpose |
|----------|---------|---------|
| **ObjectRegistry** | ByObj userdata (reference types, struct ByObj, boxed enum, etc.) | `(obj, viewType)` weak-cache reuse + **slot strong refs** so Lua GC cannot drop the C# object |
| **StructRegistry** | non-blittable **ByVal** userdata payload | Let GC scan managed refs embedded in payload (Il2Cpp GC root / Mono boxed companion) |

Both register early in `LuaEnv` init and clean up in reverse on Shutdown.

## 2. ObjectRegistry

### 2.1 Userdata layout (`MarshalDefs.h`)

```cpp
struct ZLuaObjectUserData {
    UserDataHeader header;   // kind == ByObj
    uint32_t slotIndex;
    Il2CppObject* obj;
    Il2CppClass* viewKlass;  // Declared-type façade (IMT / cache key)
};
```

On Mono, `obj`/`viewType` live in the **slot table**; userdata keeps only `SlotIndex` (smaller userdata, unified release path).

**viewKlass / ViewType:** When the same C# instance is pushed under different declared types (interface, base), IMT and overload resolution need the declared type; cache key is the `(obj, viewKlass)` pair.

### 2.2 Slot strong refs (Slot Registry)

Il2Cpp `ObjectSlotRegistry` / Mono `ObjectSlotRegistry`:

- Preallocated array (initial 1024, doubles on growth);
- `Register` returns `slotIndex`; userdata `__gc` calls `Unregister` and returns the index to a free stack;
- **Strong-references** the C# object until the corresponding userdata is Lua-GC'd.

This ensures that while Lua still holds the userdata, C# will not collect the object for lack of other references.

### 2.3 Weak cache (Identity + View)

Il2Cpp:

- One **weak-value** Lua table in the registry (`s_objectCacheRef`);
- C++ `HashMap<ObjectViewKey, int>` records `(obj, viewKlass) → integer key in cache table`;
- Hit reuses existing userdata, avoiding duplicate push.

Mono: same semantics, `Dictionary<ObjectViewKey, int>` + registry weak table.

**Push flow (conceptual):**

1. Look up weak cache `(obj, viewType)`;
2. miss → allocate slot → create full userdata → set metatable (`MetaTableCache` / `MetatableHooks`) → write cache.

### 2.4 Pop / This resolution

- `Pop(L, idx)` → restore `Il2CppObject*` / `object`, validate kind;
- `PopThis` → ByObj only, for bridge hot path;
- Aligns with identity rules in [../../spec/marshal/06-CLASS.md](/docs/spec/marshal/06-CLASS/).

### 2.5 `__gc`: `OnReleaseObjectUserData`

1. Read `slotIndex` from userdata;
2. `UnregisterObject(slotIndex)`;
3. Remove `(obj, view)` entry from weak cache (if still mapped to this userdata).

`LuaEnv::AddPendingRef` / `ProcessPendingRefReleases`: if bind-time needs deferred `luaL_unref`, batch-release at a safe point to avoid GC-callback reentrancy.

### 2.6 Initialize / Shutdown

**Initialize(L):** Create weak cache table and `luaL_ref`; init slot array.

**Shutdown(L):** Clear map, release all slots, unref cache table.

Order: Initialize before `MetaTableCache`; Shutdown after `MetaTableCache`, before `lua_close`.

## 3. StructRegistry

### 3.1 When it applies

**Only non-blittable struct ByVal userdata:** payload may contain `string`, reference-type fields, etc.; Lua GC does not automatically scan raw userdata memory.

Blittable struct ByVal: do **not** register with StructRegistry; IMT may attach `nullptr` `__gc` (see `TypeRegistryCommon` branch on `klass->is_blittable`).

### 3.2 Il2Cpp implementation

```cpp
struct ByValUserDataHeader {
    UserDataHeader header;  // kind == ByVal
    Il2CppClass* klass;
    // payload follows
};

static void Register(ByValUserDataHeader* header);
static void Unregister(ByValUserDataHeader* header);
```

- `Register`: mark refs inside payload as GC roots (or equivalent tracking);
- `OnReleaseByValUserData` (`__gc`): `Unregister`.

### 3.3 Mono implementation

Mono has no Il2Cpp-style embedded GC scan; uses a **boxed companion**:

```csharp
static Dictionary<IntPtr, object> s_boxedByUserData;

RegisterBoxed(userdataPtr, boxed);  // on push
Unregister(userdataPtr);            // on __gc
```

The boxed object holds a struct copy and strong refs to nested references until ByVal userdata is released.

### 3.4 Boundary with Mt

`StructRegistry` lives in `marshal/`; does **not** include `mt/`. Metatable refs come from `MetaTableCache` / `MetatableHooks.PushByValMetatable`.

## 4. Mono `MetatableHooks`

Injected in `MarshalDefs.cs`:

```csharp
internal static class MetatableHooks {
    internal static Action<IntPtr, Type> PushByObjMetatable;
    internal static Action<IntPtr, Type> PushByValMetatable;
}
```

`Mt` assigns these at startup to avoid a hard `Marshal → Mt` dependency, matching Il2Cpp layering.

## 5. Comparison table

| Behavior | Il2Cpp | Mono |
|----------|--------|------|
| ByObj slots | `Il2CppObject**` array | `ObjectSlot[]` |
| Weak cache | weak-values registry table | Same |
| view key | `Il2CppClass* viewKlass` | `Type ViewType` |
| non-blittable ByVal GC | `StructRegistry` root | boxed companion dict |
| `__gc` entry | C closure on IMT | `GetFunctionPointerForDelegate` + pin |

## 6. Common invariants

- Metadata pointers `Il2CppClass*` / `MethodInfo*` etc. are **non-null by default** on hot paths (workspace rule); Registry APIs do not re-null-check viewKlass.
- The same `(obj, view)` cache entry within one Lua thread should point at the **same** userdata until that userdata is GC'd.
- Shutdown must `ProcessPendingRefReleases` first, then tear down Registry, then `lua_close`.

## 7. Related files

| Il2Cpp | Mono |
|--------|------|
| `marshal/ObjectRegistry.h/.cpp` | `Marshaling/ObjectRegistry.cs` |
| `marshal/StructRegistry.h/.cpp` | `Marshaling/StructRegistry.cs` |
| `marshal/ObjectMarshal.cpp` | `Marshaling/ObjectMarshal.cs` etc. |
| `marshal/StructMarshal.cpp` | `Marshaling/StructMarshal.cs` |
| `mt/MetaTableCache.cpp` | `Mt/MetaTableCache.cs` |
