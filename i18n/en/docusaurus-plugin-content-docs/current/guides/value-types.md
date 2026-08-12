---
sidebar_position: 6
title: Value types
description: Default cross-boundary shapes and common usage for enum, struct, and Nullable.
---

# Value types

**enum**, **struct**, and **Nullable\<T\>** are value-type related shapes. Behavior follows [Struct Marshal](/docs/spec/marshal/05-STRUCT/) and [Enum Marshal](/docs/spec/marshal/08-ENUM/).

For lower-allocation patterns such as `Table` / `UnpackedValues` / Opaque, see [LuaMarshalAs](/docs/guides/lua-marshal-as/) and [0GC Marshal](/docs/guides/zero-gc-marshal/).

## Shape comparison

| Type | Default cross-boundary shape | Construct instance |
|------|----------------|----------|
| **enum** | integer / number (constants) | **No** `EnumType(...)` / `_ctor`; boxed only via `zlua.box` |
| **struct** | ByValUserData, etc. (see Spec) | `Type(...)` / `_default()` |
| **Nullable\<T\>** | Present → same as `T`; absent → Lua `nil` | — |

By default you **cannot** assemble a struct into C# with `{ X=1, Y=2 }` or `foo(x, y)`; use `Type(...)` / ByVal userdata, or explicit `[LuaMarshalAs(Table|UnpackedValues)]` (above).

## enum

Across the boundary the default is **integer / number** (constants on the type table are integers, not userdata):

```lua
local Color = CSharp.AC['MyGame.Color']
print(Color.Red)              -- 整型值，非 userdata
host:SetColor(Color.Red)
host:SetColor(1)              -- underlying 整型亦可
```

Compare constants as **integers**; do not treat them as userdata. The type table has **no** `__call` — **do not** write `Color(...)` / `Color._ctor(...)`.

When you need a **boxed** enum object (e.g. some `object` parameters, array slots), use only `zlua.box`:

```lua
local boxed = zlua.box(Color, Color.Red)
local boxed2 = zlua.box(Color, 2)
print(zlua.unbox(boxed))      -- underlying integer
```

Details: [Enum Marshal](/docs/spec/marshal/08-ENUM/).

## struct

```lua
local Point2D = CSharp.AC['MyGame.Point2D']
local origin = Point2D._default()
local p = Point2D(3, 4)
p.X = 10
p.Y = 20
```

| Passing | C# parameter | Behavior |
|------|---------|------|
| userdata (e.g. `Point2D(...)`) | by-val `Point2D` | **Copy** |
| userdata (same type) | `ref` / `out` / `in Point2D` | **True ref**, can write back |

Static members go through the type table; structs have **no inheritance**. `ref struct` is not ordinary by-val.

## Nullable\<T\>

- C# `null` (no value) ↔ Lua `nil`
- When present, marshal by the underlying `T` rules
- Do not pass `nil` to non-Nullable value types

## Full example (illustrative)

```csharp
namespace MyGame
{
    public enum Team { None = 0, Red = 1, Blue = 2 }

    public struct Vec2
    {
        public float X, Y;
        public Vec2(float x, float y) { X = x; Y = y; }
        public static float Dot(Vec2 a, Vec2 b) => a.X * b.X + a.Y * b.Y;
    }
}
```

```lua
local Team = CSharp.AC['MyGame.Team']
local Vec2 = CSharp.AC['MyGame.Vec2']
print(Team.Red)
print(Vec2.Dot(Vec2(1, 0), Vec2(0, 1)))
```

## Common mistakes

| Symptom | Fix |
|------|------|
| enum compared as userdata fails | Compare as integer |
| `Color(...)` / `Color._ctor` fails | enum has **no** type-table constructor; pass integer, or `zlua.box` |
| struct mutation not written back | by-val copy; for `ref` pass same-type userdata (`Type(...)`) or use Opaque |
| `{X=,Y=}` into unmarked struct | Annotate `Table` (see [LuaMarshalAs](/docs/guides/lua-marshal-as/)), or `Type(...)` first |
| `foo(x,y)` into unmarked struct | Annotate `UnpackedValues` (see [0GC Marshal](/docs/guides/zero-gc-marshal/)) |
| `ref struct` as by-val | Not supported |

## Learning path

| | |
|---|---|
| **Previous** | [C# calling Lua](/docs/guides/csharp-calling-lua/) |
| **Next** | [Function & Delegate](/docs/guides/functions/) |

## Related

- [0GC Marshal](/docs/guides/zero-gc-marshal/)
- [LuaMarshalAs](/docs/guides/lua-marshal-as/)
- [Struct Marshal](/docs/spec/marshal/05-STRUCT/)
- [Enum Marshal](/docs/spec/marshal/08-ENUM/)
- [ref / out / in](/docs/guides/ref-out-in/)
