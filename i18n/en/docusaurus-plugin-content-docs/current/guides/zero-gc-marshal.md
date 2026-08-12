---
sidebar_position: 11.5
title: 0GC Marshal
description: Low-allocation Marshal patterns such as OpaqueValue, UnpackedValues, and string UserData.
---

# 0GC Marshal

This page covers common Marshal techniques for **fewer allocations / zero extra managed allocations**. Defaults: [cheatsheet](/docs/reference/marshal-cheatsheet/); attribute syntax: [LuaMarshalAs](/docs/guides/lua-marshal-as/). Authoritative: [04-OPAQUE](/docs/spec/marshal/04-OPAQUE/), [02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/).

> “0GC” means on hot paths **try not** to allocate a new Lua table / Lua string / ByVal userdata / boxed object for this interop call. It does not mean the whole program never GCs.

## 1. OpaqueValue: reference types and structs

**OpaqueValue** is a lightuserdata handle (no metatable); Push does not build ByObj/ByVal userdata.

| Scenario | Behavior |
|------|------|
| `ref` / `out` / `in T` (any T) | C#→Lua **defaults** to Opaque; no annotation needed |
| by-val any CLR type | May explicitly `[LuaMarshalAs(OpaqueValue)]` (**C#→Lua only**) |

```csharp
public void Touch(ref Transform t) { }           // 默认 Opaque
public void Peek([LuaMarshalAs(LuaMarshalType.OpaqueValue)] MyClass obj) { }
public void PeekStruct([LuaMarshalAs(LuaMarshalType.OpaqueValue)] Vector3 v) { }
```

```lua
-- 在同一次 C#→Lua 同步调用链内
local v = zlua.get_opaquevalue(slot)
zlua.set_opaquevalue(slot, newValue)
-- 需要 userdata 门面时：zlua.to_user_data(slot)（会产生 userdata，见规范）
```

Key points:

- Both **reference types** and **structs** can use Opaque to avoid building full userdata for short-lived objects this frame
- **Do not** store Opaque in globals that cross `pcall` / frames
- Annotating `OpaqueValue` on a Lua→C# parameter alone is **illegal**; write-back rules: [ref/out/in](/docs/guides/ref-out-in/)

## 2. UnpackedValues: expand struct across slots

For **ordinary structs / closed generic structs**, map consecutive stack slots ↔ `Members` without creating a Lua table or ByVal userdata:

```csharp
public void ApplyForce(
    [LuaMarshalAs(LuaMarshalType.UnpackedValues, Members = new[] { "x", "y", "z" })]
    Vector3 force) { }
```

```lua
rb:ApplyForce(0, 9.8, 0)   -- 三槽；Lua 侧只有 number
```

| Applies | Does not apply |
|------|--------|
| `struct` / closed generic struct | **`Nullable<T>`** (forbidden by Spec; cannot express “no value” across multiple slots) |
| Hot-path `Vector2` / `Vector3` / custom small blittable structs | class / interface |

When `Nullable<struct>` needs nullability, use **`Table`** (`nil`↔no value), but the table itself allocates in Lua and is **not** 0GC in this section’s sense; temporary nullable values C#→Lua may also use **Opaque**.

Return values can expand to multiple returns too:

```csharp
[return: LuaMarshalAs(LuaMarshalType.UnpackedValues, Members = new[] { "X", "Y" })]
public Vec2 GetDelta() => ...;
```

```lua
local dx, dy = host:GetDelta()
```

## 3. UserData: huge `string` via ByObj

Default: `string` ↔ Lua **string** (content copy). For huge text / binary-as-text buffers, copying is expensive:

```csharp
public void ProcessHuge(
    [LuaMarshalAs(LuaMarshalType.UserData)] string payload) { }
```

After annotation, force **ByObjUserData** (managed `System.String`) and **do not** build a matching Lua string.

:::warning Not always “cheaper”
ByObjUserData **still** allocates **userdata** on the Lua side and participates in Lua GC. It only avoids “copying another full Lua string”. Keep the default for ordinary short strings; this pattern is **uncommon**.
:::

For `byte[]` octet semantics use `Bytes` (↔ Lua string), which is a different goal from this section.

## Quick comparison

| Technique | Typical goal | Extra Lua-side allocation |
|------|----------|----------------|
| **OpaqueValue** | C#→Lua class / struct / byref | No userdata/table (lightuserdata handle only) |
| **UnpackedValues** | Expand struct fields Lua↔C# | None (stack numbers, etc.) |
| **Table** | struct / `Nullable<struct>` key/value | **Has** table |
| **UserData** on `string` | Huge string without Lua string copy | **Has** ByObj userdata |

## Learning path

| | |
|---|---|
| **Previous** | [LuaMarshalAs](/docs/guides/lua-marshal-as/) |
| **Next** | [Method overloads](/docs/guides/overloads/) |

## Related

- [LuaMarshalAs](/docs/guides/lua-marshal-as/)
- [Value types](/docs/guides/value-types/)
- [ref / out / in](/docs/guides/ref-out-in/)
- [GC comparison](/docs/compare/GC/)
- [02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/) · [04-OPAQUE](/docs/spec/marshal/04-OPAQUE/)
