---
sidebar_position: 13
title: Common zlua library
description: The most-used zlua APIs day to day; the rest are in the Spec.
---

# Common zlua library

| Layer | Role |
|----|------|
| **`CSharp`** | Assemblies / types / members / construction |
| **`zlua`** | Type-construction helpers, opaque, boxing, arrays, delegates, generic method closing (`inflate`) |
| **Instance userdata** | Members via metatable, not via `zlua` |

Full API: [05-LIB](/docs/spec/05-LIB/), [reference](/docs/reference/lua/zlua-lib/). This page lists only the most common. **`make_generic_method` / `register_method` are not provided** (see Spec §9).

## Type arguments (typeArg)

Most construction APIs accept the same typeArg set ([05-LIB §3](/docs/spec/05-LIB/)): `zlua.types.*`, type tables, type-name strings, `System.Type` (from `zlua.typeof`). **Exception:** GTAP prefixes accept **`System.Type` only**.

| API | Purpose |
|-----|------|
| `zlua.types.int32`, etc. | Preset type arguments |
| `zlua.typeof(typeTable)` | ≡ C# `typeof`, returns `System.Type` |
| `zlua.get_type_from_name(name)` | Analogous to `Type.GetType` (AQN, generics, arrays) |

## Overloads

When multiple same-name candidates exist, the short name uses dispatch; pick one with a **full-signature key** (lazy on miss, then cached). Colon short names need Bind-time **`[LuaAlias]`** / XML:

```lua
demo['Run(System.Int32)'](demo, 5)
local run_i32 = demo['Run(System.Int32)']
run_i32(demo, 20)
```

Parameter parentheses come from native `__zlua_create_signature(...)` (you may wrap as `zlua.signature`); they **cannot** be a metatable key alone. See [Method overloads](/docs/guides/overloads/).

## Generic types and arrays

```lua
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32)

local arr = zlua.new_szarray_by_element_type(zlua.types.int32, 4)
local t = zlua.to_table(arr)
local bytes = zlua.to_bytes(float_arr)  -- CLR blittable; not bool[] / char[]
```

## Generic methods

Open generic methods use **`zlua.inflate`** (full typeArg; cache the closure) or **GTAP** (prefixes only `zlua.typeof(...)`):

```lua
local GetRb = zlua.inflate(GameObject, "GetComponent", Rigidbody)
local rb = GetRb(go)
-- or: go:GetComponent(zlua.typeof(Rigidbody))
```

See [Generics](/docs/guides/generics/), [Method calls](/docs/getting-started/method-calls/).

## Opaque / ref

| API | Purpose |
|-----|------|
| `get_opaquevalue` / `set_opaquevalue` | Read/write Opaque within a sync call chain (`ref`/`in`/`out` default Push) |
| `to_user_data` | **Copy** Opaque into Struct/Class userdata (long-lived; see [OPAQUE](/docs/spec/marshal/04-OPAQUE/)) |

`ref` struct: pass same-type `Type(...)` userdata to write back. See [ref/out/in](/docs/guides/ref-out-in/).

## Boxing / view

| API | Purpose |
|-----|------|
| `zlua.box(typeArg, value)` | Value type → ByObj userdata |
| `zlua.unbox(boxed)` | ByObj → primitive / ByVal userdata |
| `zlua.cast(obj, targetType)` | Same identity, new IMT view |

## Delegate

```lua
local d = zlua.to_delegate(fn, ActionIntType)  -- second arg must be closed
```

Usually **unnecessary** when the parameter is already a concrete `Action`/`Func`. See [Function](/docs/guides/functions/).

## Other (look up Spec when needed)

mdarray family, Native `__zlua_*` table — [05-LIB](/docs/spec/05-LIB/) §8, §12.

## Learning path

| | |
|---|---|
| **Previous** | [Extension methods](/docs/guides/extension-methods/) |
| **Next** | [Third-party native modules](/docs/guides/native-modules/) |

## Related

- [05-LIB](/docs/spec/05-LIB/)
- [zlua-lib reference](/docs/reference/lua/zlua-lib/)
- [Third-party native modules](/docs/guides/native-modules/) — socket / cjson etc. are not in the zlua standard library
