---
sidebar_position: 2
title: 安装与集成
description: 通过 UPM 安装 ZLua，配置 Lua 版本并完成本地 Install。
---

# 安装与集成

本文以官方示例工程 [zlua-demo](https://github.com/focus-creative-games/zlua-demo) 为 canonical 参考，路径均指向其 `main` 分支。

## 概述

ZLua 以 Unity Package（UPM）形式分发。**安装 Package 后还须完成本地 Install**（包内不携带完整 `libil2cpp` / Lua 源码）。典型流程：

1. 在 `Packages/manifest.json` 引入 `com.code-philosophy.zlua`
2. 菜单 **`ZLua/Settings...`** 选择 Lua 版本（默认 **`lua-5.3.6`**）
3. 菜单 **`ZLua/Install...`** 完成本地安装
4. 配置 Lua 脚本目录与 `LoadLuaModule`，启动时调用 `LuaAppDomain.Initialize`
5. 发布 Il2Cpp 前执行 **`ZLua/Generate/All`**（C++ stub，非 C# Wrap）

:::info 运行时
**Mono（Editor）与 Il2Cpp（Player）均已完成**，Lua 可见语义一致。多版本细节见 [多版本管理](../spec/11-MULTI-VERSION)、[项目状态](./project-status)。
:::

## 前置要求

| 项 | 要求 |
|----|------|
| Unity | **2022.3 LTS**（当前已在 2022.3.62f3 验证；亦支持 2021+ / 团结，见 [兼容性](./compatibility)） |
| Scripting Backend | Editor：**Mono**；Player：**Il2Cpp** |
| Lua | 由 **Settings** 指定（默认 **`lua-5.3.6`**）；Install 时下载 / 装入本地树 |
| 网络 | 首次 Install 下载 PUC-Rio 源码时需要（LuaJIT 需自行 clone，见多版本规范） |
| Git | UPM 从 Git URL 安装时需要 |

---

## 方式一：克隆 Demo 工程（推荐首次体验）

```bash
git clone https://github.com/focus-creative-games/zlua-demo.git
```

用 Unity 2022.3 打开工程后，仍须执行下文 **Settings → Install**（若 Demo 尚未提交本地安装产物）。然后 Play `SampleScene`。核心文件：

| 文件 | 说明 |
|------|------|
| [Packages/manifest.json](https://github.com/focus-creative-games/zlua-demo/blob/main/Packages/manifest.json) | UPM 依赖，含 ZLua Git URL |
| [Assets/Bootstrap.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs) | 初始化与 `GetFunction` |
| [Assets/Demo.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Demo.cs) | 供 Lua 调用的 C# 类型 |
| [LuaScripts/app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua) | 主 Lua 模块 |

---

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

### 2. 配置 Lua 版本（`ZLua/Settings...`）

菜单 **`ZLua/Settings...`** 打开 Project Settings → **ZLua**（资源写在 `ProjectSettings/ZLua.asset`）。

| 字段 | 说明 |
|------|------|
| **Enable** | 是否启用 ZLua |
| **Lua Version Id** | 要使用的 Lua / LuaJIT 版本 id；**默认 `lua-5.3.6`**（空则按此默认） |
| **MarshalAs Xml Paths** | 可选；MarshalAs XML 路径，见 [LuaMarshalAs](../spec/marshal/02-MARSHAL-AS) |

**`luaVersionId` 写法**（与 [多版本管理](../spec/11-MULTI-VERSION) 一致）：

| 种类 | 格式 | 示例 |
|------|------|------|
| PUC-Rio | `lua-X.Y.Z` | `lua-5.3.6`、`lua-5.4.8`、`lua-5.5.0` |
| LuaJIT | `luajit-M.N` | `luajit-2.1`（源码须自行 clone 到缓存目录） |

改版本后须重新执行 **Install**；若 Editor 原生 DLL / scripting define 随系列变化，按 Console 提示 **重启 Editor**。

### 3. 本地安装（`ZLua/Install...`）

菜单 **`ZLua/Install...`** 执行 `LocalInstaller`，在工程本地生成可编译的 Il2Cpp + Lua + ZLua 树。**主要工作：**

1. **复制 Editor 安装目录下的 `libil2cpp`（及配套 Il2Cpp 数据）到工程本地**，并打上包内 `libil2cpp` patch  
2. **下载（或复用缓存）选定版本的 Lua 源码**，安装到本地 **`libil2cpp/lua`**  
3. **将包内 `ZLua~/zlua-runtime` 复制到本地 `libil2cpp/zlua`**  
4. 写入 scripting define、`ZLuaConf.inc` 等，并做完整性校验  

PUC-Rio 源码缓存目录一般为 `Library/ZLua/LuaSrcCache/`（如 `lua-5.3.6/`）。细则与路径命名见 [多版本管理](../spec/11-MULTI-VERSION)。

:::warning 必须先 Install
未 Install 时构建会失败（提示运行 `ZLua/Install...`）。**`ZLua/Generate/All` 也依赖本地树已存在。**
:::

### 4. 目录结构（Lua 脚本）

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
├── ProjectSettings/
│   └── ZLua.asset                # Settings（含 luaVersionId）
└── StreamingAssets/              # 构建时自动生成
    └── LuaScripts/
        └── app.lua.txt           # Player 读取
```

**为何两种脚本路径？**

- **Editor**：Demo 直接从项目根目录 `LuaScripts/*.lua` 加载，便于编辑调试（见 [Bootstrap.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs)）。
- **Player**：从 `StreamingAssets/LuaScripts/*.lua.txt` 加载；`.txt` 后缀避免 Unity 误当作 TextAsset 导入规则冲突。

### 5. 同步 Lua 到 StreamingAssets（Player 必需）

复制 Demo 中的 [SyncLuaScriptsToStreamingAssets.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Editor/SyncLuaScriptsToStreamingAssets.cs) 到 `Assets/Editor/`。

- 构建 Player 前自动执行 `IPreprocessBuildWithReport`
- 菜单 **Tools → Sync LuaScripts To StreamingAssets** 可手动同步

### 6. Bootstrap 初始化

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

### 7. 验证安装

1. 确认已执行 **Settings**（版本正确）与 **Install**（Console 有 Install succeeded）
2. 创建 [Demo.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Demo.cs) 与 [app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua)
3. 在 Bootstrap 中用 `GetFunction` 调用 `app.main` 并 Play（`GetFunction` 须在 `Initialize` 之后，例如 `Awake`）
4. Console 应输出 `lua main start` 及后续测试日志

---

## Assembly Definition 说明

- ZLua Package 自带 asmdef（`ZLua.Common`、`ZLua.Mono`、`ZLua.Il2Cpp` 等），**无需**手动引用 native 插件。
- 你的游戏脚本程序集（如 `Assembly-CSharp`）引用 `ZLua` 即可使用 `LuaAppDomain`、`GetFunction` 等 API。
- Lua 中通过 `CSharp['Assembly-CSharp']`（或别名 `CSharp.AC`）访问该程序集下的类型。

## 常见安装问题

| 现象 | 原因 | 处理 |
|------|------|------|
| Package 拉取失败 | 网络 / Git 未安装 | 检查 Git URL；可改用本地 path：`"file:../../zlua"` |
| 构建提示未 Install | 未跑 `ZLua/Install...` 或本地树过期 | 执行 Install；换 Unity / 换 Lua 版本后重跑 |
| Install 下载 Lua 失败 | 网络或版本 id 无效 | 检查 `luaVersionId`；见 [多版本管理](../spec/11-MULTI-VERSION) 缓存约定 |
| Play 后无 Lua 输出 | 未调用 `Initialize` 或模块路径错误 | 确认 `BeforeSceneLoad` 已执行；检查 `LoadLuaModule` 返回非 null |
| Player 找不到脚本 | 未同步 StreamingAssets | 运行 Sync 菜单或重新 Build |
| `Assembly-CSharp` 找不到类型 | 脚本未编译或命名空间错误 | 确认 Demo 类为全局命名空间或修正 Lua 路径 |
| 换 Lua 系列后异常 | Editor DLL / define 未生效 | 按 Install 日志 **重启 Editor** |

## Mono / Il2Cpp 支持

| 步骤 | Mono (Editor) | Il2Cpp (Player) |
|------|:-------------:|:---------------:|
| UPM 安装 | ✅ | ✅ |
| Settings + Install | ✅ | ✅（本地树供 Player 构建） |
| `LuaAppDomain.Initialize` | ✅ | ✅ |
| `GetFunction<T>` | ✅ | ✅ |
| 完整 Lua↔C# API | ✅ | ✅（语义一致；实现路径不同） |

## 下一步

- [5 分钟快速开始](./quick-start)
- [Lua 模块加载](../guides/lua-module-loading)
- [多版本管理](../spec/11-MULTI-VERSION)
- [支持的版本与平台](./compatibility)
