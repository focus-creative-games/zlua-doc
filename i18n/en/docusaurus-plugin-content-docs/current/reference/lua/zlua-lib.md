---
sidebar_position: 2
title: zlua Standard Library
description: Lua API reference for the global zlua table.
---

# zlua Standard Library

The global **`zlua`** table is loaded when `lua_State` initializes (`zlualib.lua`). **Type access** goes through `CSharp`; **type construction, overloads, ref, arrays, and delegate conversion** go through `zlua`.

Source: [ZLua~/lualib/zlualib.lua](https://github.com/focus-creative-games/zlua/blob/main/ZLua~/lualib/zlualib.lua)

---

## Types and Signatures

### `zlua.typeof(typeTable) → System.Type`

Returns the type's **`System.Type` reflection object** (Lua-side `System.Type` class userdata), corresponding to C# `typeof(T)`.

| Parameter / return | Description |
|--------------------|-------------|
| `typeTable` | **Any** ZLua type table (`CSharp` base table, closed generic table, array type table, etc.) |
| Return | `System.Type` instance, e.g. `zlua.typeof(CSharp['mscorlib']['System.Int32'])` ≡ C# `typeof(int)` |

```lua
local intType = zlua.typeof(CSharp['mscorlib']['System.Int32'])  -- ≡ typeof(int)
local t = zlua.typeof(CSharp.AC.Demo)                            -- ≡ typeof(Demo)
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32
)
local listType = zlua.typeof(ListInt)                            -- ≡ typeof(List<int>)
```

### `zlua.get_type_from_name(typeFullName) → typeTable`

Analogous to `System.Type.GetType(string name)`: resolve by name and return a type table. Supports Assembly-qualified names, generics, arrays, etc.

```lua
local Int32 = zlua.get_type_from_name("System.Int32")
local IntArr = zlua.get_type_from_name("System.Int32[]")
```

### `zlua.types.*`

Built-in corlib type-name strings; see **[zlua.types full table](/docs/reference/lua/zlua-types/)**.

### `zlua.signature(typeArg, ...) → signature`

Builds a **parameter-type** parenthesized string (e.g. `"(System.Int32)"`) for matching / concatenating full-signature keys. Method name is **not** included.

| Parameter | Description |
|-----------|-------------|
| `typeArg...` | `zlua.types.*`, `zlua.typeof(T)`, or a type table |

```lua
local sig = zlua.signature(zlua.types.int32, zlua.types.string)
-- "(System.Int32,System.String)"
-- Full-signature key = method name .. sig → "Run(System.Int32,System.String)"
```

When multiple same-name candidates exist, Bind already registered full-signature keys; typically:

```lua
demo['Run(System.Int32)'](demo, 10)
```

**Do not** use parameter-only parentheses (no method name) as a metatable key.

### `zlua.register_method(aliasName, closure) → void`

Hangs a **direct** closure under an unused short name; after registration, colon-call works.

| Parameter | Description |
|-----------|-------------|
| `aliasName` | New method key; must not collide with existing default / full-signature / alias keys |
| `closure` | Direct method closure (e.g. `demo['Run(System.Int32)']`) |

```lua
local run_i32 = demo['Run(System.Int32)']
zlua.register_method("run_i32", run_i32)
demo:run_i32(20)   -- short name + colon; this is the benefit of register
```

Two-argument form; target table is inferred from the closure's binding domain. See [overload spec §6.1](/docs/spec/04-METHOD-OVERLOAD/).

---

## Generics

### `zlua.make_generic_type(genericBaseType, typeArg...) → typeTable`

Closes an open generic definition, e.g. `List<int>`.

```lua
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32)
local list = ListInt()
```

### `zlua.make_generic_inst(typeArg...) → genericInst`

Type-argument pack for a generic **method** (not a type table).

---

## Opaque / ref

There is **no** separate `zlua.new_ref` for `ref` / `out` / `in` (removed). Lua→C# write-back depends on argument shape: same-type **ByValUserData** (e.g. `Point2D(...)`) or compatible **Opaque**; bare number/string only enters a temp slot. See [ref/out/in guide](/docs/guides/ref-out-in/), [03-BYREF](/docs/spec/marshal/03-BYREF/).

### `zlua.to_user_data(opaque) → userdata`

Upgrades a C#→Lua **OpaqueValue** (lightuserdata) to StructUserData / ClassUserData. Must be used within the **synchronous call chain**.

Also: `get_opaquevalue` / `set_opaquevalue` — see the Opaque section of the same spec.

---

## Arrays

| API | Parameters | Return | Description |
|-----|------------|--------|-------------|
| `make_szarray_type(elementType)` | Element type | Array type table | `T[]` |
| `make_mdarray_type(elementType, rank)` | Element type, rank | Multidim type table | `T[,]`, etc. |
| `new_szarray_by_element_type(type, len)` | Element type, length | ArrayUserData | |
| `new_szarray_by_szarray_type(arrType, len)` | Array type table, length | ArrayUserData | |
| `new_mdarray_by_mdarray_type(mdType, low, sizes)` | Type, lower bounds, sizes | ArrayUserData | |
| `new_mdarray_by_spec(elementType, low, sizes)` | Element type, lower bounds, sizes | ArrayUserData | Convenience ctor |
| `to_table(szarray)` | 1D array | Lua table | 1-based index |
| `to_bytes(szarray)` | szarray of blittable elements (primitives or structs with no ref fields) | string | Byte copy of array memory |

---

## Delegate

### `zlua.to_delegate(func, delegateType) → delegateUserdata`

Converts a Lua function to the specified **Delegate type** userdata (explicit form; method parameters can usually take a function directly).

```lua
local handler = zlua.to_delegate(function(x) print(x) end, CSharp.AC['System.Action`1'])
```

---

## Mono / Il2Cpp Implementation Status

Lua-visible semantics are **consistent** on both ends; all rows below are implemented.

| API | Mono | Il2Cpp |
|-----|:----:|:------:|
| typeof / types / signature | ✅ | ✅ |
| register_method | ✅ | ✅ |
| make_generic_type / make_generic_inst | ✅ | ✅ |
| get/set_opaquevalue / to_user_data | ✅ | ✅ |
| make_szarray_* / new_szarray_* | ✅ | ✅ |
| make_mdarray_* | ✅ | ✅ |
| to_table / to_bytes | ✅ | ✅ |
| to_delegate | ✅ | ✅ |

Full semantics: [zlua library spec](/docs/spec/05-LIB/)

## Related

- [zlua.types constants](/docs/reference/lua/zlua-types/)
- [API overview](/docs/reference/overview/)
- [Method overloads](/docs/guides/overloads/)
- [Generics and arrays](/docs/guides/generics/)
- [ref / out / in](/docs/guides/ref-out-in/)
