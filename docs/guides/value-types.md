---
sidebar_position: 6
title: 值类型与基础 0GC
description: enum、struct、Nullable；Table / UnpackedValues 高级传参。
---

# 值类型与基础 0GC

**enum**、**struct**、**Nullable\<T\>** 均为值类型相关形态。行为以 [Struct Marshal](/docs/spec/marshal/05-STRUCT/)、[Enum Marshal](/docs/spec/marshal/08-ENUM/) 为准。系统的 0GC 套路见 [0GC Marshal](/docs/guides/zero-gc-marshal/)。

## 形态对照

| 类型 | 默认跨边界形态 | 构造 userdata |
|------|----------------|---------------|
| **enum** | integer / number（常量） | `EnumType(value)` / `_ctor` |
| **struct** | ByValUserData 等（见规范） | `Type(...)` / `_default()` |
| **Nullable\<T\>** | 有值同 `T`；无值 → Lua `nil` | — |

默认 **不能** 用 `{ X=1, Y=2 }` 或 `foo(x, y)` 组装 struct 传入 C#，须 `Type(...)` / ByVal userdata，或显式 `[LuaMarshalAs(Table|UnpackedValues)]`。

## enum

```lua
local Color = CSharp.AC['MyGame.Color']
print(Color.Red)              -- 整型值，非 userdata
host:SetColor(Color.Red)
host:SetColor(1)              -- underlying 整型亦可
```

需要 boxed 实例（如部分 `ref` / 泛型约束）时：

```lua
local c = Color(Color.Red)
local c2 = Color._ctor(2)
```

比较常量时用 **integer**，不要当 userdata 比。

## struct

```lua
local Point2D = CSharp.AC['MyGame.Point2D']
local origin = Point2D._default()
local p = Point2D(3, 4)
p.X = 10
p.Y = 20
```

| 传递 | C# 形参 | 行为 |
|------|---------|------|
| userdata | by-val `Point2D` | **拷贝** |
| userdata | `ref Point2D` | **真 ref**，可写回 |
| `zlua.new_ref(...)` | `ref`/`out` | 真 ref |

静态成员经类型表访问；struct **无继承**。`ref struct` 不作普通 by-val。

## Nullable\<T\>

- C# `null`（无值）↔ Lua `nil`  
- 有值时按底层 `T` 的规则 Marshal  
- 不要给非 Nullable 的值类型传 `nil`  

## 高级：`UnpackedValues` / `Table`

需要「像多返回值 / 像 table」传 struct 时，在 C# 侧标 `[LuaMarshalAs]`（仅 **struct** / 闭合泛型 struct；`Table` 另允许 **`Nullable<struct>`**）。细则与更多例子见 [LuaMarshalAs](/docs/guides/lua-marshal-as/)。

### UnpackedValues — 多栈槽（无 table、无 ByVal userdata）

适合热路径展开 `Vector2` / `Vector3` 等；Lua 侧只传数字，**不**为 struct 建 userdata 或 table。

```csharp
public void Move(
    [LuaMarshalAs(LuaMarshalType.UnpackedValues, Members = new[] { "X", "Y" })]
    Vector2 delta) { }
```

```lua
host:Move(1.0, 2.0)   -- 两槽 → X, Y；占用 2 个参数位
```

:::note
`UnpackedValues` **不能**标在 `Nullable<T>` 上（多槽无法用 `nil` 区分「无值」）。可空 struct 用下面的 `Table`。
:::

### Table — 单个 Lua table

适合可读的键值组装；`Nullable<struct>` 可用 `nil` 表示无值。

```csharp
public void Place(
    [LuaMarshalAs(LuaMarshalType.Table, Members = new[] { "X", "Y", "Z?" })]
    Vector3? pos) { }   // 或非 Nullable 的 Vector3
```

```lua
host:Place({ X = 1, Y = 2 })   -- Z 可选（Members 里带 ?）
host:Place(nil)                -- 仅 Nullable：无值
```

`Table` 会在 Lua 侧用到 **table**（有分配）；要追求 Lua 侧更少分配，优先 `UnpackedValues` 或 [0GC Marshal](/docs/guides/zero-gc-marshal/)。

## 简单 0GC 直觉

| 建议 | 原因 |
|------|------|
| 字段直访 `p.X` | 少一层方法调用；Il2Cpp 可走 offset |
| enum 用 integer 常量 | 避免无谓 boxing |
| 热路径传 struct 用 `UnpackedValues` | 避免 ByVal userdata / table |
| 搞清 by-val **拷贝** | 要写回须 `ref` / Opaque |
| 避免每帧走 dispatch | `[LuaAlias]` / `register_method` 或缓存 closure |

## 完整示例（示意）

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

## 常见错误

| 现象 | 处理 |
|------|------|
| enum 当 userdata 比较失败 | 用 integer 比较 |
| struct 修改未回写 | by-val 拷贝；改用 `ref` / `new_ref` |
| `{X=,Y=}` 传入未标注的 struct | 标 `Table`，或先 `Type(...)` |
| `foo(x,y)` 传入未标注的 struct | 标 `UnpackedValues` |
| `ref struct` 作 by-val | 不支持 |





## 学习路径

| | |
|---|---|
| **上一篇** | [C# 调用 Lua](/docs/guides/csharp-calling-lua/) |
| **下一篇** | [Function 与 Delegate](/docs/guides/functions/) |

## 相关文档

- [0GC Marshal](/docs/guides/zero-gc-marshal/)  
- [LuaMarshalAs](/docs/guides/lua-marshal-as/)  
- [Struct Marshal](/docs/spec/marshal/05-STRUCT/)  
- [ref / out / in](/docs/guides/ref-out-in/)
