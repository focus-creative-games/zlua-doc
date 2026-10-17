---
sidebar_position: 2
title: zlua Standard Library
description: Lua API reference for the global zlua table.
---

# zlua Standard Library

The global **`zlua`** table is loaded when `lua_State` initializes (`zlualib.lua`). **Type access** goes through `CSharp`; **type construction, opaque, boxing, arrays, delegates, and generic method closing** go through `zlua`. Overload dispatch and full-signature keys live on **metatables**; **`make_generic_method` / `register_method` are not provided** after Bind.

Authoritative contract: [05-LIB](/docs/spec/05-LIB/). Source: [ZLua~/lualib/zlualib.lua](https://github.com/focus-creative-games/zlua/blob/main/ZLua~/lualib/zlualib.lua)

---

## Type arguments (typeArg)

APIs that take typeArg accept ([05-LIB §3](/docs/spec/05-LIB/)):

| Form | Example |
|------|------|
| `zlua.types.*` | `zlua.types.int32` |
| `CSharp` / `make_*` type tables | `CSharp.mscorlib['System.Int32']` |
| Type-name string | Same as `Type.GetType(string)` |
| `System.Type` userdata | Return value of `zlua.typeof(typeTable)` |

**GTAP prefixes** accept **`System.Type` only**, not type tables / strings / `zlua.types.*`.

---

## Types and signatures

### `zlua.typeof(typeTable) → System.Type`

| Parameter / return | Notes |
|-------------|------|
| `typeTable` | Any ZLua type table |
| Return | `System.Type` reflection object (≡ C# `typeof`) |

```lua
local intType = zlua.typeof(CSharp['mscorlib']['System.Int32'])
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32)
local listType = zlua.typeof(ListInt)
```

### `zlua.get_type_from_name(typeFullName) → typeTable`

Analogous to `System.Type.GetType(string)`. Supports AQN, generics, arrays, etc.; failure → error (not silent `nil`).

```lua
local Int32 = zlua.get_type_from_name("System.Int32")
local IntArr = zlua.get_type_from_name("System.Int32[]")
```

### `zlua.types.*`

Built-in corlib type names; see **[zlua.types full table](/docs/reference/lua/zlua-types/)**.

### Signature strings

Native: `__zlua_create_signature(typeArg...)` → `"(System.Int32,System.String)"` (**not** yet wrapped in `zlualib.lua`; you may wrap as `zlua.signature`).

Full-signature keys resolve lazily on `__index` miss and cache; **do not** use parentheses-only strings as metatable keys:

```lua
demo['Run(System.Int32)'](demo, 10)
```

Colon short names need Bind-time `[LuaAlias]` / XML. See [Overload Spec](/docs/spec/04-METHOD-OVERLOAD/).

---

## Generic types

### `zlua.make_generic_type(genericBaseType, typeArg...) → typeTable`

Closes an open generic definition; same args are interned.

```lua
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32)
local list = ListInt()
```

---

## Generic methods

### `zlua.inflate(type, methodNameOrSignature, typeArg...) → closure`

Find an open generic method on a **closed** declaring type and specialize it. typeArg is full §3; instance closures are ByObj: `f(self, …)`.

```lua
local GetRb = zlua.inflate(GameObject, "GetComponent",
    CSharp['UnityEngine.CoreModule']['UnityEngine.Rigidbody'])
local rb = GetRb(go)
```

### GTAP

On open-generic short names, place **N** consecutive `zlua.typeof(...)` values before ordinary args. Shares intern with `inflate`.

```lua
local rb = go:GetComponent(zlua.typeof(Rigidbody))
```

Details: [05-LIB §9](/docs/spec/05-LIB/), [Overload Spec §3.8](/docs/spec/04-METHOD-OVERLOAD/).

---

## Opaque / ref

No `zlua.new_ref` for `ref` / `out` / `in`. C#→Lua defaults to Opaque; Lua→C# write-back depends on argument shape. See [ref/out/in](/docs/guides/ref-out-in/), [03-BYREF](/docs/spec/marshal/03-BYREF/).

### `zlua.get_opaquevalue` / `zlua.set_opaquevalue`

Read/write Opaque handles (lightuserdata) within a sync call chain.

### `zlua.to_user_data(opaque) → userdata`

**Copy** Opaque into StructUserData / ClassUserData (long-lived). Contract: [04-OPAQUE](/docs/spec/marshal/04-OPAQUE/) (if not listed in [05-LIB §12](/docs/spec/05-LIB/) Native table, Opaque Spec wins).

---

## Boxing / unboxing / view

### `zlua.box(typeArg, value) → byObjUserdata`

`typeArg` must be a **value type**; reference types → error.

### `zlua.unbox(boxedValue) → luaValue | byValUserdata`

Argument must be ByObjUserData. Primitives → boolean/number; enum → integer; struct → ByVal userdata.

### `zlua.cast(obj, targetType) → userdata`

Same managed identity; **IMT view = targetType**. See [06-CLASS](/docs/spec/marshal/06-CLASS/).

---

## Arrays

| API | Notes |
|-----|------|
| `make_szarray_type(elementType)` | `T[]` type table |
| `make_mdarray_type(elementType, rank)` | Multidim type table; `rank ∈ [1, 32]` |
| `new_szarray_by_element_type(type, len)` | By element type + length |
| `new_szarray_by_szarray_type(arrType, len)` | By array type table + length |
| `new_mdarray_by_mdarray_type(mdType, low, sizes)` | `low`/`sizes` are contiguous integer tables of length = rank |
| `new_mdarray_by_spec(elementType, low, sizes)` | Convenience constructor |
| `to_table(szarray)` | → Lua table; `t[i]` ↔ `arr[i-1]` |
| `to_bytes(szarray)` | Whole-buffer copy of CLR **blittable** elements to a binary string; **rejects** `bool[]` / `char[]` and element types with reference fields |

---

## Delegate

### `zlua.to_delegate(func, delegateType) → delegateUserdata`

Explicit conversion; method parameters can usually take a Lua function directly.

```lua
local handler = zlua.to_delegate(function(x) print(x) end, ActionIntType)
```

---

## Mono / Il2Cpp status

Lua-visible semantics match on both ends.

| API | Mono | Il2Cpp |
|-----|:----:|:------:|
| typeof / types / get_type_from_name | ✅ | ✅ |
| `__zlua_create_signature` | ✅ | ✅ |
| make_generic_type / inflate / GTAP | ✅ | ✅ |
| get/set_opaquevalue | ✅ | ✅ |
| box / unbox / cast | ✅ | ✅ |
| make_*array_* / new_*array_* | ✅ | ✅ |
| to_table / to_bytes | ✅ | ✅ |
| to_delegate | ✅ | ✅ |

Full semantics: [05-LIB](/docs/spec/05-LIB/)

## Related

- [zlua.types constants](/docs/reference/lua/zlua-types/)
- [API overview](/docs/reference/overview/)
- [Method overloads](/docs/guides/overloads/)
- [Generics](/docs/guides/generics/)
- [Method calls](/docs/getting-started/method-calls/)
- [ref / out / in](/docs/guides/ref-out-in/)
