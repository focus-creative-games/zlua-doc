---
sidebar_position: 10
title: 枚举与 struct
description: Lua 侧使用 C# enum 与 struct 值类型。
---

# 枚举与 struct

**enum** 与 **struct** 均为值类型，但在 Lua 中的默认形态与构造方式不同。Mono 下均已完整支持。

## 概述

| 类型 | 默认跨边界形态 | 构造 userdata |
|------|----------------|---------------|
| **enum** | integer / number（常量） | `EnumType(value)` / `_ctor` |
| **struct** | StructUserData 或拷贝 | `Type(...)` / `_default()` |

详见 [类型系统规范](../spec/type-system-spec) §3.5、§3.6 与 [Struct 编组规范](../spec/marshal/struct)。

---

## 枚举（enum）

### 访问常量

枚举常量在类型表上暴露为 **integer**（Lua 5.4 优先）或 **number**：

```lua
local Color = CSharp.AC['MyGame.Color']

print(Color.Red)      -- 整型值，非 userdata
print(Color.Green)
```

### 比较与传参

默认 marshal：**enum 形参接受 integer/number**，无需 boxed userdata：

```csharp
public void SetColor(MyGame.Color c) { ... }
```

```lua
host:SetColor(Color.Red)
host:SetColor(1)   -- underlying 整型值
```

### 构造 enum userdata

需要 **boxed enum 实例**（如 `ref`、泛型约束）时：

```lua
local c = Color(Color.Red)           -- __call → _ctor
local c2 = Color._ctor(2)            -- 等价
```

非法 underlying 值 → Lua error。

---

## struct

### 类型表标记

struct 类型表含 `__struct : true` 元数据，与 class 区分。

### 默认实例

```lua
local Point2D = CSharp.AC['MyGame.Point2D']

local origin = Point2D._default()    -- default(T) userdata
local p = Point2D(3, 4)              -- 有参构造，dispatch
```

### 字段读写

struct 实例 userdata 支持 public 实例字段 / 属性（经 `IMT`）：

```lua
p.X = 10
p.Y = 20
```

### 传参：by-val vs ref

| 传递方式 | C# 形参 | 行为 |
|----------|---------|------|
| `Point2D(1,2)` | by-val `Point2D` | **拷贝** |
| `Point2D(1,2)` | `ref Point2D` | **真 ref**，C# 修改回写 |
| `zlua.new_ref(Point2D, ...)` | `ref`/`out` | 真 ref |

见 [ref / out / in](./marshal-ref-out-in)。

### 静态成员

struct 的 static 成员经类型表 `SMT` 访问，与 class 相同：

```lua
local max = Point2D.MaxValue   -- 若 C# 定义 static 成员
```

struct **无继承**；静态成员不沿继承链查找。

---

## 完整示例（示意）

C#：

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

Lua：

```lua
CSharp.AC = CSharp['Assembly-CSharp']
local Team = CSharp.AC['MyGame.Team']
local Vec2 = CSharp.AC['MyGame.Vec2']

print(Team.Red)                    -- 1

local a = Vec2(1, 0)
local b = Vec2(0, 1)
print(Vec2.Dot(a, b))              -- 0

local refA = Vec2(1, 0)
CSharp.AC.MyGame.Vec2Helper.Normalize(refA)   -- ref 修改 a
```

---

## Mono / Il2Cpp 支持

| 能力 | Mono | Il2Cpp |
|------|:----:|:------:|
| enum 常量 integer | ✅ | ❌ |
| enum 传参 default | ✅ | ❌ |
| enum userdata 构造 | ✅ | ❌ |
| struct 构造 / 字段 | ✅ | ❌ |
| ref struct | ✅ | ❌ |

---

## 常见错误

| 现象 | 处理 |
|------|------|
| enum 当 userdata 比较失败 | 默认用 integer 比较 |
| struct 修改未回写 | by-val 拷贝；改用 `ref` 或 `new_ref` |
| 找不到 struct 类型 | namespace 括号路径 |
| `ref struct` 作 by-val | 不支持；须 ref 路径 |

## 学习路径

| | |
|---|---|
| **上一篇** | [Event](./events) |
| **下一篇** | [排错指南](./troubleshooting) |

## 相关文档

- [ref / out / in](./marshal-ref-out-in)
- [Struct 编组规范](../spec/marshal/struct)
- [类型系统规范](../spec/type-system-spec) §3.5–§3.6
