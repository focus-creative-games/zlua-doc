---
sidebar_position: 5
title: 回调与 Delegate
description: Lua function 与 C# delegate 双向编组；LuaInvoke 返回 delegate。
---

# 回调与 Delegate

ZLua 在 **Lua function ↔ C# Delegate** 上提供统一编组，覆盖三条常用路径：

| 路径 | 写法 | 说明 |
|------|------|------|
| **Lua → C# 形参** | `obj:Foo(function(...) end)` | 方法 marshal 隐式 `ReadDelegate` |
| **C# delegate → Lua** | `handler(42)` / `handler:Invoke(42)` | DelegateUserData + `__call` |
| **`[LuaInvoke]` 返回值** | `static extern Action<T> GetFn()` | **把 Lua 函数交回 C# 持有并调用**（易遗漏） |

权威细则：[函数编组规范](../spec/marshal/09-FUNCTION)、[`zlua.to_delegate`](../spec/05-LIB)。

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

## 3. `[LuaInvoke]` 返回 delegate（把 Lua 函数交给 C#）

许多迁移者只知道「C# 用 `[LuaInvoke]` **调用** 一个固定 Lua 函数」，以为 ZLua **不能**像 `LuaFunction` / `Get<Action>` 那样把 **Lua 函数拿回 C# 再调**。其实可以：让 `[LuaInvoke]` 的 **返回值** 为某种 `Delegate`（或 `Func` / `Action`）。

### 3.1 固定签名：返回具体 delegate 类型

C# 声明返回具体委托类型；Lua 侧直接 `return` 一个 function，由返回值编组隐式转为该类型：

```csharp
// C# 拿到 Action<float> 后可任意次 Invoke
[LuaInvoke("game", "get_on_tick")]
private static extern System.Action<float> GetOnTick();

void Start()
{
    var onTick = GetOnTick();
    onTick(0.016f);   // 调用 Lua 闭包
}
```

```lua
-- game.lua
local function get_on_tick()
    return function(dt)
        print("tick", dt)
    end
end

return { get_on_tick = get_on_tick }
```

适用：已知回调签名、每个 Lua 入口对应一种 C# 委托类型。

### 3.2 动态解析：参数指示 module / method

`[LuaInvoke]` 本身绑定的是 **一个** Lua 入口（属性上的 module/method）。若该入口的 **参数** 再传入「目标模块名 / 函数名」，即可在 Lua 里查表并返回 **任意** 已导出的 Lua 函数：

```csharp
[LuaInvoke("bridge", "get_action_float")]
private static extern System.Action<float> GetActionFloat(string module, string method);

// 动态拿到 game.OnTick
var tick = GetActionFloat("game", "OnTick");
tick(0.016f);
```

```lua
-- bridge.lua
local function get_action_float(module, method)
    local mod = assert(package.loaded[module] or load_module(module))
    -- 若模块是 return table：mod[method]；按你的加载约定调整
    local fn = mod[method]
    assert(type(fn) == "function", "missing " .. module .. "." .. method)
    return fn   -- 返回值类型为 Action<float> → 隐式 marshal
end

return { get_action_float = get_action_float }
```

这样 C# **不必**为每个 Lua 回调再写一条 `[LuaInvoke("game","OnTick")]`，只要约定「通过 bridge 按名取函数」即可。

:::tip
`load_module` / `package.loaded` 取决于你的 `LoadLuaModule` 与模块 `return` 约定；也可用你们工程里已有的模块表（例如全局 `Modules[name]`）。关键是：**Lua 入口根据参数解析出 function，再作为 `[LuaInvoke]` 的返回值。**
:::

### 3.3 技巧：一条 `[LuaInvoke]` 返回「任意」delegate 类型

约束：每个 `[LuaInvoke]` 声明在 C# 侧只有 **一种** 返回类型。若写成 `Action<float>`，就只能编组为该签名。

若希望 **同一个** 桥接入口按运行时 `Type` 返回不同委托类型，可用：

