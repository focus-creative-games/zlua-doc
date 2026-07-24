---
sidebar_position: 11
title: 排错指南
description: ZLua 常见问题诊断与解决方案。
---

# 排错指南

开发期可在 **Editor（Mono）** 快速迭代；Player 问题先确认 **`ZLua/Generate/All`** 与 [兼容性](../getting-started/compatibility)。

Canonical 工程：[zlua-demo](https://github.com/focus-creative-games/zlua-demo)

---

## 安装与启动

### Play 后完全无 Lua 输出

| 检查项 | 说明 |
|--------|------|
| `LuaAppDomain.Initialize` | 须 `[RuntimeInitializeOnLoadMethod(BeforeSceneLoad)]` 或更早 |
| Console 过滤器 | 确认未隐藏 `Log` |

### `module 'xxx' not found`

| 检查项 | Editor | Player |
|--------|--------|--------|
| 文件路径 | `{ProjectRoot}/LuaScripts/xxx.lua` | `StreamingAssets/LuaScripts/xxx.lua.txt` |
| Sync | 可选 | **必须** Sync 脚本 |

---

## 类型与成员访问

### 类型为 nil

- 程序集名 / 别名是否正确（`CSharp['AC'] = CSharp['Assembly-CSharp']`）
- 含 namespace 须 `CSharp.AC['Ns.Type']`

### Event `.get` / `.set` 为 nil

已废弃。改用 `add_OnX` / `remove_OnX`。见 [Event](./events)。

---

## C# 调用 Lua

### `GetFunction` 无效

- 是否已 `LuaAppDomain.Initialize`
- module / method 是否与 Lua `return { ... }` 键名一致
- Lua 模块是否 `return { method = ... }`

---

## Editor 正常、Player 失败

| 检查 | 说明 |
|------|------|
| Generate | Il2Cpp 必须 Generate C++ stub |
| StreamingAssets | Lua 是否 Sync |
| 废弃 API | 勿用 Event `.get` |

---







## 学习路径

| | |
|---|---|
| **上一篇** | [enum 与 struct](./enums-and-structs) |
| **下一篇** | [Editor 与 Player](./editor-vs-player) |

## 相关文档

- [FAQ](../community/faq)
- [Editor 与 Player](./editor-vs-player)
