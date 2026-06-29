---
sidebar_position: 8
title: Lua 模块加载
description: LuaLoader、Editor/Player 路径与模块 return 约定。
---

# Lua 模块加载

ZLua 通过 **`LuaAppDomain.Initialize(Func<string, object> moduleLoader)`** 注入模块加载器。所有 `[LuaInvoke("module", ...)]` 与 Lua `require` 风格逻辑均依赖 loader 返回的源码字符串。

Canonical 实现：[Bootstrap.cs LoadLuaModule](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs)、[SyncLuaScriptsToStreamingAssets.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Editor/SyncLuaScriptsToStreamingAssets.cs)

## 概述

- **module** 参数：逻辑模块名，**不含**路径与扩展名
- 返回值：UTF-8 Lua 源码；模块不存在返回 **`nil`/`null`**
- 每个模块文件应 **`return` 一个 table**，导出函数供 C# / 其他 Lua 使用

## LoadLuaModule 签名

```csharp
private static string LoadLuaModule(string module)
{
#if UNITY_EDITOR
    string path = Path.Combine(Application.dataPath, "..", "LuaScripts", module + ".lua");
#else
    string path = Path.Combine(
        Application.streamingAssetsPath, "LuaScripts", module + ".lua.txt");
#endif
    return File.Exists(path) ? File.ReadAllText(path, Encoding.UTF8) : null;
}
```

### 设计要点

| 环境 | 路径 | 原因 |
|------|------|------|
| Editor | 项目根 `LuaScripts/{module}.lua` | 直接编辑，无需每次 Sync |
| Player | `StreamingAssets/LuaScripts/{module}.lua.txt` | 随包发布；`.txt` 避免导入冲突 |

可按项目自定义（例如全用 StreamingAssets），但须保证 **Editor 与 Player 行为一致**。

## 模块 return 约定

`[LuaInvoke("app", "main")]` 要求模块 `app` 执行后，全局/package Loader 能取到 `return` 表中的 `main` 键：

```lua
-- LuaScripts/app.lua
local function main()
    print("lua main start")
end

local function add(a, b)
    return a + b
end

return {
    main = main,
    add = add,
}
```

键名必须与 `[LuaInvoke]` 的 **method** 参数一致。

## 多模块组织

```
LuaScripts/
├── app.lua          -- module: app
├── battle/
│   └── logic.lua    -- 若 loader 支持子路径：module "battle.logic"
└── shared/
    └── util.lua
```

Demo 使用 **扁平** 单文件 `app.lua`。子模块需 loader 支持路径映射，例如：

```csharp
string path = Path.Combine(root, module.Replace('.', '/') + ".lua");
```

## Editor → Player 同步

Player 构建前将 `LuaScripts/*.lua` 复制为 `StreamingAssets/LuaScripts/*.lua.txt`：

1. 复制 Demo 的 [SyncLuaScriptsToStreamingAssets.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Editor/SyncLuaScriptsToStreamingAssets.cs)
2. 构建时自动执行，或菜单 **Tools → Sync LuaScripts To StreamingAssets**
3. 删除目标目录中已不存在的旧 `.lua.txt`

:::tip CI
在 CI Build Player 前确保 Sync 已运行（Preprocessor 会在 `OnPreprocessBuild` 触发）。
:::

## 与 `[LuaInvoke]` 的关系

```
C# [LuaInvoke("app","main")]
        ↓
LoadLuaModule("app") → 读取 app.lua 源码
        ↓
执行并得到 return { main = fn, ... }
        ↓
调用 return.main()
```

模块在首次需要时加载并缓存；具体缓存策略对 Lua 脚本透明。

## 热更新注意

- Player 从 StreamingAssets 读 **打包时** 快照；运行时改 StreamingAssets 需平台支持（Android 等只读包需自定义解压路径）
- 热更方案通常在 loader 内改为从 AssetBundle / 网络拉取源码，再交给 ZLua 执行——`Initialize` 的 loader 委托是唯一扩展点

## Mono / Il2Cpp 支持

| 能力 | Mono | Il2Cpp |
|------|:----:|:------:|
| 自定义 loader | ✅ | ✅ |
| Editor 源文件路径 | ✅ | N/A |
| StreamingAssets | ✅ | ✅ |
| 多模块 | ✅ | ✅ |

## 常见错误

| 现象 | 排查 |
|------|------|
| module not found | 文件名与 module 名；Player 是否 `.lua.txt` |
| 函数 nil | 未 `return { fn = ... }` |
| Player 仍是旧脚本 | 重新 Sync + Build |
| UTF-8 乱码 | `ReadAllText(..., Encoding.UTF8)` |

## 学习路径

| | |
|---|---|
| **上一篇** | [ref / out / in](./marshal-ref-out-in) |
| **下一篇** | [Event](./events) |

## 相关文档

- [安装与集成](../getting-started/installation)
- [C# 调用 Lua](./csharp-to-lua)
- [快速开始](../getting-started/quick-start)
