---
sidebar_position: 2
title: Lua 访问 C# 基础
description: 通过 CSharp 根表访问 C# 类型与成员。
---

# Lua 访问 C# 基础

Lua 侧通过全局 **`CSharp`** 根表访问所有 C# 类型，语义贴近 C#：`Type()` 构造、`obj:Method()` 调用实例方法、静态成员走类型表。

Canonical 示例：[zlua-demo/LuaScripts/app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua)、[Assets/Demo.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Demo.cs)

## 概述

- 类型与程序集 **懒加载**：首次访问时注册元表
- 仅 **public** 成员可见
- 静态成员与实例成员使用 **独立** 元数据，不可混用

## CSharp 表结构

```
CSharp                          -- 根表
  └─ Assembly-CSharp            -- 程序集（默认游戏脚本）
       └─ Demo                   -- 无 namespace 的全局类型
       └─ ['MyGame.UI.Panel']     -- 含 namespace 必须括号
```

### 程序集别名（推荐）

程序集名较长时设短别名：

```lua
CSharp['AC'] = CSharp['Assembly-CSharp']

local demo = CSharp.AC.Demo()
```

Demo 在 [app.lua 第 1 行](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua) 使用此惯例。

## 类型解析规则

| 类型 | Lua 访问 |
|------|----------|
| 无 namespace 全局类 | `CSharp.AC.Demo` |
| 含 namespace | `CSharp.AC['MyGame.UI.Panel']` |
| 嵌套类型 | `CSharp.AC['Outer+Nested']`（`+` 分隔，须括号） |
| mscorlib / System | `CSharp.mscorlib['System.Int32']` 等 |

:::warning
含 **点号的 namespace** 不能用 `CSharp.AC.MyGame.UI.Panel` 链式访问，**必须**用字符串键：`CSharp.AC['MyGame.UI.Panel']`。
:::

## 构造实例

无参构造直接 **调用类型表**：

```lua
local demo = CSharp.AC.Demo()
```

等价于 C# 的 `new Demo()`。有参构造在 Mono 上支持重载 dispatch；多构造函数见 [方法重载](./methods-and-overloads)。

## 静态成员

```lua
-- 静态方法
local sum = CSharp.AC.Demo.Add(3, 5)

-- 静态字段
CSharp.AC.Demo.s_x = 10
local x = CSharp.AC.Demo.GetSX()
```

## 实例成员

```lua
local demo = CSharp.AC.Demo()

-- 实例方法（冒号语法传递 self）
demo:SetX(10)
local v = demo:GetX()

-- 字段（与无参 Property 写法相同）
demo.x = 20
print(demo.x)
```

### 点号 vs 冒号

| 语法 | 含义 |
|------|------|
| `demo:GetX()` | 实例方法，等价 C# `demo.GetX()` |
| `CSharp.AC.Demo.Add(3,5)` | 静态方法 |
| `demo.x` | 字段或无参 property |

## 继承

子类实例可调用基类 public 实例成员；静态成员走 **声明类型** 的类型表。继承链上的重载与 `new` 隐藏规则见 [类型系统规范](../spec/type-system-spec) §5。

## nil 与 null

- Lua **`nil`** 传给 C# 引用类型形参 → **`null`**
- C# 返回 `null` 引用 → Lua **`nil`**
- 值类型 struct **不能**为 nil（除非 `Nullable<T>`）

## 完整示例（摘自 Demo）

```lua
local function test_call_static_method()
    print("Demo.Add:", CSharp.AC.Demo.Add(3, 5))
    print("Demo.Multi:", CSharp.AC.Demo.Multi(3, 5))
end

local function test_call_instance_method()
    local demo = CSharp.AC.Demo()
    print("Demo:GetX():", demo:GetX())
end

local function test_access_instance_field()
    local demo = CSharp.AC.Demo()
    demo:SetX(10)
    assert(demo.x == 10)
    demo.x = 20
    assert(demo:GetX() == 20)
end
```

## Mono / Il2Cpp 支持

| 能力 | Mono | Il2Cpp |
|------|:----:|:------:|
| `CSharp` 懒加载 | ✅ | ✅ |
| 无 namespace 类型 | ✅ | ✅ |
| namespace 括号访问 | ✅ | ⚠️ 随类型扩展 |
| 静态 / 实例字段 | ✅ | ✅ |
| 静态 / 实例方法 | ✅ | ⚠️ 手写桥接 |
| 继承 | ✅ | ⚠️ |

## 常见错误

| 错误信息 / 现象 | 处理 |
|-----------------|------|
| `type not found` | 检查程序集名、namespace 括号、类型是否 public |
| `static member not found` | 勿通过实例访问静态成员；用类型表 |
| `instance member not found` | 键名拼写；该成员是否 public |
| 嵌套类型失败 | 使用 `Outer+Nested` 全名 |

## 相关文档

- [字段与属性](./fields-and-properties)
- [方法重载](./methods-and-overloads)
- [类型系统规范](../spec/type-system-spec)
- [CSharp API 参考](../reference/lua/csharp-root)
