---
sidebar_position: 4
title: Marshal Cheatsheet
description: Default Marshal rules for C# types and LuaMarshalAs overrides.
---

# Marshal Cheatsheet

Authoritative full text: [Marshal overview](/docs/spec/marshal/01-OVERVIEW/), [LuaMarshalAs](/docs/spec/marshal/02-MARSHAL-AS/).

**Shapes:** ClassUserData, ByObjUserData, and ByValUserData are full userdata; **OpaqueValue** and unmanaged Pointer are lightuserdata.

## Default Rules (Summary)

| C# Type | C# → Lua | Lua → C# |
|---------|----------|----------|
| Primitive / bool | number/boolean | Same as left |
| `string` | string | string |
| `byte[]` | ByObjUserData | ByObj / table; `[Bytes]` → string |
| `class` | ClassUserData | ClassUserData / nil |
| `T[]` | ByObjUserData | ByObj / table |
| mdarray | ByObjUserData | **ByObj only** (table not accepted) |
| `enum` | integer/number | integer or boxed |
| `struct` | See ByVal / ByObj / Opaque | See STRUCT spec |
| `Delegate` | DelegateUserData | function / userdata |
| `ref`/`out`/`in` (C#→Lua) | **OpaqueValue** | — |

## `[LuaMarshalAs]` (Common)

| LuaMarshalType | Effect |
|----------------|--------|
| Default | Table above |
| UserData | Force full userdata |
| Bytes | `byte[]` ↔ Lua string |
| OpaqueLightUserData | C#→Lua opaque handle |

## Related

- [LuaMarshalAs reference](/docs/reference/csharp/lua-marshal-as/)
- [BYREF](/docs/spec/marshal/03-BYREF/)
- [OPAQUE](/docs/spec/marshal/04-OPAQUE/)
- [STRUCT](/docs/spec/marshal/05-STRUCT/)
