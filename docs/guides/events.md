---
sidebar_position: 9
title: Event
description: 通过 add_/remove_ 普通方法订阅 C# event（无专用元表）。
---

# Event

ZLua **不提供** Event 专用元表（无 `{ get, set, fire }`）。C# `event` 编译器生成的 **`add_EventName` / `remove_EventName`** 作为普通方法进入 `methodTable`，与其它实例/静态方法相同。

规范见 [类型系统](../spec/02-TYPE-SYSTEM)、[成员绑定](../spec/metatable/03-BINDING)。

## 概述

| C# | Lua |
|----|-----|
| `obj.Foo += handler` | `obj:add_Foo(handler)` |
| `obj.Foo -= handler` | `obj:remove_Foo(handler)` |
| 静态 event | `Type.add_Foo(handler)` / `Type.remove_Foo(handler)` |

`handler` 为 Lua `function`，按 [回调与 Delegate](./callbacks-and-delegates) 隐式 marshal。

## 静态 event

```csharp
public class EventPublisher
{
    public static event System.Action<int> OnGlobalTick;
    public static void RaiseTick(int v) => OnGlobalTick?.Invoke(v);
}
```

```lua
local handler = function(v)
    print("tick:", v)
end

CSharp.AC.EventPublisher.add_OnGlobalTick(handler)
-- ...
CSharp.AC.EventPublisher.remove_OnGlobalTick(handler)  -- 须同一 function 引用
```

## 实例 event

```csharp
public class Player
{
    public event System.Action<int> OnHealthChanged;
    public void Hurt(int dmg) => OnHealthChanged?.Invoke(dmg);
}
```

```lua
local player = CSharp.AC.Player()
local handler = function(hp) print("hp:", hp) end

player:add_OnHealthChanged(handler)
player:remove_OnHealthChanged(handler)
```

## 与旧文档 / xLua 的差异

| | xLua / 旧 ZLua 文档 | 当前 ZLua |
|---|------|------|
| 订阅 | 语法糖或 `.get` | **`add_*` 方法** |
| 取消 | `.set` / `-` | **`remove_*` 方法** |
| 专用子表 | 可能有 | **无** |

## Mono / Il2Cpp 支持

| 能力 | Mono | Il2Cpp |
|------|:----:|:------:|
| `add_Xxx` / `remove_Xxx` | ✅ | ✅ |
| Event 专用元表（`{get,set,fire}`） | ❌ | ❌ |
| Lua function 作 handler | ✅ | ✅ |

两端 **Lua 可见语义一致**；`add_` / `remove_` 为普通方法，无专用元表。

## 常见错误

| 现象 | 处理 |
|------|------|
| `OnX.get is nil` | 已废弃；改用 `add_OnX` |
| remove 无效 | 必须与 add 时为 **同一** Lua function |
| 找不到 `add_OnX` | 确认 C# event 名为 `OnX`；方法名为 `add_OnX` |








## 学习路径

| | |
|---|---|
| **上一篇** | [Lua 模块加载](./lua-module-loading) |
| **下一篇** | [enum 与 struct](./enums-and-structs) |

## 相关文档

- [回调与 Delegate](./callbacks-and-delegates)
- [成员绑定规范](../spec/metatable/03-BINDING)
- [函数编组](../spec/marshal/09-FUNCTION)
