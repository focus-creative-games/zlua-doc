---
sidebar_position: 3
title: 支持的版本与平台
description: ZLua 支持的 Unity、Lua 版本与目标平台。
---

# 支持的版本与平台

## Lua 引擎

| 版本 | 状态 |
|------|------|
| Lua 5.4 | ✅ Alpha 已验证 |
| Lua 5.1 / 5.3 / 5.5 | 🔜 v2.0 计划 |
| LuaJIT | 🔜 v2.0 计划 |
| [Luau](https://luau.org/) | 🔜 v2.0 计划 |

## Unity

| 版本 | 状态 |
|------|------|
| Unity 2022.3 LTS | ✅ Alpha 已验证（2022.3.62f3） |
| Unity 2021+ LTS | 🔜 v2.0 计划 |
| 团结引擎 LTS | 🔜 v2.0 计划 |

## Scripting Backend

| 后端 | 环境 | 状态 |
|------|------|------|
| **Mono** | Unity Editor | v1.0 **全量功能已实现** |
| **Il2Cpp** | Player 发布 | **MVP**，仅基础互操作；完整实现进行中 |

Mono 基于反射 + 表达式编译；Il2Cpp 目标为 C++ 直桥。**当前 Player 能力与 Editor 不对等**，发布前请查阅 [项目状态](./project-status)。

## 目标平台

Il2Cpp 支持的所有平台，包括：

- Windows / macOS / Linux
- iOS / Android
- WebGL
- 微信小游戏
- 团结引擎支持的鸿蒙、车机等平台

## 下一步

- [项目状态与路线图](./project-status)
- [Editor 与 Player 差异](../guides/editor-vs-player)
