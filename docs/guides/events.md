---
sidebar_position: 9
title: Event
description: Lua 侧订阅与触发 C# event。
---

# Event

C# **event** 在 Lua 侧暴露为特殊表 `{ get, set, fire? }`，分别对应 `add` / `remove` / `raise` 语义（命名对齐 event accessor，**不是** property 的 get/set）。

实现见 `EventAccess.cs`；规范见 [类型系统规范](../spec/type-system-spec) §4.5。

## 概述

| 字段 | C# 语义 | Lua 用法 |
|------|---------|----------|
| **get** | `add` 处理器 | 传入 Lua function → 隐式 marshal 为 delegate |
| **set** | `remove` 处理器 | 须移除 **经 get 注册的同一** handler |
| **fire** | 触发（若有 raise 元数据） | 测试 / 内部用，视类型而定 |

订阅 handler 走与 [回调与 Delegate](./callbacks-and-delegates) 相同的 Lua function → delegate 路径。

## 静态 event

C#：

```csharp
public class EventPublisher
{
    public static event System.Action<int> OnGlobalTick;

    public static void RaiseTick(int v) => OnGlobalTick?.Invoke(v);
}
```

Lua：

```lua
local handler = function(v)
    print("tick:", v)
end

-- 订阅：get ≈ +=
CSharp.AC.EventPublisher.OnGlobalTick.get(handler)

-- 取消：set ≈ -=（须同一 function 引用）
CSharp.AC.EventPublisher.OnGlobalTick.set(handler)
```

静态 event 的 `get` / `set` **第一个参数不是 self**，直接传 handler。

## 实例 event

C#：

```csharp
public class Player
{
    public event System.Action<int> OnHealthChanged;

    public void Hurt(int dmg) => OnHealthChanged?.Invoke(dmg);
}
```

Lua：

```lua
local player = CSharp.AC.Player()
local handler = function(hp) print("hp:", hp) end

player.OnHealthChanged.get(player, handler)
player.OnHealthChanged.set(player, handler)
```

实例 event：**第一个参数为对象实例**，第二个为 handler。

## fire（可选）

若类型暴露 raise 方法，event 表可能含 `fire` 字段用于触发（多用于测试或特定 API）。生产逻辑通常由 C# 代码 `Invoke` event。

## 与 delegate 字段的区别

| | event 表 | delegate 字段/属性 |
|---|----------|------------------|
| 订阅 | `.get(...)` | 赋值 `=` 或 `add` 不适用 |
| 取消 | `.set(...)` | 赋 `nil` |
| 外部触发 | 仅 C# 内 | 可直接 `handler()` |

## Mono / Il2Cpp 支持

| 能力 | Mono | Il2Cpp |
|------|:----:|:------:|
| 静态 event | ✅ | ❌ |
| 实例 event | ✅ | ❌ |
| Lua function 订阅 | ✅ | ❌ |
| 常见 `Action`/`EventHandler` | ✅ | ❌ |

## 常见错误

| 现象 | 处理 |
|------|------|
| `handler was not registered through get` | 移除时须用 **同一** Lua function |
| 实例 event 少传 self | `get(obj, handler)` 两个参数 |
| 静态 event 多传 self | 静态仅 `get(handler)` |
| Player 失败 | Il2Cpp 未支持 Event |

## 学习路径

| | |
|---|---|
| **上一篇** | [Lua 模块加载](./lua-module-loading) |
| **下一篇** | [enum 与 struct](./enums-and-structs) |

## 相关文档

- [回调与 Delegate](./callbacks-and-delegates)
- [类型系统规范](../spec/type-system-spec) §4.5
- [函数编组规范](../spec/marshal/function)
