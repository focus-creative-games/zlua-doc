---
sidebar_position: 11
title: LuaMarshalAs
description: Override default Marshal; Bytes / Opaque / UnpackedValues / Table / UserData and XML.
---

# LuaMarshalAs

When default Marshal (see [cheatsheet](/docs/reference/marshal-cheatsheet/)) is not enough, override with **`[LuaMarshalAs]`** or **XML**. Authoritative text: [02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/). For 0GC topics, see [0GC Marshal](/docs/guides/zero-gc-marshal/).

## When you need it

- `byte[]` ↔ Lua string (`Bytes`)
- Assemble a struct from **multiple stack slots** or a **single table** (`UnpackedValues` / `Table`)
- Force **Opaque** for C#→Lua (`ref`/`out`/`in` **already default to this**)
- Huge `string` you do not want copied into a Lua string (`UserData` → ByObj)
- Precompiled / AOT DLL you cannot edit → attach XML in Settings (**non–hot-update** assemblies only)
- **Hot-update assemblies** (including HybridCLR) → **only** in-code `[LuaMarshalAs]`; XML is **not** supported

You may annotate: **parameters / return values / fields / properties / types (class, struct)**.
**Not** on methods; **not** on slots that still contain unbound generic type parameters.

## Common `LuaMarshalType` values

| Value | Applies to (summary) | Purpose |
|----|--------------|------|
| `Default` | All | No override |
| `Bytes` | `byte[]` / `string` | Octet ↔ Lua string |
| `OpaqueValue` | **C#→Lua only** | Push Opaque; byref already defaults to this |
| `UnpackedValues` | **struct** (**not** Nullable / class) | Consecutive stack slots ↔ `Members` |
| `Table` | **struct** / **`Nullable<struct>`** (not class) | Single table ↔ `Members` |
| `UserData` | Effectively almost only **`string`** | Force ByObjUserData |

`Table` / `UnpackedValues` **must** configure `Members`; a name ending in `?` means a missing Table key does not assign.

## Examples

### Bytes

```csharp
public void Send([LuaMarshalAs(LuaMarshalType.Bytes)] byte[] payload) { }
```

```lua
host:Send("\0\1\2\3")   -- Lua string，原始字节语义
```

### UnpackedValues (struct, multi-slot)

The parameter occupies **N** Lua stack slots (N = `Members` length); common on hot paths:

```csharp
using ZLua;

public struct Vec2 { public float X, Y; }

public class Mover
{
    public void Move(
        [LuaMarshalAs(LuaMarshalType.UnpackedValues, Members = new[] { "X", "Y" })]
        Vec2 delta) { /* ... */ }

    [return: LuaMarshalAs(LuaMarshalType.UnpackedValues, Members = new[] { "X", "Y" })]
    public Vec2 Origin() => new Vec2 { X = 0, Y = 0 };
}
```

```lua
local m = CSharp.AC.Mover()
m:Move(3.0, 4.0)           -- 两槽 → X, Y

local x, y = m:Origin()    -- C#→Lua 展开多返回值
print(x, y)
```

Type-level annotation (all default Marshal slots for that type):

```csharp
[LuaMarshalAs(LuaMarshalType.UnpackedValues, Members = new[] { "x", "y", "z" })]
public struct Vector3 { public float x, y, z; }
```

### Table (struct / Nullable\<struct\>)

Occupies **1** stack slot; more readable, but allocates a table on the Lua side:

```csharp
public struct Packet
{
    public int Id;
    public float X, Y;
    public string Tag;   // 可选键见 Members "?"
}

public void Submit(
    [LuaMarshalAs(LuaMarshalType.Table, Members = new[] { "Id", "X", "Y", "Tag?" })]
    Packet p) { }

public void TryPlace(
    [LuaMarshalAs(LuaMarshalType.Table, Members = new[] { "X", "Y" })]
    Vector2? pos) { }
```

```lua
host:Submit({ Id = 1, X = 2, Y = 3 })   -- Tag 可省略
host:TryPlace({ X = 1, Y = 2 })
host:TryPlace(nil)                      -- Nullable 无值
```

XML equivalent (**only** precompiled / AOT, non–hot-update assemblies; use Attributes on hot-update assemblies):

```xml
<Type fullName="UnityEngine.Vector3">
  <MarshalAs type="Table" members="x,y,z" />
</Type>
<Type fullName="UnityEngine.Transform">
  <Method name="LookAt" signature="(UnityEngine.Vector3)">
    <Param index="0">
      <MarshalAs type="UnpackedValues" members="x,y,z" />
    </Param>
  </Method>
</Type>
```

### OpaqueValue

```csharp
// by-val 强制 Opaque（C#→Lua）；ref/out/in 无需再标
public void PushPos([LuaMarshalAs(LuaMarshalType.OpaqueValue)] Vector3 p) { }
```

On the Lua side use `zlua.get_opaquevalue` / `set_opaquevalue`; **do not** keep across frames. See [0GC Marshal](/docs/guides/zero-gc-marshal/), [ref/out/in](/docs/guides/ref-out-in/).

### UserData (huge string)

Default: `string` ↔ Lua string (copies). With `UserData`, use **ByObjUserData** (managed `System.String`) to avoid building a huge Lua string:

```csharp
public void HandleHuge(
    [LuaMarshalAs(LuaMarshalType.UserData)] string payload) { }
```

Still allocates a **Lua userdata** for GC; uncommon — see [0GC Marshal](/docs/guides/zero-gc-marshal/).

### params pitfall

By default you **cannot** collect multiple slots implicitly as `Sum(1,2,3)`; pass a **single** table / array userdata / `nil`.

## Precedence (mnemonic)

**Slot Attribute → XML → type-level Attribute → built-in default**; Attribute beats XML.

Illegal type/direction → fall back to `Default` + Editor log; missing `Members`, etc. → **Bind / Generate fails**.

## Simple XML rules

Settings **MarshalAs Xml Paths**; Mono parses at runtime; Il2Cpp writes tables at **Generate**; **Player does not read XML**.

**XML does not apply to hot-update assemblies:** types / members in HybridCLR (and similar) hot-update DLLs **must** use in-code `[LuaMarshalAs]`.

Key points: `Param` uses **`index` (0-based, excluding this)**; `type` uses **`OpaqueValue`** (not deprecated names); aliases use the separate `luaAliasXmlPaths`. Full schema: [Spec §9](/docs/spec/marshal/02-MARSHAL-AS/).

## Learning path

| | |
|---|---|
| **Previous** | [ref / in / out](/docs/guides/ref-out-in/) |
| **Next** | [0GC Marshal](/docs/guides/zero-gc-marshal/) |

## Related

- [0GC Marshal](/docs/guides/zero-gc-marshal/)
- [Value types](/docs/guides/value-types/)
- [02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/)
- [OPAQUE](/docs/spec/marshal/04-OPAQUE/)
- [Marshal cheatsheet](/docs/reference/marshal-cheatsheet/)
