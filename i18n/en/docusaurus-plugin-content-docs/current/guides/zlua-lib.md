---
sidebar_position: 13
title: Common zlua library
description: The most-used zlua APIs day to day; the rest are in the Spec.
---

# Common zlua library

| Layer | Role |
|----|------|
| **`CSharp`** | Assemblies / types / members / construction |
| **`zlua`** | Type-construction helpers, opaque, arrays, delegates, overload short names |
| **Instance userdata** | Members via metatable, not via `zlua` |

Full API: [05-LIB](/docs/spec/05-LIB/), [reference](/docs/reference/lua/zlua-lib/). This page lists only the most common.

## Type arguments

| API | Purpose |
|-----|------|
| `zlua.types.int32`, etc. | Preset type arguments |
| `zlua.typeof(typeTable)` | ≡ C# `typeof`, returns `System.Type` |
| `zlua.get_type_from_name(name)` | Analogous to `Type.GetType` |

## Overloads

When there are multiple same-name candidates, Bind already hangs full-signature keys (e.g. `Run(System.Int32)`); you usually **do not** need a library call first:

```lua
demo['Run(System.Int32)'](demo, 5)
```

For short name + colon, then `register_method`:

```lua
local run_i32 = demo['Run(System.Int32)']
zlua.register_method("run_i32", run_i32)
demo:run_i32(5)   -- 注册后的好处：可读短名 + 冒号语法
```

`zlua.signature(...)` only builds the parameter-parentheses part (e.g. `"(System.Int32)"`) for comparison/concatenation; it **cannot** be a metatable key alone. See [Method overloads](/docs/guides/overloads/).

## Generics and arrays

```lua
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32)

local arr = zlua.new_szarray_by_element_type(zlua.types.int32, 4)
local t = zlua.to_table(arr)
local bytes = zlua.to_bytes(float_arr)  -- blittable 元素
```

See [Generics](/docs/guides/generics/), [Arrays](/docs/guides/arrays/).

## Opaque / ref

| API | Purpose |
|-----|------|
| `get_opaquevalue` / `set_opaquevalue` | Read/write Opaque within a sync call chain |
| `to_user_data` | Upgrade Opaque to a userdata facade (see Spec) |

`ref` struct: pass same-type `Type(...)` userdata to write back. See [ref/out/in](/docs/guides/ref-out-in/).

## Delegate

```lua
local d = zlua.to_delegate(fn, ActionIntType)  -- 第二参须已闭合
```

Usually **unnecessary** when the parameter is already a concrete `Action`/`Func`. See [Function](/docs/guides/functions/).

## Other (look up Spec when needed)

`box` / `unbox` / `cast`, `make_generic_method`, mdarray family, Native `__zlua_*` — see [05-LIB](/docs/spec/05-LIB/).

## Learning path

| | |
|---|---|
| **Previous** | [Extension methods](/docs/guides/extension-methods/) |
| **Next** | [Third-party native modules](/docs/guides/native-modules/) |

## Related

- [05-LIB](/docs/spec/05-LIB/)
- [zlua-lib reference](/docs/reference/lua/zlua-lib/)
- [Third-party native modules](/docs/guides/native-modules/) — socket / cjson etc. are not in the zlua standard library
