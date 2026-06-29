---
sidebar_position: 1
title: C# 调用 Lua
description: 使用 LuaInvoke 从 C# 调用 Lua 函数。
---

# C# 调用 Lua

ZLua 用 **`[LuaInvoke]`**（L/Invoke）从 C# 调用 Lua 函数，用法类比 P/Invoke：声明 `static extern`，编译期由 CodeGen 注入真实实现。

Canonical 示例：[zlua-demo/Assets/Bootstrap.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs)

## 概述

- **module** — Lua 模块名，传给 `LoadLuaModule`
- **method** — 模块 `return { ... }` 表中的键名
- Editor 与 Player **声明方式相同**；底层 Mono 走 `RunLuaFunc`，Il2Cpp 走 InternalCall + C++ 桥

## 基本用法

### 无返回值

```csharp
[LuaInvoke("app", "main")]
private static extern void AppMain();
```

### 带参数与返回值

```csharp
[LuaInvoke("app", "add")]
private static extern int AppAdd(int a, int b);

void Start()
{
    int sum = AppAdd(10, 20);  // Lua: return a + b
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

## 声明规则

| 规则 | 说明 |
|------|------|
| 必须是 `static extern` | 实例方法、普通 static 方法不可用于 LuaInvoke |
| 不能是泛型方法 | 也不能位于泛型类的实例成员上 |
| module / method 与 Lua 一致 | `[LuaInvoke("app","add")]` ↔ `return { add = ... }` |
| 参数 / 返回值类型 | 遵循默认 [Marshal 规则](../reference/marshal-cheatsheet)；可用 `[LuaMarshalAs]` 覆盖（Mono） |

构造函数注入在 **程序集编译后** 由 Editor CodeGen（dnlib）或 Player Weaver 完成，开发者只维护 `extern` 声明。

## Editor 与 Player 实现差异

| 阶段 | Mono (Editor) | Il2Cpp (Player) |
|------|---------------|-----------------|
| 编译后 | dnlib 注入 → `RunLuaFunc` | IL → `InternalCall` |
| 调用路径 | C# 快速桥 + Lua API | C++ 模板 + 直接 lua API |
| 开发者感知 | **无** | **无** |

Player MVP 对参数 / 返回值类型有限制（int、bool、string、void 等），超出可能需等 Il2Cpp 扩展。见 [兼容性](../getting-started/compatibility)。

## 模块加载约定

`[LuaInvoke("app", "main")]` 要求 `LoadLuaModule("app")` 能读到模块源码。Demo 约定：

- Editor：`{ProjectRoot}/LuaScripts/app.lua`
- Player：`StreamingAssets/LuaScripts/app.lua.txt`

详见 [Lua 模块加载](./lua-module-loading)。

## 多函数与命名空间

同一 C# 类可声明多个 `[LuaInvoke]`，指向同一或不同模块：

```csharp
[LuaInvoke("app", "main")]
private static extern void AppMain();

[LuaInvoke("battle", "tick")]
private static extern void BattleTick(float dt);
```

每个 module 对应独立 Lua 文件（或同一 loader 内的不同逻辑分支）。

## 错误排查

| 现象 | 可能原因 |
|------|----------|
| 进入 Play 无反应 | 未调用 `LuaAppDomain.Initialize` |
| `attempt to call a nil value` | Lua 表未导出对应函数名 |
| 返回值始终 0 | Lua 未 `return`；或 marshal 类型不匹配 |
| Player 正常 Editor 异常 | 检查 Editor 下 `LuaScripts/*.lua` 路径 |
| Player 异常 Editor 正常 | 未 Sync StreamingAssets；或使用了 MVP 不支持的签名 |

## Mono / Il2Cpp 支持

| 能力 | Mono | Il2Cpp |
|------|:----:|:------:|
| `[LuaInvoke]` void | ✅ | ✅ |
| 多 int 参数 / int 返回 | ✅ | ✅ |
| string / bool | ✅ | ✅ |
| 复杂类型 / `[LuaMarshalAs]` | ✅ | ❌ |
| 多模块 | ✅ | ✅ |

## 相关文档

- [快速开始](../getting-started/quick-start)
- [LuaInvoke API](../reference/csharp/lua-invoke)
- [设计规范](../spec/design-spec) — LuaInvokeAttribute 实现细节
