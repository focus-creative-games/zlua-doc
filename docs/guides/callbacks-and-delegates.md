---
sidebar_position: 5
title: 回调与 Delegate
description: Lua function 与 C# delegate 的双向编组。
---

# 回调与 Delegate

ZLua 在 **Lua function ↔ C# Delegate** 两个方向上均提供统一编组：Lua 调用带 delegate 形参的 C# 方法时 **隐式** 转换；C# delegate 传入 Lua 时可像 callable 对象一样调用。

## 概述

| 方向 | Lua 写法 | 说明 |
|------|----------|------|
| **Lua → C#** | `obj:RegisterCallback(function(v) ... end)` | 方法 marshal 层自动 `ReadDelegate` |
| **C# → Lua** | `handler(42)` 或 `handler:Invoke(42)` | delegate 为普通 class userdata + `__call` |

无需手动 `to_delegate`（除非显式 API 场景）。详见 [函数编组规范](../spec/marshal/function) §4。

## Lua function 作为 C# delegate 参数

### 基本用法

C#：

```csharp
public class CallbackHost
{
    public void RegisterCallback(System.Action<int> onValue)
    {
        onValue?.Invoke(42);
    }
}
```

Lua：

```lua
local host = CSharp.AC.CallbackHost()

host:RegisterCallback(function(v)
    print("callback:", v)
end)
```

流程：栈上 Lua function → `luaL_ref` → `LuaDelegateBinder.Create(Action<int>, ref)` → 填入形参 → C# 调用。delegate 未被 C# 长期持有时，随 GC 释放 Lua 引用。

### 支持的 handler 类型

| Lua 实参 | C# 形参结果 |
|----------|-------------|
| `function ... end` | 按形参 **delegate 类型** 创建 closed delegate |
| `nil` | `null` |
| 已有 delegate userdata | 直接传递 |
| 其它类型 | 类型不匹配错误 |

形参类型以 C# 方法声明为准（如 `Action<int>`、`Func<string, bool>`），Lua 侧 **不需要** 再传类型。

### 多播与生命周期

- C# **multicast** delegate 保持多播语义
- Lua function 被 ref 到 registry；避免在 C# 中长期持有 delegate 却销毁 Lua 环境
- 同一 Lua function 多次注册到同一 event 的行为与 C# `+=` 一致

## C# delegate 传入 Lua

delegate 实例与普通 **class userdata** 相同：

```lua
local handler = host:GetHandler()   -- C# 返回 Action<int>

handler(42)              -- IMT.__call → Invoke
handler:Invoke(42)       -- 显式 Invoke
```

`MulticastDelegate` 子类的实例元表注册 `__call`，收集参数并转发 `Invoke`。

:::warning
**Open delegate**（`target == null`）MVP 不支持。
:::

## 与 Event 的关系

Event 订阅也走 delegate marshal：`event.get` 接受 Lua function 并转为 add 处理器。详见 [Event](./events)。

## 完整示例（示意）

```csharp
// GameLogic.cs
public class GameLogic
{
    public System.Func<int, int, int> Combine { get; set; }

    public int Run(int a, int b)
    {
        return Combine != null ? Combine(a, b) : 0;
    }
}
```

```lua
local logic = CSharp.AC.GameLogic()
logic.Combine = function(a, b) return a + b end
print(logic:Run(3, 5))   -- 8
```

## Mono / Il2Cpp 支持

| 能力 | Mono | Il2Cpp |
|------|:----:|:------:|
| Lua function → delegate 形参 | ✅ | ❌ |
| delegate userdata + `__call` | ✅ | ❌ |
| `Action` / `Func` 常见签名 | ✅ | ❌ |
| 泛型 delegate | ✅ | ❌ |

## 常见错误

| 现象 | 原因 |
|------|------|
| `expects delegate X` | 传入非 function 且非 delegate |
| 回调未执行 | C# 侧未调用；或 delegate 为 null |
| 重复订阅无效移除 | Event 须用 **同一** function 引用 `set` 移除 |
| Player 崩溃 | Il2Cpp MVP 不支持 delegate |

## 相关文档

- [函数编组规范](../spec/marshal/function)
- [Event](./events)
- [类型系统规范](../spec/type-system-spec) — 委托类型表
