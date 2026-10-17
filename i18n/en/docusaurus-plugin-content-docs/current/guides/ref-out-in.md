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
| **Lua → C# · `ref` / `in`** | Still occupy args; **whether write-back happens** depends on argument shape (table below) |
| **Lua → C# · `out`** | **Do not** occupy args; after Invoke, emit as **multiple returns** (`return, out1, …`) |

## `ref` / `in` write-back rules (intuition)

| Lua argument shape | Write back to C# byref |
|--------------|---------------|
| OpaqueValue (`get`/`set_opaquevalue`) | ✅ |
| Same-type ByValUserData (e.g. struct userdata) | ✅ (true ref semantics) |
| Bare number / string / most ByObj | ❌ |

```lua
local x = 5
Demo.Increment(x)          -- if formal is ref int: bare number does not write back; x stays 5

local p = Point2D(1, 2)
Demo.Offset(p)             -- ref Point2D: fields can write back to p
```

## `out`: multiple returns

```lua
-- void GetPosition(out float x, out float y, out float z)
local x, y, z = Demo.GetPosition()

-- bool TryGet(out float x, out float y)
local ok, x, y = Demo.TryGet()
```

To mutate the same observable Lua-side slot, use **`ref`**; do not use a number placeholder for `out`.

## Opaque read/write

Byref slots obtained C#→Lua are usually Opaque:

```lua
-- Within the same synchronous call chain
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
