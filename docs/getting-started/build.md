---
title: 首次构建 Il2Cpp Player
description: Il2Cpp Player 的 Generate、Lua Sync 与发布检查清单。
---

# 首次构建 Il2Cpp Player

Editor（Mono）Play 不需要 per-type C# Wrap；发布 **Il2Cpp Player** 前必须完成 Generate 与 Lua 同步。语义以 [Editor 与 Player](/docs/guides/editor-vs-player/) 为准。

## 调整快速开始的 loader

完成 [快速开始](/docs/getting-started/quick-start/) 后，桌面 Player 可将 `LoadLuaModule` 内的路径构造替换为下面的代码，保留文件检查与 `ReadAllText`：

```csharp
string relativePath = module.Replace('.', '/') + ".lua";
#if UNITY_EDITOR
string path = Path.Combine(Application.dataPath, "..", "LuaScripts", relativePath);
#else
string path = Path.Combine(Application.streamingAssetsPath, "LuaScripts", relativePath + ".txt");
#endif
```

构建前将文件同步到 **`Assets/StreamingAssets/LuaScripts`**。此文件系统 loader 适用于桌面文件路径。Android / WebGL 应先通过平台资源加载接口取得文本或字节并缓存，再由同步 loader 返回；不能假定 `File.ReadAllText` 可以读取所有 StreamingAssets URL。

构建后启动 Player，验证与快速开始相同的 `C# Add: 8`、`C# field: 10`、`Lua add: 30` 输出。构建成功本身不能代替互调验证。

## 发布前清单

| 步骤 | 做什么 |
|------|--------|
| 1 | 已 [Install](/docs/getting-started/installation/)（本地 `libil2cpp` / Lua / zlua 树存在） |
| 2 | 菜单 **`ZLua/Generate/All`**（生成 C++ stub，**不是** C# Wrap） |
| 3 | 将 `LuaScripts` 同步到 `StreamingAssets/LuaScripts/*.lua.txt` |
| 4 | Build Settings → **Il2Cpp** → 目标平台 |
| 5 | 真机 / 包体冒烟：Initialize、互调、勿用废弃 Event API |

## Generate

- 菜单：**`ZLua/Generate/All`**
- 依赖：本地 Install 树已存在
- 作用：为 Il2Cpp 生成桥接 stub；改 public API / 换 Lua 系列后应重跑
- Editor 日常迭代 **不必** 每次 Generate

## Lua 同步到 StreamingAssets

Player 侧 loader 读的是 `StreamingAssets`，不是工程根 `LuaScripts`。

1. 复制 Demo 的 [SyncLuaScriptsToStreamingAssets.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Editor/SyncLuaScriptsToStreamingAssets.cs) 到 `Assets/Editor/`
2. 构建前由 `IPreprocessBuildWithReport` 自动执行；也可菜单 **Tools → Sync LuaScripts To StreamingAssets**
3. 约定：`app` → `StreamingAssets/LuaScripts/app.lua.txt`（`.txt` 避免导入冲突）

子模块路径可用点号：`battle.ai` → `LuaScripts/battle/ai.lua`（loader 内 `module.Replace('.', '/')`）。详解见 [C# 调用 Lua · 模块加载](/docs/guides/csharp-calling-lua/#模块加载)。

## Editor vs Player（只记差异）

| | Editor (Mono) | Player (Il2Cpp) |
|--|---------------|-----------------|
| Lua 可见语义 | 与 Player **一致** | 与 Editor **一致** |
| 实现 | Expression Emit 等 | C++ stub + native |
| Generate | 不强制 | **必须** |
| 脚本路径 | `LuaScripts/*.lua` | `StreamingAssets/.../*.lua.txt` |

性能对比请以 **Player** 为准。

## 常见失败

| 现象 | 处理 |
|------|------|
| 提示未 Install | 先 [Install](/docs/getting-started/installation/) |
| Player 无 Lua 输出 / module not found | 未 Sync 或路径/扩展名错误 |
| Editor 正常 Player 崩 | 未 Generate；或使用了已废弃 Event 糖语法 |
| 换 Unity / 换 Lua 版本后异常 | 重跑 Install → Generate |

## 相关文档

- [EmmyLua 调试器](/docs/guides/debugger/) — Editor 断点调试
- [Editor 与 Player](/docs/guides/editor-vs-player/)
- [项目状态](/docs/getting-started/project-status/)
- [排错指南](/docs/guides/troubleshooting/)
- [兼容性](/docs/getting-started/compatibility/)
