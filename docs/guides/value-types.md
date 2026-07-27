---
sidebar_position: 6
title: 值类型与基础 0GC
description: enum、struct、Nullable 的用法，以及默认路径下的简单 0GC 注意点。
---

# 值类型与基础 0GC

**enum**、**struct**、**Nullable\<T\>** 均为值类型相关形态。行为以 [Struct Marshal](/docs/spec/marshal/05-STRUCT/)、[Enum Marshal](/docs/spec/marshal/08-ENUM/) 为准。高级 0GC（Opaque / Unpacked）见 [LuaMarshalAs](/docs/guides/lua-marshal-as/)。

## 形态对照

| 类型 | 默认跨边界形态 | 构造 userdata |
|------|----------------|---------------|
| **enum** | integer / number（常量） | `EnumType(value)` / `_ctor` |
| **struct** | ByValUserData 等（见规范） | `Type(...)` / `_default()` |
| **Nullable\<T\>** | 有值同 `T`；无值 → Lua `nil` | — |

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

## 简单 0GC 直觉

默认路径下，热路径应尽量：

| 建议 | 原因 |
|------|------|
| 字段直访 `p.X` | 少一层方法调用；Il2Cpp 可走 offset |
| enum 用 integer 常量 | 避免无谓 boxing |
| 搞清 by-val **拷贝** | 改字段却期望写回 C# 侧时，须 `ref` / Opaque（见下章） |
| 避免每帧走 dispatch / 拼长键 | 用 `[LuaAlias]` / `register_method` 短名，或缓存 direct closure |

**不会**在本篇展开：`OpaqueValue`、`UnpackedValues`、XML MarshalAs——那是「默认不够用」时的工具，见 [ref/out/in](/docs/guides/ref-out-in/) 与 [LuaMarshalAs](/docs/guides/lua-marshal-as/)。

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
| `ref struct` 作 by-val | 不支持 |






## 学习路径

| | |
|---|---|
| **上一篇** | [C# 调用 Lua](/docs/guides/csharp-calling-lua/) |
| **下一篇** | [Function 与 Delegate](/docs/guides/functions/) |

## 相关文档

- [Struct Marshal](/docs/spec/marshal/05-STRUCT/)  
- [类型系统 §3.5–3.6](/docs/spec/02-TYPE-SYSTEM/)  
- [ref / out / in](/docs/guides/ref-out-in/)
