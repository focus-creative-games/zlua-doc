---
sidebar_position: 19
title: "Member index (`__index` / `__newindex`)"
---

# 02 — Member index (`__index` / `__newindex`)

This document specifies how Lua accesses C# **static members** (type table `T` + static metatable SMT) and **instance members** (userdata + instance metatable IMT) through **`__index` / `__newindex`**. The spec describes **Lua-visible semantics**; Mono implements this with Lua closures and three-table upvalues, while Il2Cpp uses a native indexer. Both (and any future VM fast paths) **must behave identically**.

**Related docs:** metatable layout → [01-LAYOUT.md](/docs/spec/metatable/01-LAYOUT/); how members are written into the three tables → [03-BINDING.md](/docs/spec/metatable/03-BINDING/); method overload closures → [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/).

---

## 1. Design motivation

Lua once considered giving `methodTable` a metatable whose `__index` handled fields. For **instance userdata**, a nested `__index` receives an intermediate **table** as its first argument, not the userdata, so instance fields cannot be read.

Therefore fields and methods are uniformly dispatched by an **indexer function that receives `(obj, key)`** (isomorphic to xLua `obj_indexer(obj, key)`). At bind time, members are split into three ordinary Lua tables; at runtime, tables are queried with `rawget` in a fixed order. The **hot path does not** call C# `InstanceIndex` / `StaticTypeIndex`, and does not convert keys to C# strings for reflective dictionary lookup.

**Strict miss:** reads and writes of unregistered members must raise a clear error with a `zlua:` prefix (including the key name). **`__index` must not** silently return `nil` (which would surface later as hard-to-diagnose `attempt to call/index a nil value`).

---

## 2. Three-table roles

Each binding (one static set, one instance set; structs have separate ByVal / ByObj instance three-tables with the same member names) builds three **ordinary Lua tables** at bind time, held by the indexer closure as upvalues or registry refs.

### 2.1 `methodTable`

| Member kind | Value in table | `__index` behavior |
|-------------|----------------|--------------------|
| Instance / static **methods** (including overload dispatch closures) | compiled bridge closure | **return directly**, do not call |
| **Indexer properties** (`this[...]`, parameterized properties) | wrapper closure / `get_Item` / `set_Item` dispatch, etc. | **return directly** |
| C# **event** `add_*` / `remove_*` | same as ordinary methods: **method closures** | **return directly** |
| Constructor metadata | **not in this table** (`SMT.__call`; see [01-LAYOUT.md](/docs/spec/metatable/01-LAYOUT/)) | — |

**Must not** place field getters or parameterless property getters in `methodTable`.

On the Lua side, events are invoked only via **`add_EventName` / `remove_EventName`** (and compiler-generated equivalent method names), entering `methodTable` like ordinary instance/static methods. There is **no** event-specific subtable (e.g. `{ get, set, fire }`), and `__newindex` assignment to an event name is not supported.

### 2.2 `fieldGetterTable`

| Member kind | Value in table | `__index` behavior |
|-------------|----------------|--------------------|
| **Fields** (instance / static) | getter closure: `function(obj) ... end` | `return getter(obj)` |
| **Parameterless readable properties** | same (compiled getter bridge) | `return getter(obj)` |

Read-only properties / readonly fields appear only in `fieldGetterTable`; `__newindex` for that key errors when `fieldSetterTable` misses (see §4).

If enum static constants are already written as **integers** directly on type table `T`, reading them does not go through this table.

### 2.3 `fieldSetterTable`

| Member kind | Value in table | `__newindex` behavior |
|-------------|----------------|------------------------|
| **Writable fields** | setter closure: `function(obj, value) ... end` | `setter(obj, value)` |
| **Parameterless writable properties** | same | `setter(obj, value)` |

Write-only properties appear only in `fieldSetterTable`; when `__index` misses both `methodTable` and `fieldGetterTable` but hits `fieldSetterTable`, raise **`zlua: property has no getter: {key}`** (must not return `nil`).

Readonly fields / read-only properties are **not** in this table; writes error after a `fieldSetterTable` miss.

### 2.4 Same-name conflicts

Key names are unique within one binding (static or instance). If a method and a property/field share a name (rare), **`methodTable` wins**: `__index` checks the method table first and does not consult the getter table on a hit.

---

## 3. `__index` algorithm

All table lookups use **`rawget`** so user-tampered metatables on the three tables cannot affect dispatch.

### 3.1 Instance userdata (IMT)

`obj` is full userdata (ByVal or ByObj). ByVal and ByObj use their respective IMT-bound instance three tables; the algorithm is the same:

```lua
local rawget = rawget

local function index(obj, key)
  local member = rawget(methodTable, key)
  if member ~= nil then
    return member
  end
  local getter = rawget(fieldGetterTable, key)
  if getter ~= nil then
    return getter(obj)
  end
  if rawget(fieldSetterTable, key) ~= nil then
    error("zlua: property has no getter: " .. typeFullName .. "." .. tostring(key))
  end
  error("zlua: member not found: " .. typeFullName .. "." .. tostring(key))
end
```

Key points:

