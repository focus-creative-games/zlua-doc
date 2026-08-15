---
sidebar_position: 11
title: "Mono Three-Table Indexer Implementation"
---

# Mono Three-Table Indexer Implementation

> **Source:** `Runtime/Mono/Mt/TypeMemberLuaIndexer.cs`
> **Semantic authority:** [../../spec/metatable/02-INDEX.md](/docs/spec/metatable/02-INDEX/)
> **Rewrite constraints:** [../MONO.md](/docs/impl/MONO/) D2, D5, D7

## 1. Design position

Mono Editor does **not** implement Il2Cpp's `DispatchInstanceIndex`. Member dispatch happens entirely **inside the Lua VM**: IMT/SMT `__index` / `__newindex` are Lua closures holding three ordinary tables via upvalues (method / fieldGetter / fieldSetter).

This matches the algorithm in spec §2–§4 **literally**, and is a hard Mono rewrite decision (see [../MONO.md](/docs/impl/MONO/) D2).

## 2. Bootstrap flow

### 2.1 One-time load (`EnsureLoaded`)

`LuaEnv` construction calls `TypeMemberLuaIndexer.EnsureLoaded(L)`:

1. `dostring` runs embedded `BootstrapChunk` (factory `bind_indexer`).
2. Factory returns `(index, newindex)` functions; factory itself is `luaL_ref`'d into registry (`_bindIndexerRef`).
3. Loaded **once** globally; each later type bind reuses the same factory ref.

Bootstrap looks up the three tables with **`rawget`**, so user-tampered table metatables cannot affect dispatch. Static and instance share the same factory; an `isStatic` boolean upvalue switches `__newindex` error prefixes.

### 2.2 Static SMT extrasTable

