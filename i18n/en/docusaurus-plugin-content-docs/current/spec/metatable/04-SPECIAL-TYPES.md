---
sidebar_position: 21
title: "Special-type metatable behavior"
---

# 04 — Special-type metatable behavior

This document summarizes metatable-layout and member-index special cases for **enum**, **Nullable\<T\>**, **struct**, **arrays**, and **delegates**. Push/Pop of values, ByVal/ByObj payload layout, and other Marshal details are in the [../marshal/](/docs/spec/marshal/) volumes; this document only describes **Lua-script-visible** table structure, metamethods, and index entry points.

**Related docs:** common layout → [01-LAYOUT.md](/docs/spec/metatable/01-LAYOUT/); index algorithm → [02-INDEX.md](/docs/spec/metatable/02-INDEX/); binding rules → [03-BINDING.md](/docs/spec/metatable/03-BINDING/).

---

## 1. Enums

### 1.1 Type table and static access

An enum resolves via `CSharp[assembly][typeFullName]` to type table `E`, with `__enum : true`, SMT, and ByObj IMT. There is **no** `__byval_instance_mt`.

At Bind time, all **public static literal** fields of the enum are written onto **`E` itself** as **integer** (preferred on Lua 5.4+) or integral **number**, using the C# underlying integer value. They are **not** userdata. Reading `E.Red` does not trigger `__index` when the key is already on `E`.

SMT provides **`__index` / `__newindex`** (static three tables) but **no `__call`** and **no `_default`**. **`EnumType(...)` construction is forbidden**; hanging `_ctor` on `E` or SMT is also **forbidden**.

Assigning to enum constants: `__newindex` strict error, same as static readonly.

### 1.2 Boxed instances

When a **boxed enum** (ByObj userdata) is needed, use **`zlua.box`** ([../05-LIB.md](/docs/spec/05-LIB/)); there is **no** type-table construction entry:

```lua
local Color = CSharp.AC['MyGame.Color']
local redBox = zlua.box(Color, Color.Red)
```

The product attaches **`E.__byobj_instance_mt`**, with `__zlua_ud_kind` `"byobj"`. Instance three tables are usually empty or nearly empty (enums have no public instance fields/methods); `__tostring` is recommended as something like `EnumFullName(value)`.

Default cross-boundary argument passing still uses **integer/number** ([../marshal/08-ENUM.md](/docs/spec/marshal/08-ENUM/)); `zlua.box` is only for scenarios that need **object parameters** / boxing semantics.

### 1.3 Comparison with class / struct (metatables)

| Item | enum |
|------|------|
| Type-table constants | integer/number keys |
| `SMT.__call` | **none** |
| `_default` | **none** |
| Instance userdata | only `zlua.box` → ByObj |
| Inheritance flattening | **none** (enums do not merge an inheritance chain) |

---

## 2. Nullable\<T\> (closed value type)

`System.Nullable\`1` closed via `zlua.make_generic_type` becomes type table `N` with **`__nullable : true`**, mutually exclusive with `__struct` / `__enum`.

### 2.1 Layout special cases

- **No** `__byval_instance_mt`, **no** `__byobj_instance_mt`, **no** `IMT`.
- SMT contains **only** **`__call`** and optional **`__tostring`**; **no** `__index` / `__newindex` (Nullable's own static members are not exposed as bindings).

### 2.2 `SMT.__call` semantics

`N(...)` constructs a **valued representation of element type `T`**, **not** a Nullable wrapper instance. Native binds `__call` to the **element type**'s construction logic (consistent with `T(...)` / primitive conversion of `T`):

```lua
local NullableInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Nullable`1'],
    zlua.types.int32
)
local n = NullableInt(42)   -- Lua integer, not userdata

