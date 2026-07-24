---
sidebar_position: 1
title: C# 调用 Lua
description: 使用 LuaAppDomain.GetFunction 取得 Lua 函数对应的 Delegate。
---

# C# 调用 Lua

ZLua 用 **`LuaAppDomain.GetFunction<T>`** 从 C# 调用 Lua：按模块名与方法名取得绑定好的 Delegate，再 `Invoke`（或直接当函数调用）。

Canonical 示例：[zlua-demo/Assets/Bootstrap.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs)

## 概述

- **module** — Lua 模块名，传给 `LoadLuaModule` / `GetFunction` 的第一参数
- **method** — 模块 `return { ... }` 表中的键名
- Editor 与 Player **API 相同**；底层经 **Delegate 桥** 调 Lua（与回调路径统一）

## 基本用法

### 无返回值

```csharp
var main = LuaAppDomain.GetFunction<Action>("app", "main");
main();
```

### 带参数与返回值

```csharp
var add = LuaAppDomain.GetFunction<Func<int, int, int>>("app", "add");

void Start()
{
    int sum = add(10, 20);  // Lua: return a + b
}
```

Lua 侧（[app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua)）：

```lua
local function add(a, b)
    return a + b
end

return {
    main = main,
    add = add,
}
```

## 缓存（推荐）

`GetFunction` **不**保证返回同一实例；热路径请自行保存。须在 `Initialize` **之后**再取（勿放在与 `RuntimeInitializeOnLoadMethod` 同类型的 static 字段初始化器里）：

```csharp
Action AppMain;
Func<int, int, int> AppAdd;

void Awake()
{
    AppMain = LuaAppDomain.GetFunction<Action>("app", "main");
    AppAdd = LuaAppDomain.GetFunction<Func<int, int, int>>("app", "add");
}
```

## 规则摘要

| 规则 | 说明 |
|------|------|
| 先 `Initialize` | 否则抛异常 |
| `T : MulticastDelegate` | 使用具体 `Action` / `Func` / 自定义委托类型 |
| module / method 与 Lua 一致 | `"app","add"` ↔ `return { add = ... }` |
| 参数 / 返回值 | 对 delegate `Invoke` 时遵循 [Marshal 规则](../reference/marshal-cheatsheet)；可用 `[LuaMarshalAs]` |

权威规范：[宿主 API](../spec/01-HOST-API) §2、[LuaAppDomain](../reference/csharp/lua-app-domain)。

## Editor 与 Player

| | Mono (Editor) | Il2Cpp (Player) |
|--|---------------|-----------------|
| API | `GetFunction<T>` | 同左 |
| 调用路径 | Delegate 桥 + Lua API | Delegate 桥 + native / C++ |
| 开发者感知 | **相同** | **相同** |

## 模块加载约定

`GetFunction("app", "main")` 要求 `LoadLuaModule("app")` 能读到模块源码。Demo 约定：

- Editor：`{ProjectRoot}/LuaScripts/app.lua`
- Player：`StreamingAssets/LuaScripts/app.lua.txt`

详见 [Lua 模块加载](./lua-module-loading)。

## 多模块

```csharp
var appMain = LuaAppDomain.GetFunction<Action>("app", "main");
var battleTick = LuaAppDomain.GetFunction<Action<float>>("battle", "tick");
```

每个 module 对应独立 Lua 文件（或同一 loader 内的不同逻辑分支）。

## 与「Lua→C# 形参里的 function」

| 场景 | 做法 |
|------|------|
| C# 主动调某个 Lua 导出函数 | `GetFunction<T>(module, method)` |
| C# 方法形参是 `Action`/`Func`，Lua 传入 `function` | **隐式** marshal（见 [回调与 Delegate](./callbacks-and-delegates)） |
| 需要显式指定委托类型 | `zlua.to_delegate` |

## 平台状态

| 能力 | Mono | Il2Cpp |
|------|:----:|:------:|
| `GetFunction` + 调用 | ✅ | ✅ |
| 返回 / 绑定常见 `Action`/`Func` | ✅ | ✅ |

## 下一步

- [回调与 Delegate](./callbacks-and-delegates)
- [LuaAppDomain API](../reference/csharp/lua-app-domain)
- [宿主 API 规范](../spec/01-HOST-API)
