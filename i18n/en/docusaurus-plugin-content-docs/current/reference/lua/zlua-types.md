---
sidebar_position: 3
title: zlua.types
description: Built-in corlib type constants table for zlua.types.
---

# zlua.types

`zlua.types` is initialized when `zlualib.lua` loads. It provides common **System type full-name strings** usable directly as typeArgs for `zlua.signature`, `zlua.make_generic_type`, `zlua.box`, etc. — shorthand for `zlua.typeof(CSharp.mscorlib....)`.

Source: [ZLua~/lualib/zlualib.lua](https://github.com/focus-creative-games/zlua/blob/main/ZLua~/lualib/zlualib.lua)

:::info Naming change
The old name `zlua.corlibtypes` is deprecated; use **`zlua.types`**.
:::

## Full Constants Table

| Lua key | System type | Typical use |
|---------|-------------|-------------|
| `zlua.types.void` | `System.Void` | Signature-only scenarios (e.g. no-arg ctor) |
| `zlua.types.bool` | `System.Boolean` | signature, generic type args |
| `zlua.types.char` | `System.Char` | signature |
| `zlua.types.byte` | `System.Byte` | signature |
| `zlua.types.sbyte` | `System.SByte` | signature |
| `zlua.types.short` | `System.Int16` | signature |
| `zlua.types.ushort` | `System.UInt16` | signature |
| `zlua.types.int` | `System.Int32` | signature (same as `int32`) |
| `zlua.types.int32` | `System.Int32` | signature, generic type args |
| `zlua.types.uint` | `System.UInt32` | signature |
| `zlua.types.long` | `System.Int64` | signature |
| `zlua.types.ulong` | `System.UInt64` | signature |
| `zlua.types.float` | `System.Single` | signature |
| `zlua.types.double` | `System.Double` | signature |
| `zlua.types.intptr` | `System.IntPtr` | signature |
| `zlua.types.uintptr` | `System.UIntPtr` | signature |
| `zlua.types.decimal` | `System.Decimal` | Declared; interop unsupported by default |
| `zlua.types.object` | `System.Object` | Generic type args, signatures |
| `zlua.types.string` | `System.String` | signature |

## Usage Examples

### Method signature / full-signature key

```lua
-- zlua.signature only builds the parameter parentheses; full-signature key = method name .. sig
local sig = zlua.signature(zlua.types.int32, zlua.types.string)
-- When multiple same-name candidates exist, Bind already hung the key; use directly:
-- demo['SomeMethod(System.Int32,System.String)'](demo, …)
```

### Closing a generic

```lua
local list_int = zlua.make_generic_type(CSharp.mscorlib['System.Collections.Generic.List`1'], zlua.types.int32)
```

## Choosing `zlua.typeof` / `get_type_from_name`

| Scenario | Prefer |
|----------|--------|
| corlib primitives / `string` / `object` | `zlua.types.*` |
| Game-assembly types (`Demo`, `Point2D`) | `CSharp.AC.Demo` type table, or `zlua.typeof(...)` |
| Closed generic / array type table → `System.Type` | `zlua.typeof(ListInt)` (≡ C# `typeof(List<int>)`) |
| Single-string parse (AQN / generic / array) | `zlua.get_type_from_name(...)` |
| Generic definition (open `List\`1`) | Type table + `make_generic_type` |

## Mono / Il2Cpp Support

| Runtime | Support |
|---------|:-------:|
| Mono | ✅ |
| Il2Cpp | ✅ |

## Related

- [zlua standard library](/docs/reference/lua/zlua-lib/)
- [Method overloads](/docs/guides/overloads/)
- [zlua library spec](/docs/spec/05-LIB/) §3