local NullablePoint = zlua.make_generic_type(
    CSharp.mscorlib['System.Nullable`1'],
    Point2D
)
local p = NullablePoint(1, 2)   -- Point2D ByVal userdata
```

| Kind of `T` | Return value of `N(...)` |
|-------------|--------------------------|
| Primitive | corresponding Lua primitive (boolean / integer / number) |
| struct | **`T`'s ByVal userdata** |
| enum | **not supported** via this entry (enums have no `__call`) |

**null / no value** is not expressed via `N(...)`; when passing null `Nullable<T>` to C#, pass Lua **`nil`** directly ([../marshal/01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/)).

---

## 3. Value-type structs

A struct type table has **`__struct : true`** and attaches both **`__byval_instance_mt`** and **`__byobj_instance_mt`** (see [01-LAYOUT.md](/docs/spec/metatable/01-LAYOUT/) §4).

### 3.1 Static entry points

| Entry | Location | Semantics |
|-------|----------|-----------|
| `Type(...)` | `SMT.__call` | Parameterized public constructor → **ByVal userdata** (matches the spec default construction product) |
| `Type._default()` | `_default` on SMT, via static `__index` → SMT fallback | Parameterless **zero-initialized** instance, equivalent to `default(T)`; **does not** call user parameterized constructors |

**`_ctor` fields are forbidden**; **`_default` for enum/Nullable is forbidden**.

### 3.2 Instance members and dual MTs

- **ByVal userdata:** metatable = `T.__byval_instance_mt`; fields/methods indexed via ByVal three tables; `this` points at the payload ([../marshal/05-STRUCT.md](/docs/spec/marshal/05-STRUCT/)).
- **ByObj userdata** (boxed struct): metatable = `T.__byobj_instance_mt`; same member names, ByObj three-table closures.
- **Static members** are accessed via `T` / SMT, same path as classes.

Structs have **no** C# instance inheritance; Bind time **does not** merge base instance members (value types have no derived-instance inheritance scenario). Optional `zlua.box` converts between ByVal and ByObj (marshal volumes).

---

## 4. Arrays (szarray / mdarray)

Array type tables resemble ordinary reference types: **ByObj IMT only** (array objects are `Il2CppArray*` / equivalent references). `SMT.__call` is **absent** (array instances are created via `zlua.new_szarray_*` / `zlua.new_mdarray_*`; see [../02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/)).

### 4.1 Instance metamethods

| Metamethod | Behavior |
|------------|----------|
| `__len` | szarray: `#arr` = `Length`; mdarray: `#arr` = **product** of `GetLength(d)` over all dimensions (total addressable element count), **not** a single-dimension length |
| `__index` / `__newindex` | go through instance three tables; **do not** implement `arr[i]` metamethod subscripting |

### 4.2 Element access: `get` / `set`

At Bind time, register native methods **`get`** / **`set`** on the instance **`methodTable`** (**not** `get_Item` naming):

```lua
arr:set(0, 10)      -- szarray: 1 index + value
assert(arr:get(0) == 10)

matrix:set(0, 1, 7) -- mdarray: rank indices + value
```

Argument counts: `get` must equal **rank**; `set` must equal **rank + 1** (last arg is value). Indices are **C# per-dimension indices** (including `lowerBound`) and must be integers. Out of range → `luaL_error`.

`GetValue` / `SetValue` and other methods bound via the three tables remain available; for primitive assertions prefer `get` (unboxed). Semantics differ from 1-based Lua tables via `zlua.to_table`; see [../marshal/07-ARRAY.md](/docs/spec/marshal/07-ARRAY/).

---

## 5. Delegates

Delegate type table + **ByObj IMT**. Delegate **instance** userdata additionally registers **`__call`** on the ByObj IMT:

```lua
local cb = SomeDelegate(function(x) return x * 2 end)
local result = cb(21)   -- equivalent to invoke; obj:Invoke(21) is not required
```

`__call` argument count must match the `Invoke` signature; Lua function → delegate Marshal is in [../marshal/09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/). Static members (if any) still go through SMT three tables; there is **no** event subtable.

---

## 6. Other types (summary)

| Type | Metatable notes |
|------|-----------------|
| **class** | only `__byobj_instance_mt`; `SMT.__call` → instance construction; inherited members Bind-time flattened |
| **interface** | resolvable type table; usually no public constructor, so `SMT.__call` is unavailable |
| **abstract class** | only public constructors may `__call`; protected constructors are invisible to Lua |
| **static class** | static three tables only; no `__call`, no IMT |

---

## 7. Marshal cross-references

| Topic | Document |
|-------|----------|
| Enum default integer and box | [../marshal/08-ENUM.md](/docs/spec/marshal/08-ENUM/) |
| Struct ByVal / ByObj | [../marshal/05-STRUCT.md](/docs/spec/marshal/05-STRUCT/) |
| Class / reference facade | [../marshal/06-CLASS.md](/docs/spec/marshal/06-CLASS/) |
| Array creation and `get`/`set` | [../marshal/07-ARRAY.md](/docs/spec/marshal/07-ARRAY/) |
| Delegate ↔ Lua function | [../marshal/09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/) |
| Nullable null / valued | [../marshal/01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/) |

The metatable layer only guarantees that **entry points and index semantics** match the table above; concrete stack-type checks and GC behavior follow the marshal volumes.
