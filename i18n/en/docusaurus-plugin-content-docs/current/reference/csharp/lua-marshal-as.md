---
sidebar_position: 3
title: LuaMarshalAs
description: "[LuaMarshalAs] attribute and LuaMarshalType enum."
---

# LuaMarshalAs

Overrides **default Marshal rules** for bidirectional C# ↔ Lua calls. Applied to parameters, return values, methods, or fields.

```csharp
using ZLua;

public void SendRaw([LuaMarshalAs(LuaMarshalType.Bytes)] byte[] data) { }

[return: LuaMarshalAs(LuaMarshalType.OpaqueLightUserData)]
public Point2D GetPointOnStack() { ... }
```

## Type Definitions

```csharp
public enum LuaMarshalType
{
    Default,
    UserData,
    Bytes,
    OpaqueLightUserData,
}

[Flags]
public enum LuaMarshalFlags
{
    None = 0,
    OptionalField = 1,  // missing key OK when assembling struct from table
}

[AttributeUsage(AttributeTargets.Parameter | AttributeTargets.ReturnValue
    | AttributeTargets.Method | AttributeTargets.Field)]
public sealed class LuaMarshalAsAttribute : Attribute
{
    public LuaMarshalType LuaMarshalType { get; }
    public LuaMarshalFlags Flags { get; set; }
    public LuaMarshalAsAttribute(LuaMarshalType luaMarshalType = LuaMarshalType.Default);
}
```

## LuaMarshalType

| Value | Direction | Effect |
|-------|-----------|--------|
| **Default** | Both | Use [Marshal cheatsheet](/docs/reference/marshal-cheatsheet/) defaults |
| **UserData** | Both | Force **full userdata** (instead of default boolean/number/string, etc.) |
| **Bytes** | Both | `byte[]` ↔ Lua **string** (raw octets, not UTF-8 text semantics) |
| **OpaqueLightUserData** | **C# → Lua only** | Push **lightuserdata** temp token (StructStackScope handle); use in the sync chain or upgrade via `zlua.to_user_data` |

## Legal Combinations (Summary)

`Default` is legal for all types. Below are values that may be annotated **explicitly besides Default**:

| C# Type | Legal LuaMarshalType |
|---------|----------------------|
| Primitives (bool, char, integers, float/double) | UserData |
| IntPtr / UIntPtr / nint / nuint | UserData |
| string | UserData, Bytes |
| byte[] | Bytes, UserData |
| T[] / multidimensional arrays | UserData |
| enum | UserData |
| struct | UserData, OpaqueLightUserData (latter C#→Lua only) |
| class / interface / Delegate / object | UserData |
| Nullable\<T\> | Same legal set as T |
| Unmanaged pointers, function pointers, TypedReference, decimal, ref struct | **Default only** (or type unsupported) |

**Direction filter:** `OpaqueLightUserData` on a pure **Lua→C# parameter** is illegal; Editor falls back to Default and logs an error.

Full rules: [LuaMarshalAs spec](/docs/spec/marshal/02-MARSHAL-AS/).

## Illegal Annotation Behavior

| Behavior | Description |
|----------|-------------|
| Marshal | Silently fall back to **Default**; call continues |
| Editor log | `[ZLua] Invalid LuaMarshalAs: ... falling back to Default` |
| Player | No log; still falls back to Default |

## Examples

### byte[] as Lua string

```csharp
public void Upload([LuaMarshalAs(LuaMarshalType.Bytes)] byte[] payload) { }
```

```lua
Upload("\001\002\003")  -- Lua string as byte sequence
```

### Force enum userdata

```csharp
public void SetColor([LuaMarshalAs(LuaMarshalType.UserData)] Color c) { }
```

```lua
local c = CSharp.AC['MyGame.Color'].Red
SetColor(c)
```

### C#→Lua on-stack struct temporary handle

```csharp
[return: LuaMarshalAs(LuaMarshalType.OpaqueLightUserData)]
public Point2D GetPointHandle() { ... }
```

```lua
local opaque = GetPointHandle()      -- lightuserdata, valid in sync chain
local ud = zlua.to_user_data(opaque) -- upgrade to StructUserData
```

## Resolution Priority

For a single parameter / return value:

1. `[LuaMarshalAs]` on the parameter / return value
2. Method-level `[LuaMarshalAs]` (covers the whole method unless overridden by a finer annotation)
3. Default

## Mono / Il2Cpp Support

| Runtime | Support |
|---------|:-------:|
| Mono (Editor) | ✅ |
| Il2Cpp (Player) | ✅ |

## Related

- [Marshal cheatsheet](/docs/reference/marshal-cheatsheet/)
- [ref / out / in guide](/docs/guides/ref-out-in/)
- [LuaMarshalAs spec](/docs/spec/marshal/02-MARSHAL-AS/)
- [Source LuaMarshalAsAttribute.cs](https://github.com/focus-creative-games/zlua/blob/main/Runtime/Common/LuaMarshalAsAttribute.cs)
