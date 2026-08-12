---
sidebar_position: 9
title: Generics
description: Construct and call closed generic types and generic methods from Lua.
---

# Generics

Use `zlua.make_generic_type` to get a **closed** generic type table, then construct and call members like any other type. For arrays, see [Arrays](/docs/guides/arrays/).

## Closed generic types

Open definitions must include the **backtick arity**: ``List`1``, ``Dictionary`2``.

```lua
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32
)

local list = ListInt()
list:Add(10)
list:Add(20)
```

```lua
local DictStrInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.Dictionary`2'],
    zlua.types.string,
    zlua.types.int32
)

local dict = DictStrInt()
dict:Add("hp", 100)
```

The first argument is the **generic definition type table**; the rest are type arguments (`zlua.types.*`, `typeof` results, etc.).

## Generic methods

When the method **itself** has type parameters (e.g. `void Foo<T>(T a)`), the first argument must be a `generic_inst`:

```lua
local inst = zlua.make_generic_inst(zlua.types.int32)
SomeType.Foo(inst, value)
```

Ordinary methods on already-closed types (e.g. `List<int>.Add`) do **not** use this path. See [Type system §6](/docs/spec/02-TYPE-SYSTEM/).

## Common mistakes

| Symptom | Fix |
|------|------|
| Wrong arity | Check `` `1 `` / `` `2 `` vs argument count |
| `List` not found | Use full name `System.Collections.Generic.List`1` with bracket keys |
| Passing `make_generic_inst` to an already-closed method | Only needed for open generic methods |

## Learning path

| | |
|---|---|
| **Previous** | [Arrays](/docs/guides/arrays/) |
| **Next** | [ref / in / out](/docs/guides/ref-out-in/) |

## Related

- [zlua library Spec](/docs/spec/05-LIB/)
- [Type system](/docs/spec/02-TYPE-SYSTEM/)
- [Arrays](/docs/guides/arrays/)