1. **返回值** 设为 `System.Delegate` / `System.MulticastDelegate` / `object`
2. **参数** 指示要取哪个 Lua 函数（如 `module`、`method`）
3. 再传一个 **`System.Type`**（任意具体 delegate 类型，如 `typeof(Action<int>)`）
4. 在 Lua 里取出 function 后调用 **`zlua.to_delegate(fn, delegateType)`**，再返回

```csharp
using System;

public static class LuaCallbacks
{
    /// <summary>
    /// 按名取得任意签名的 Lua 回调，绑定为指定 delegate 类型。
    /// </summary>
    [LuaInvoke("bridge", "resolve_delegate")]
    private static extern Delegate ResolveDelegate(
        string module,
        string method,
        Type delegateType);

    public static T Get<T>(string module, string method) where T : Delegate
    {
        return (T)ResolveDelegate(module, method, typeof(T));
    }
}

// 用法
Action<float> onTick = LuaCallbacks.Get<Action<float>>("game", "OnTick");
Func<int, int, int> add = LuaCallbacks.Get<Func<int, int, int>>("math", "Add");
onTick(0.016f);
Debug.Log(add(1, 2));
```

```lua
-- bridge.lua
local function resolve_delegate(module, method, delegateType)
    local mod = assert(load_or_get_module(module))
    local fn = assert(mod[method], "missing " .. tostring(method))
    assert(type(fn) == "function")
    -- delegateType 为 C# 传入的 Type（类型表 / Type userdata）
    return zlua.to_delegate(fn, delegateType)
end

return { resolve_delegate = resolve_delegate }
```

| 步骤 | 作用 |
|------|------|
| 返回 `Delegate` / `object` | 单条 `[LuaInvoke]` 不锁死具体 `Action<>` / `Func<>` |
| `module` + `method` | 动态选择哪个 Lua 函数 |
| `Type delegateType` | 告诉绑定层要生成哪种 Invoke 签名 |
| `zlua.to_delegate(fn, type)` | 显式构造 closed delegate（与隐式 marshal 同一套 binder） |

`zlua.to_delegate` 见 [zlua 库规范 §10.2](../spec/05-LIB)。

:::info 与「隐式返回 function」的关系
返回类型为 **具体** `Action`/`Func` 时，Lua `return function...` 即可，**不必** `to_delegate`。  
返回类型为 **`Delegate` / `object`** 时，编组不知道目标签名，须用 `to_delegate`（或先在 Lua 里构造好对应类型的 delegate userdata）再返回。
:::

### 3.4 与直接 `[LuaInvoke]` 调用的对比

| 需求 | 推荐 |
|------|------|
| C# 调一次固定 Lua 函数 | `[LuaInvoke("mod","fn")] static extern void Fn(...)` |
| C# 长期持有回调、多次 Invoke | `[LuaInvoke]` **返回** `Action`/`Func`，或 §3.3 动态解析 |
| 从 xLua `Get<Action>` / `LuaFunction` 迁移 | §3.1–§3.3；见 [从 xLua 迁移](../community/migration/from-xlua) |

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
| `[LuaInvoke]` 返回具体 `Action`/`Func` | ✅ | ✅ |
| `[LuaInvoke]` 返回 `Delegate` + `to_delegate` | ✅ | ✅ |
| delegate userdata + `__call` | ✅ | ✅ |
| 泛型 delegate | ✅ | ✅ |

---

## 常见错误

| 现象 | 原因 |
|------|------|
| `expects delegate X` | 传入非 function 且非 delegate |
| 回调未执行 | C# 未 Invoke；或返回的 delegate 为 null |
| 以为「不能把 Lua 函数给 C#」 | 未使用 **返回值为 delegate** 的 `[LuaInvoke]`（见 §3） |
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

- [C# 调用 Lua](./csharp-to-lua) — `[LuaInvoke]` 基础
- [函数编组规范](../spec/marshal/09-FUNCTION)
- [zlua 库 · to_delegate](../spec/05-LIB)
- [Event](./events)
- [从 xLua 迁移](../community/migration/from-xlua) — `LuaFunction` / `Get<Delegate>` 对照
