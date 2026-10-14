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

The first argument is the **generic definition type table**; the rest are type arguments (`zlua.types.*`, type tables, etc.).

## Generic methods

When the method **itself** has type parameters (e.g. `T GetComponent<T>()`), close them with **`zlua.inflate`** or call-site **GTAP**; this closes **only** the method's generic formals. If the declaring type is still open (e.g. ``List`1``), call `make_generic_type` first, then `inflate`.

| Path | When |
|------|------|
| **`zlua.inflate`** | Close by closed type + method name or full-signature key; cache the returned closure on hot paths |
| **GTAP** | Prefix **N** `System.Type` values (`zlua.typeof(...)`) before ordinary args on a short-name call; **not** type tables / strings / `zlua.types.*` |

```lua
-- inflate: full §3 typeArg (type table, string, System.Type, etc.)
local GetRb = zlua.inflate(GameObject, "GetComponent",
    CSharp['UnityEngine.CoreModule']['UnityEngine.Rigidbody'])
local rb = GetRb(go)

-- GTAP: System.Type prefixes only
local Rigidbody = CSharp['UnityEngine.CoreModule']['UnityEngine.Rigidbody']
local rb2 = go:GetComponent(zlua.typeof(Rigidbody))
```

Ordinary methods on already-closed types (e.g. `List<int>.Add`) do **not** use this path. See [Type system §6](/docs/spec/02-TYPE-SYSTEM/), [05-LIB §9](/docs/spec/05-LIB/).

## Common mistakes

| Symptom | Fix |
|------|------|
| Wrong arity | Check `` `1 `` / `` `2 `` vs argument count |
| `List` not found | Use full name `System.Collections.Generic.List`1` with bracket keys |
| Using `inflate` on a non-open-generic method | Only when the method itself has generic formals |
| Passing a type table to GTAP | Use `zlua.typeof(typeTable)`, or use `inflate` |

## Learning path

| | |
|---|---|
| **Previous** | [Arrays](/docs/guides/arrays/) |
| **Next** | [ref / in / out](/docs/guides/ref-out-in/) |

## Related

- [zlua library Spec](/docs/spec/05-LIB/)
- [Type system](/docs/spec/02-TYPE-SYSTEM/)
- [Arrays](/docs/guides/arrays/)
