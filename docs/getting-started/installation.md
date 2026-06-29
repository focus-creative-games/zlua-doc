---
sidebar_position: 2
title: 安装与集成
description: 通过 UPM 安装 ZLua 并接入 Unity 工程。
---

# 安装与集成

本文以官方示例工程 [zlua-demo](https://github.com/focus-creative-games/zlua-demo) 为 canonical 参考，路径均指向其 `main` 分支。

## 概述

ZLua 以 Unity Package（UPM）形式分发。安装后只需：

1. 在 `Packages/manifest.json` 引入 `com.code-philosophy.zlua`
2. 配置 Lua 脚本目录与 `LoadLuaModule`
3. 启动时调用 `LuaAppDomain.Initialize`

:::warning 运行时差异
**Mono（Editor）** 已支持 v1.0 全量功能；**Il2Cpp（Player）** 仍为 MVP。Player 构建前请阅读 [项目状态](./project-status)。
:::

## 前置要求

| 项 | 要求 |
|----|------|
| Unity | **2022.3 LTS**（当前已在 2022.3.62f3 验证；2021+ 为 v2.0 计划） |
| Scripting Backend | Editor：**Mono**；Player：**Il2Cpp** |
| Lua | **5.4**（Package 内置） |
| Git | UPM 从 Git URL 安装时需要 |

## 方式一：克隆 Demo 工程（推荐首次体验）

```bash
git clone https://github.com/focus-creative-games/zlua-demo.git
```

用 Unity 2022.3 打开工程，Play `SampleScene` 即可。核心文件：

| 文件 | 说明 |
|------|------|
| [Packages/manifest.json](https://github.com/focus-creative-games/zlua-demo/blob/main/Packages/manifest.json) | UPM 依赖，含 ZLua Git URL |
| [Assets/Bootstrap.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs) | 初始化与 `[LuaInvoke]` |
| [Assets/Demo.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Demo.cs) | 供 Lua 调用的 C# 类型 |
| [LuaScripts/app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua) | 主 Lua 模块 |

## 方式二：在现有工程中安装 ZLua

### 1. 添加 UPM 依赖

编辑 `Packages/manifest.json`，在 `dependencies` 中加入：

```json
{
  "dependencies": {
    "com.code-philosophy.zlua": "https://github.com/focus-creative-games/zlua.git"
  }
}
```

也可指定分支 / 标签，例如：

```json
"com.code-philosophy.zlua": "https://github.com/focus-creative-games/zlua.git#v0.0.1-alpha.2"
```

保存后 Unity Package Manager 会自动拉取。Package 名称为 `com.code-philosophy.zlua`（见 [zlua/package.json](https://github.com/focus-creative-games/zlua/blob/main/package.json)）。

### 2. 目录结构

推荐布局（与 Demo 一致）：

```
YourProject/
├── Assets/
│   ├── Bootstrap.cs              # 初始化入口
│   └── Editor/
│       └── SyncLuaScriptsToStreamingAssets.cs   # Player 构建前同步脚本
├── LuaScripts/                   # Editor 下 Lua 源文件（*.lua）
│   └── app.lua
├── Packages/
│   └── manifest.json
└── StreamingAssets/              # 构建时自动生成
    └── LuaScripts/
        └── app.lua.txt           # Player 读取
```

**为何两种路径？**

- **Editor**：Demo 直接从项目根目录 `LuaScripts/*.lua` 加载，便于编辑调试（见 [Bootstrap.cs#L11-L16](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs)）。
- **Player**：从 `StreamingAssets/LuaScripts/*.lua.txt` 加载；`.txt` 后缀避免 Unity 误当作 TextAsset 导入规则冲突。

### 3. 同步 Lua 到 StreamingAssets（Player 必需）

复制 Demo 中的 [SyncLuaScriptsToStreamingAssets.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Editor/SyncLuaScriptsToStreamingAssets.cs) 到 `Assets/Editor/`。

- 构建 Player 前自动执行 `IPreprocessBuildWithReport`
- 菜单 **Tools → Sync LuaScripts To StreamingAssets** 可手动同步

### 4. Bootstrap 初始化

最小入口（摘自 [Bootstrap.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs)）：

```csharp
using System.IO;
using System.Text;
using UnityEngine;
using ZLua;

public class Bootstrap : MonoBehaviour
{
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

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    private static void InitZLuaOnStartup()
    {
        LuaAppDomain.Initialize(LoadLuaModule);
    }
}
```

`LoadLuaModule` 签名：`Func<string, object>`，参数为**模块名**（不含路径与扩展名），返回 Lua 源码字符串；找不到模块返回 `null`。

### 5. 验证安装

1. 创建 [Demo.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Demo.cs) 与 [app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua)
2. 在 Bootstrap 上添加 `[LuaInvoke("app", "main")]` 并 Play
3. Console 应输出 `lua main start` 及后续测试日志

## Assembly Definition 说明

- ZLua Package 自带 asmdef（`ZLua.Common`、`ZLua.Mono`、`ZLua.Il2Cpp` 等），**无需**手动引用 native 插件。
- 你的游戏脚本程序集（如 `Assembly-CSharp`）引用 `ZLua` 即可使用 `LuaAppDomain`、`[LuaInvoke]` 等 API。
- Lua 中通过 `CSharp['Assembly-CSharp']`（或别名 `CSharp.AC`）访问该程序集下的类型。

## 常见安装问题

| 现象 | 原因 | 处理 |
|------|------|------|
| Package 拉取失败 | 网络 / Git 未安装 | 检查 Git URL；可改用本地 path：`"file:../../zlua"` |
| Play 后无 Lua 输出 | 未调用 `Initialize` 或模块路径错误 | 确认 `BeforeSceneLoad` 已执行；检查 `LoadLuaModule` 返回非 null |
| Player 找不到脚本 | 未同步 StreamingAssets | 运行 Sync 菜单或重新 Build |
| `Assembly-CSharp` 找不到类型 | 脚本未编译或命名空间错误 | 确认 Demo 类为全局命名空间或修正 Lua 路径 |

## Mono / Il2Cpp 支持

| 步骤 | Mono (Editor) | Il2Cpp (Player) |
|------|:-------------:|:---------------:|
| UPM 安装 | ✅ | ✅ |
| `LuaAppDomain.Initialize` | ✅ | ✅ |
| `[LuaInvoke]` | ✅ | ✅（MVP 签名） |
| 完整 Lua↔C# API | ✅ | ⚠️ MVP 子集 |

## 下一步

- [5 分钟快速开始](./quick-start)
- [Lua 模块加载](../guides/lua-module-loading)
- [支持的版本与平台](./compatibility)