`BindStaticMetatable` passes the **SMT itself** as `extrasTable` into the factory. Thus `__index` can still `rawget(extrasTable, key)` after method/getter miss, for non-three-table members like `__call` (keys on SMT in [../../spec/metatable/01-LAYOUT.md](/docs/spec/metatable/01-LAYOUT/). Instance IMT has **no** extrasTable (`nil`).

### 2.3 Bind-time attach (`BindInstanceMetatable` / `BindStaticMetatable`)

For each `MemberTableSet` (three empty table refs already in registry):

1. `lua_rawgeti` the `_bindIndexerRef` factory.
2. `pushvalue` the three member tables (and optional extras).
3. `pcall(factory, 5, 2, 0)` → top `newindex`, next `index`.
4. **First** `lua_setfield(mt, "__newindex")`, **then** `lua_setfield(mt, "__index")` (matches pcall return order).

Closure upvalues hold **copied references** to the three tables (`pushvalue` at that moment), not registry indices; table bodies remain in registry under `MemberTableSet`, and Emit `rawset`s member closures into the same tables.

## 3. Three-table lifetime

| Phase | Behavior |
|-------|----------|
| Phase 2 | `TypeRegistryCommon.CreateEmptyMemberTableSet` creates three **empty** tables and refs; attach indexer; **do not write members** |
| Phase 3 (done) | `MemberTableEmitter.Fill` writes compiled closures per Map; replace `SMT.__call` |
| Static/instance isolation | `TypeBinding.StaticTables`, `ByObjInstanceTables`, `ByValInstanceTables` each have a set; upvalues **must not** be shared |
| struct ByVal/ByObj | Same instance member names, but **separate** IMT and three-table sets (isomorphic to Il2Cpp `byvalInstanceMap` / `byobjInstanceMap`) |

Registration order (avoid accidental static `__newindex`) matches the spec:

1. Build SMT (including `__call` placeholder).
2. `PushInstanceMetatable` → build IMT + three tables + bind indexer.
3. `lua_setfield(T, "__instance_mt")` (T has no SMT yet).
4. `lua_setmetatable(T, SMT)`.

## 4. Handoff with MetaBinding / Emit

### 4.1 Phase 2: `MetaBinding.EnsureBinding`

- Scan public method / field / property (including inheritance flatten).
- Write `TypeBinding.{Static,ByObj,ByVal}Map` (C# `Dictionary<string, MetaInfo>`).
- Do **not** create Lua closures; **no** Event-specific branch (D5).
- Same-named methods collected as `MethodOverloads` lists for Phase 3 overload dispatch.

### 4.2 Phase 3: Emit writes three tables (done)

| C# member | Target table | Closure behavior |
|-----------|--------------|------------------|
| Method (single overload) | `methodTable` | Return bridge directly; **do not** call |
| Method (multi-overload) | `methodTable` | arity dispatch (MVP: same arity first-wins) |
| Indexer property | `methodTable` | Temporarily Method path; full get/set_Item later |
| Field / no-arg Property getter | `fieldGetterTable` | `function(obj) return ... end` |
| Writable field / writable property | `fieldSetterTable` | `function(obj, value) ... end` |
| `add_*` / `remove_*` | `methodTable` | Same as ordinary methods |

**Forbidden:** field getters in `methodTable`; read-only properties in `fieldSetterTable`.

Emit failure (cannot Expression-generate for signature) → **`EmitException`**; inherited members may be skipped; failure on members declared by this type aborts binding (D3). Forbid silent `Method.Invoke` + `object[]`.

### 4.3 Hot-path constraints (D7)

Specialized bridge closures must **not** depend on:

- `MethodMarshalCtx*` upvalue
- methodId / registry indirect lookup
- Runtime string → C# dictionary

Closures should directly capture `MethodInfo`/`FieldInfo`/compiled delegates, aligned with Il2Cpp direct method closure semantics.

## 5. Miss and error messages

Aligned with [../../spec/metatable/02-INDEX.md](/docs/spec/metatable/02-INDEX/) §5:

| Scenario | Behavior |
|----------|----------|
| `__index` miss on all three tables | **`error`**: `zlua: member not found: {TypeFullName}.{key}` (**no** C# fallback; **no** `nil`) |
| `__newindex` setter miss but getter exists | `zlua: property is read-only: {key}` |
| `__newindex` total miss | `zlua: instance member not writable: {TypeFullName}.{key}` / static prefix variant |

With Phase 2 empty tables, any instance member access misses except keys written on type table `T` (e.g. enum constants). From Phase 3, written keys hit per the table above.

## 6. Performance notes

Versus old Mono C# `InstanceIndex` (P/Invoke + `tostring` + GC), the three-table Lua indexer is the same order of magnitude as xLua `obj_indexer` **without patching the VM**:

- method: `__index` frame + 1× `rawget(methodTable)`
- field: + 1× `rawget(fieldGetterTable)` + getter call

Mono and Il2Cpp implementation paths differ, but Lua-visible semantics must match (see [../../spec/metatable/02-INDEX.md](/docs/spec/metatable/02-INDEX/).

## 7. Implementation files

| File | Responsibility |
|------|----------------|
| `Mt/TypeMemberLuaIndexer.cs` | Bootstrap + BindInstance/StaticMetatable |
| `Mt/TypeRegistryCommon.cs` | Create empty three tables, attach SMT/IMT, registration order |
| `Mt/MetaBinding.cs` | Bind-time member scan → Map |
| `Mt/TypeRegistry*.cs` | Per type-family Common + EnsureBinding |
| `Emit/*` (Phase 3) | Write three-table closures |

## 8. Acceptance checklist

- [ ] Registered members: hot path has no C# `InstanceIndex` / `StaticTypeIndex`
- [ ] Unregistered: `__index` / `__newindex` → strict error (including `TypeFullName.key`)
- [ ] Static/instance three-table isolation; struct ByVal/ByObj each have instance three tables
- [ ] Inherited members flattened at bind; subclass overrides same-named keys
- [ ] No Event subtable; `add_Event` in `methodTable` as ordinary closure
- [ ] Mono and Il2Cpp member sets and miss/strict semantics match
