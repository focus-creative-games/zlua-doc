---
sidebar_position: 14
title: "Settings"
---

# 14 — Settings

> Project Settings → **ZLua** 的字段契约。资源文件：`ProjectSettings/ZLua.asset`。
> 菜单 **`ZLua/Settings...`** 打开同一页。用法见 [Settings（指南）](/docs/guides/settings/)。

---

## 1. 存储

| 项 | 规则 |
|----|------|
| 类型 | `ZLua.Settings`（`ScriptableSingleton`） |
| 路径 | `ProjectSettings/ZLua.asset` |
| 缺省字段 | 资源里尚未序列化的字段按 C# 字段初值（`bool` 为 `false`，引用为 `null`） |
| 生效 | Editor 改完即写入。依赖 XML 的 Il2Cpp 绑定在 **`ZLua/Generate/All`** 时烘焙；改 XML 路径或 Unity 优化开关后须重新 Generate |

---

## 2. 字段

| 字段 | 类型 | 默认 | 含义 |
|------|------|------|------|
| `enable` | `bool` | `true` | 是否启用 ZLua。当前构建目标是否启用见 `Settings.EnableForCurrentBuildTarget` |
| `luaVersionId` | `string` | `lua-5.5.0` | PUC-Rio：`lua-X.Y.Z`；LuaJIT：`luajit-M.N`；Luau（[`luau` 分支](https://github.com/focus-creative-games/zlua/tree/luau)）：`luau-M.N`（如 `luau-0.743`）。空字符串按 **`lua-5.5.0`**。细则 [11-MULTI-VERSION.md](/docs/spec/11-MULTI-VERSION/) |
| `marshalAsXmlPaths` | `string[]` | 空 | MarshalAs XML 文件或目录（相对工程根或绝对路径）。根元素 `ZLuaMarshalAs`。见 [marshal/02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/) |
| `luaAliasXmlPaths` | `string[]` | 空 | LuaAlias XML 文件或目录。根元素 `ZLuaAlias`。见 [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §5.4 |
| `luaExtensionXmlPaths` | `string[]` | 空 | LuaExtension XML 文件或目录。根元素 `ZLuaExtensions`。见 [13-EXTENSION-METHODS.md](/docs/spec/13-EXTENSION-METHODS/) |
| `enableUnityOptimizations` | `bool` | `true` | Unity 优化总开关。关闭时 **不** 加载包内 Unity 优化 XML。当前包含项见 [15-UNITY-OPTIMIZATIONS.md](/docs/spec/15-UNITY-OPTIMIZATIONS/)。以后新增的 Unity 优化挂在 **同一开关** 下，不另设逐 API 开关 |
| `enableDebugger` | `bool` | `false` | **仅 Editor Mono**：`Initialize` 之后注入 EmmyLua `emmy_core`。见 [build/04-EMMYLUA-DEBUGGER.md](/docs/spec/build/04-EMMYLUA-DEBUGGER/) |
| `debuggerPort` | `int` | `9966` | EmmyLua `tcpListen` 端口 |
| `debuggerWaitIDE` | `bool` | `false` | `true` 时 `dbg.waitIDE()` 阻塞 Unity 主线程直到 IDE Attach |

XML 三类路径 **只** 用于非热更新程序集。热更新程序集用对应 Attribute，不写进这些 XML。

---

## 3. 加载顺序

Editor Mono 与 Il2Cpp Generate 读取上述路径列表。`enableUnityOptimizations == true` 时，在用户列表 **之前** 插入包内文件（见 §15）。同一 `(assembly, type, method, signature)` 在 Alias 或 MarshalAs 中出现两次 → **加载失败**。
