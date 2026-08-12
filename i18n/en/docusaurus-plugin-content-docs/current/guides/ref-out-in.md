---
sidebar_position: 10
title: ref / in / out
description: Default Opaque behavior for byref parameters and write-back rules.
---

# ref / in / out

Authoritative: [BYREF](/docs/spec/marshal/03-BYREF/), [OPAQUE](/docs/spec/marshal/04-OPAQUE/). Attribute-level forced shapes: [LuaMarshalAs](/docs/guides/lua-marshal-as/); 0GC patterns: [0GC Marshal](/docs/guides/zero-gc-marshal/).

## Dual-path summary

| Direction | Behavior |
|------|------|
| **C# → Lua** (`GetFunction` / delegate bridge) | `ref` / `out` / `in` default Push **OpaqueValue** |
| **Lua → C#** | Pop is not split by `ref`/`out`/`in` keywords; **whether write-back happens** depends on argument shape |

## Write-back rules (intuition)

| Lua argument shape | Write back to C# byref |
|--------------|---------------|
| OpaqueValue (`get`/`set_opaquevalue`) | ✅ |
| Same-type ByValUserData (e.g. struct userdata) | ✅ (true ref semantics) |
| Bare number / string / most ByObj | ❌ |

```lua
local x = 5
Demo.Increment(x)          -- 若形参为 ref int：裸 number 不写回，x 仍为 5

local p = Point2D(1, 2)
Demo.Offset(p)             -- ref Point2D：字段可写回 p
```

## Opaque read/write

Byref slots obtained C#→Lua are usually Opaque:

```lua
-- 在同一次同步调用链内
local v = zlua.get_opaquevalue(slot)
zlua.set_opaquevalue(slot, newValue)
```

For value-type parameters such as `ref Point2D`, pass same-type **ByValUserData** (e.g. `Point2D(1, 2)`) to write back; no extra API. See [Value types](/docs/guides/value-types/), [Common zlua library](/docs/guides/zlua-lib/).

:::warning
Opaque must **not** be persisted across `pcall` / frames as a long-lived handle. For a userdata facade use `zlua.to_user_data` (see Spec).
:::

## Relation to the Value types chapter

By-val structs are **copies**; to “mutate fields and reflect into C#” pass same-type userdata to a `ref` parameter, or use Opaque. See [Value types](/docs/guides/value-types/).

## Learning path

| | |
|---|---|
| **Previous** | [Generics](/docs/guides/generics/) |
| **Next** | [LuaMarshalAs](/docs/guides/lua-marshal-as/) |

## Related

- [BYREF](/docs/spec/marshal/03-BYREF/)
- [OPAQUE](/docs/spec/marshal/04-OPAQUE/)
- [LuaMarshalAs](/docs/guides/lua-marshal-as/)
- [0GC Marshal](/docs/guides/zero-gc-marshal/)