- Methods / parameterized properties / `add_*` / `remove_*`: **return the closure**; the script calls `obj:Method()` or `obj.add_Xxx(handler)` itself.
- Fields / parameterless properties: **call the getter** and hand the return value to Lua.
- **Miss: `error` (strict)**. No C# reflection fallback; no runtime walk up the inheritance chain (inheritance is Bind-time flattened; see [03-BINDING.md](/docs/spec/metatable/03-BINDING/)).
- Error messages must include **`{TypeFullName}.{key}`** (`TypeFullName` is the Lua full name of the bound type).
- To probe “does this key exist?”, use **`rawget`** (no metamethods) or `pcall`; do not rely on `__index` returning `nil`.

### 3.2 Static type table (SMT)

Same logic as §3.1, except:

- `obj` is **type table `T`** (the static facade).
- Uses the **static** three tables (upvalues **must not** be shared with the instance three tables).
- Static getter closures follow static semantics (no instance `GCHandle` pop; static fields read the type's static data).

**SMT fallback:** when all three tables miss, `rawget` the **SMT itself** (`T`'s metatable) to resolve reserved keys hung on SMT, such as a struct's `_default` closure. If still missing, **`error("zlua: member not found: " .. typeFullName .. "." .. key)`**.

**Direct type-table lookup:** if `key` already exists on `T` itself (e.g. enum constant integers), Lua returns the value before `__index` runs; the indexer is not responsible for those keys.

`__call` does not participate in `__index`; construction goes through `T(...)` → `SMT.__call`.

---

## 4. `__newindex` algorithm

### 4.1 Instance userdata (IMT)

```lua
local function newindex(obj, key, value)
  local setter = rawget(fieldSetterTable, key)
  if setter ~= nil then
    setter(obj, value)
    return
  end
  error("zlua: instance member not writable: " .. typeFullName .. "." .. tostring(key))
end
```

Key points:

- **No return value** (do not return the setter's result).
- **Miss: strict error**. Covers missing fields, read-only properties, methods, `add_*` / `remove_*`, event names — **everything non-writable**.
- **Do not** allow writing new keys onto raw userdata (no ordinary-Lua-table extension semantics).

### 4.2 Static type table (SMT)

Same as §4.1, using the static `fieldSetterTable`; on miss, error with a **static** message prefix (see §6).

Non-writable keys such as enum constants and static readonly literals: miss then error, consistent with C# static readonly.

---

## 5. Strict miss and no reflection

| Operation | Miss behavior |
|-----------|---------------|
| `__index` | **`error`** (strict; see §6) |
| `__newindex` | **`error`** (strict) |

**Do not** call C# reflection or fall back to `InstanceIndex` / `StaticTypeIndex` on miss. Public members not registered into the three tables at Bind time are treated as nonexistent to Lua (read and write both error).

Inherited instance/static members must be **flattened into** the current type's three tables during **EnsureBinding** (see [03-BINDING.md](/docs/spec/metatable/03-BINDING/)); therefore runtime **does not** walk up the inheritance chain.

---

## 6. Error message conventions

| Scenario | Message (illustrative) |
|----------|------------------------|
| `__index` miss (no getter / no method / SMT fallback still empty) | `zlua: member not found: {TypeFullName}.{key}` |
| `__index` write-only property (setter table hit only) | `zlua: property has no getter: {TypeFullName}.{key}` |
| `__newindex` no setter / not writable (instance) | `zlua: instance member not writable: {TypeFullName}.{key}` |
| `__newindex` no setter / not writable (static) | `zlua: static member not writable: {TypeFullName}.{key}` |
| Type error inside getter | bridge throws, keep `zlua:` prefix |

Writing a read-only property, assigning to a method name, and similar cases all fall under the “not writable” semantics above.

---

## 7. Bootstrap and factory (conceptual)

At host startup, load the indexer factory **once** (registry-cached ref). Each type binding calls the factory with that type's static/instance three-table refs and obtains shared-logic `__index` / `__newindex` closures:

```lua
local function bind_indexer(methodTable, fieldGetterTable, fieldSetterTable)
  local rawget = rawget
  local function index(obj, key) ... end   -- §3
  local function newindex(obj, key, value) ... end  -- §4
  return index, newindex
end
```

**Per-type Lua source is not generated**; the three tables are registry refs or stack tables passed into the factory as closure upvalues. Il2Cpp implements the same semantics on the native side.

---

## 8. Interaction with `register_method`

`zlua.register_method` (and the Mono equivalent) attaches a **new** final name → **direct** closure to the target type's method table at runtime (full rules in [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §6.1).

- `aliasName` **does not exist yet** → write it; later `__index` returns that closure.
- `aliasName` **already exists** (single method or overload group) → **`luaL_error`**; do not overwrite or merge.
- Method-vs-field/property priority is §2.4; `register_method` still only checks whether the **method side** already occupies that name.

---

## 9. Mono / Il2Cpp consistency

The following **must be identical** on Mono and Il2Cpp (implementation paths may differ):

- Read/write semantics for registered methods / fields / properties / `add_*` / `remove_*`
- `__index` miss → **error**; `__newindex` miss → error
- Isolation of static/instance three tables; instance userdata cannot implicitly access static members
- Bind-time inheritance flattening; derived types override base same-name keys
- **No** event subtable; **no** reflection fallback

Performance and GC belong in implementation docs (`impl/metatable/`, `compare/PERFORMANCE.md`), not this document.
