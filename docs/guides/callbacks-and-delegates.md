---
sidebar_position: 5
title: 回调与 Delegate
description: Lua function 与 C# delegate 双向 Marshal；GetFunction 按名取回调。
---

# 回调与 Delegate

ZLua 在 **Lua function ↔ C# Delegate** 上提供统一 Marshal，覆盖三条常用路径：

| 路径 | 写法 | 说明 |
|------|------|------|
| **Lua → C# 形参** | `obj:Foo(function(...) end)` | 方法 marshal 隐式 `ReadDelegate` |
| **C# delegate → Lua** | `handler(42)` / `handler:Invoke(42)` | DelegateUserData + `__call` |
| **C# 按名取 Lua 函数** | `LuaAppDomain.GetFunction<T>(mod, name)` | 绑定为 `T` 后由 C# 持有并调用 |

权威细则：[函数 Marshal 规范](../spec/marshal/09-FUNCTION)、[`GetFunction`](../spec/01-HOST-API)、[`zlua.to_delegate`](../spec/05-LIB)。

---

## 1. Lua function 作为 C# 方法参数

### 基本用法

```csharp
public class CallbackHost
{
    public void RegisterCallback(System.Action<int> onValue)
    {
        onValue?.Invoke(42);
    }
}
```

```lua
local host = CSharp.AC.CallbackHost()
host:RegisterCallback(function(v)
    print("callback:", v)
end)
```

流程：栈上 Lua function → `luaL_ref` → 按形参 **delegate 类型** 创建 closed delegate → 填入形参。日常场景 **不必** 手写 `to_delegate`。

### 支持的实参

| Lua 实参 | C# 形参结果 |
|----------|-------------|
| `function ... end` | 按形参 delegate 类型创建 closed delegate |
| `nil` | `null` |
| 已有 delegate userdata | 直接传递 |
| 其它 | 类型不匹配错误 |

### 多播与生命周期

- C# multicast 保持多播语义
- Lua function 被 ref 到 registry；避免 C# 长期持有 delegate 却销毁 Lua 环境
- Event：`add_` / `remove_`，取消订阅须同一 function 引用，见 [Event](./events)

---

## 2. C# delegate 传入 Lua

```lua
local handler = host:GetHandler()   -- C# 返回 Action<int>
handler(42)              -- IMT.__call → Invoke
handler:Invoke(42)
```

:::warning
**Open delegate**（`target == null`）当前不支持。
:::

---

## 3. `GetFunction`：把 Lua 函数交给 C#

C# 需要 **主动按模块/方法名** 拿到 Lua 导出函数并多次调用时，使用：

```csharp
public static T GetFunction<T>(string luaModule, string luaMethodName)
    where T : MulticastDelegate;
```

### 3.1 基本用法

```csharp
var onTick = LuaAppDomain.GetFunction<Action<float>>("game", "OnTick");
onTick(0.016f);

var add = LuaAppDomain.GetFunction<Func<int, int, int>>("app", "add");
Debug.Log(add(1, 2));
```

```lua
-- game.lua
local function OnTick(dt)
    print("tick", dt)
end
return { OnTick = OnTick }
```

热路径请自行缓存返回的 delegate（见 [C# 调用 Lua](./csharp-to-lua)）。

权威规范：[宿主 API §2](../spec/01-HOST-API)、[LuaAppDomain](../reference/csharp/lua-app-domain)。

### 3.2 与 `zlua.to_delegate`

| 场景 | 做法 |
|------|------|
| 已知模块名 + 方法名 + 具体 `T` | **`GetFunction<T>`**（推荐） |
| Lua 侧已有 function，要指定委托类型 | `zlua.to_delegate(fn, delegateType)` |
| C# 方法形参已是具体 `Action`/`Func` | Lua 直接传 `function`，**隐式** marshal |

`zlua.to_delegate` 见 [zlua 库规范](../spec/05-LIB)。

### 3.3 与形参隐式 marshal 的对比

| 需求 | 推荐 |
|------|------|
| C# 调某个 Lua 导出函数 | `GetFunction<T>(mod, name)` |
| Lua 调用 C# 时传入回调 | 形参类型为 delegate，直接传 `function` |
| 从 xLua `Get<Action>` / `LuaFunction` 迁移 | `GetFunction`；见 [从 xLua 迁移](../community/migration/from-xlua) |

---

## 4. 完整示例（属性上挂 Lua function）

```csharp
public class GameLogic
{
    public System.Func<int, int, int> Combine { get; set; }

    public int Run(int a, int b) =>
        Combine != null ? Combine(a, b) : 0;
}
```

```lua
local logic = CSharp.AC.GameLogic()
logic.Combine = function(a, b) return a + b end
print(logic:Run(3, 5))   -- 8
```

---

## Mono / Il2Cpp 支持

| 能力 | Mono | Il2Cpp |
|------|:----:|:------:|
| Lua function → delegate 形参 | ✅ | ✅ |
| `GetFunction<T>` | ✅ | ✅ |
| `zlua.to_delegate` | ✅ | ✅ |
| delegate userdata + `__call` | ✅ | ✅ |
| 泛型 delegate | ✅ | ✅ |

---

## 常见错误

| 现象 | 原因 |
|------|------|
| `expects delegate X` | 传入非 function 且非 delegate |
| 回调未执行 | C# 未 Invoke；或 GetFunction 结果未保存就丢弃 |
| 以为「不能把 Lua 函数给 C#」 | 未使用 **`GetFunction`**（见 §3） |
| `to_delegate` 类型不对 | 第二参须为 **已闭合** 的具体 delegate 类型（如 `Action<int>`），不是开放泛型 |
| 重复订阅无效移除 | Event 须用 **同一** function 引用 `remove_*` |
| handler 泄漏 | C# 长期持有 delegate 但 Lua 环境已销毁 |

---


## 学习路径

| | |
|---|---|
| **上一篇** | [方法重载](./methods-and-overloads) |
| **下一篇** | [泛型与数组](./generics-and-arrays) |

## 相关文档

- [C# 调用 Lua](./csharp-to-lua) — `GetFunction` 基础
- [函数 Marshal 规范](../spec/marshal/09-FUNCTION)
- [zlua 库 · to_delegate](../spec/05-LIB)
- [Event](./events)
- [从 xLua 迁移](../community/migration/from-xlua) — `LuaFunction` / `Get<Delegate>` 对照
