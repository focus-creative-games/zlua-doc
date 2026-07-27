---
sidebar_position: 1
title: 安装与 Lua 版本
description: UPM 引入 ZLua，用 Settings 选定 Lua 版本并完成本地 Install。
---

# 安装与 Lua 版本

使用指南从本页开始：先装好包、选好 Lua 版本，再进入 [初始化与最小互调](/docs/guides/hello-interop/)。UPM 细节与 Demo 路径对照见 [入门 · 安装与集成](/docs/getting-started/installation/)。

## 你要完成的三件事

1. 在工程中引入 `com.code-philosophy.zlua`
2. 菜单 **`ZLua/Settings...`** 选定 **Lua Version Id**（默认 **`lua-5.5.0`**）
3. 菜单 **`ZLua/Install...`** 生成本地 `libil2cpp` + Lua + `zlua` 树

:::warning
包内 **不** 携带完整 `libil2cpp` / Lua 源码。未 Install 时构建会失败；**`ZLua/Generate/All` 也依赖本地树已存在。**
:::

## 1. 引入 Package

编辑 `Packages/manifest.json`：

```json
{
  "dependencies": {
    "com.code-philosophy.zlua": "https://github.com/focus-creative-games/zlua.git"
  }
}
```

也可钉版本标签，例如 `#v0.0.1-alpha.2`。首次体验推荐直接 clone [zlua-demo](https://github.com/focus-creative-games/zlua-demo)。

## 2. 选定 Lua 版本（`ZLua/Settings...`）

打开 Project Settings → **ZLua**（写入 `ProjectSettings/ZLua.asset`）。

| 字段 | 说明 |
|------|------|
| **Enable** | 是否启用 ZLua |
| **Lua Version Id** | Lua / LuaJIT 版本 id；空则默认 **`lua-5.5.0`** |
| **MarshalAs Xml Paths** | 可选；预编译程序集的 MarshalAs XML，见 [LuaMarshalAs](/docs/guides/lua-marshal-as/) |

**`luaVersionId` 写法：**

| 种类 | 格式 | 示例 |
|------|------|------|
| PUC-Rio | `lua-X.Y.Z` | `lua-5.1.5`、`lua-5.2.4`、`lua-5.3.6`、`lua-5.4.8`、`lua-5.5.0` |
| LuaJIT | `luajit-M.N` | `luajit-2.1`（源码须自行 clone；**Il2Cpp 仅 Android / iOS**） |

改版本后须重新 **Install**；若 Editor DLL / scripting define 随系列变化，按 Console 提示 **重启 Editor**。平台与版本矩阵见 [兼容性](/docs/getting-started/compatibility/)；多版本细则见 [多版本管理](/docs/spec/11-MULTI-VERSION/)。

## 3. 本地 Install（`ZLua/Install...`）

Install 主要工作：

1. 复制 Editor 的 `libil2cpp` 到工程本地并打 patch  
2. 下载（或复用缓存）选定 Lua 源码到本地 **`libil2cpp/lua`**  
3. 将包内 `ZLua~/zlua-runtime` 复制到 **`libil2cpp/zlua`**  
4. 写入 scripting define、`ZLuaConf.inc` 等并校验  

PUC-Rio 缓存一般在 `Library/ZLua/LuaSrcCache/`（如 `lua-5.5.0/`）。

## 4. 脚本目录（先搭好，下一篇会用到）

推荐与 Demo 一致：

- **Editor：** 项目根 `LuaScripts/*.lua`
- **Player：** `StreamingAssets/LuaScripts/*.lua.txt`（构建前 Sync）

目录树、Sync 脚本、asmdef 说明见 [安装与集成](/docs/getting-started/installation/)。

## 验证

1. Settings 中版本正确，Install 日志成功  
2. 工程能编译；下一篇用 `Initialize` + 最小互调确认 Play 有输出  

## 常见问题

| 现象 | 处理 |
|------|------|
| Package 拉取失败 | 检查 Git / 网络；或改用本地 `file:` 路径 |
| 提示未 Install | 执行 `ZLua/Install...`；换 Unity / 换 Lua 版本后重跑 |
| 下载 Lua 失败 | 检查 `luaVersionId` 与网络；见 [多版本管理](/docs/spec/11-MULTI-VERSION/) |
| 换系列后异常 | 按日志 **重启 Editor** |






## 学习路径

| | |
|---|---|
| **上一篇** | [快速开始](/docs/getting-started/quick-start/) |
| **下一篇** | [初始化与最小互调](/docs/guides/hello-interop/) |

## 相关文档

- [入门 · 安装与集成](/docs/getting-started/installation/) — UPM、Bootstrap 模板、完整目录树  
- [兼容性](/docs/getting-started/compatibility/)  
- [LuaJIT 构建](/docs/spec/build/02-LUAJIT/)  
- [多版本管理](/docs/spec/11-MULTI-VERSION/)
