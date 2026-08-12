---
sidebar_position: 7
title: Function 与 Delegate
description: Lua function ↔ C# Delegate 的三条路径与注意事项。
---

# Function 与 Delegate

| 路径 | 写法 | 说明 |
|------|------|------|
| **Lua → C# 形参** | `obj:Foo(function(...) end)` | 隐式 `ReadDelegate` |
| **C# → Lua**（回调槽） | `handler(...)` | 可能是 **function** 或 DelegateUserData；统一用调用语法 |
| **C# 按名取 Lua** | `GetFunction<T>(mod, name)` | 见 [C# 调用 Lua](/docs/guides/csharp-calling-lua/) |

权威：[函数 Marshal](/docs/spec/marshal/09-FUNCTION/)、[`to_delegate`](/docs/spec/05-LIB/)。

## 1. Lua function 作为 C# 参数

```csharp
public void RegisterCallback(System.Action<int> onValue)
{
    onValue?.Invoke(42);
}
```

```lua
host:RegisterCallback(function(v)
    print("callback:", v)
end)
```

日常 **不必** 手写 `to_delegate`：按形参 delegate 类型自动创建 closed delegate。

| Lua 实参 | 结果 |
|----------|------|
| `function` | 按形参类型创建 |
| `nil` | `null` |
| 已有 delegate userdata | 直接传递 |
| 其它 | 类型错误 |

属性上挂回调同样可以：

```lua
logic.Combine = function(a, b) return a + b end
print(logic:Run(3, 5))
```

## 2. C# 侧回调传到 Lua

从 C# 取回的回调槽 **统一** 用调用语法：

```lua
local handler = host:GetHandler()
handler(42)
```

| 槽位来源 | `type(handler)` | 说明 |
|----------|-----------------|------|
| 原生 C# delegate | userdata（`__call`） | `handler(...)` 即可 |
| Lua function 经 C# 再传回 | **`function`** | 仍是 Lua function，**不是** delegate |

因此 **不要** 依赖 `handler:Invoke(...)`：对 function 无效，且与「往返后仍是 function」的设计不一致。细则见 [09-FUNCTION](/docs/spec/marshal/09-FUNCTION/)。

:::warning
原生 **Open delegate**（`target == null`）当前不支持。
:::

## 3. 何时用 GetFunction / to_delegate

| 场景 | 做法 |
|------|------|
| 已知模块 + 方法名 + 具体 `T` | **`GetFunction<T>`** |
| Lua 侧已有 function，要指定委托类型 | `zlua.to_delegate(fn, closedDelegateType)` |
| C# 形参已是具体 `Action`/`Func` | 直接传 `function` |

`to_delegate` 第二参须为 **已闭合** 类型（如 `Action<int>`），不是开放泛型。

## 4. Event 与生命周期

- Event 用 `add_` / `remove_`（见 [Lua 调用 C#](/docs/guides/lua-calling-csharp/#5-eventadd_--remove_)）
- 取消订阅须 **同一** function 引用
- multicast 保持多播语义；Lua function 经 registry ref——避免 C# 长期持有 delegate 却销毁 Lua 环境

## 常见错误

| 现象 | 原因 |
|------|------|
| `expects delegate X` | 非 function 且非 delegate |
| 回调未执行 | C# 未 Invoke；或 GetFunction 结果未缓存就丢弃 |
| `to_delegate` 类型不对 | 第二参不是闭合委托类型 |
| remove 无效 | 不是同一 function 引用 |

## 学习路径

| | |
|---|---|
| **上一篇** | [值类型](/docs/guides/value-types/) |
| **下一篇** | [数组](/docs/guides/arrays/) |

## 相关文档

- [C# 调用 Lua](/docs/guides/csharp-calling-lua/)
- [函数 Marshal](/docs/spec/marshal/09-FUNCTION/)
- [从 xLua 迁移](/docs/guides/migration/from-xlua/)
