---
sidebar_position: 3
title: 支持的版本与平台
description: ZLua 支持的 Unity、Lua 版本、平台与功能矩阵。
---

# 支持的版本与平台

## Lua 引擎

| 版本 | Mono (Editor) | Il2Cpp (Player) | 备注 |
|------|:-------------:|:---------------:|------|
| Lua 5.4 | ✅ 已验证 | ✅ MVP | 当前默认 |
| Lua 5.1 / 5.3 / 5.5 | 🔜 v2.0 | 🔜 v2.0 | 路线图 |
| LuaJIT | 🔜 v2.0 | 🔜 v2.0 | v3.0 深度集成 |
| [Luau](https://luau.org/) | 🔜 v2.0 | 🔜 v2.0 | 路线图 |

## Unity

| 版本 | 状态 |
|------|------|
| Unity 2022.3 LTS | ✅ 已验证（2022.3.62f3） |
| Unity 2021+ LTS | 🔜 v2.0 |
| 团结引擎 LTS | 🔜 v2.0 |

## Scripting Backend

| 后端 | 环境 | 功能状态 |
|------|------|----------|
| **Mono** | Unity Editor | **v1.0 全量已实现** |
| **Il2Cpp** | Player 发布 | **MVP**（基础互操作） |

Mono 基于反射 + 表达式编译；Il2Cpp 目标为 C++ 直桥。**当前 Player 能力与 Editor 不对等**，发布前请查阅 [项目状态](./project-status)。

## 目标平台（Il2Cpp）

设计目标覆盖 Il2Cpp 支持的所有平台（Windows、macOS、iOS、Android、WebGL、微信小游戏、鸿蒙/车机等）。**当前 MVP 主要在 Desktop Player 验证**；其他平台遇问题请提交 Issue。

---

## 功能 × 运行时矩阵

下表概括 **v1.0 设计能力** 在两种运行时上的实现状态。✅ 可用 · ⚠️ 部分 / 受限 · ❌ 未实现。

### Lua 调用 C#

| 功能 | Mono | Il2Cpp | 说明 |
|------|:----:|:------:|------|
| class / struct 访问 | ✅ | ⚠️ | Player 以 Demo 类型为主 |
| 实例 / 静态字段 | ✅ | ✅ | Player 字段直读 |
| 实例 / 静态方法 | ✅ | ⚠️ | Player 手写桥接，常见签名 |
| Property（无参） | ✅ | ⚠️ | |
| Property（indexer） | ✅ | ❌ | |
| 方法重载 dispatch | ✅ | ❌ | |
| `[LuaAlias]` / `get_method` | ✅ | ❌ | |
| 泛型类 / 泛型方法 | ✅ | ❌ | |
| Array / List 等 | ✅ | ❌ | |
| Event | ✅ | ❌ | |
| Delegate / Lua 回调 | ✅ | ❌ | |

### C# 调用 Lua

| 功能 | Mono | Il2Cpp |
|------|:----:|:------:|
| `[LuaInvoke]` | ✅ | ✅ |
| 多参数 / 返回值 | ✅ | ⚠️ MVP 类型 |
| `[LuaMarshalAs]` | ✅ | ❌ |

### Marshal

| 类型 | Mono | Il2Cpp |
|------|:----:|:------:|
| int / bool / float / double | ✅ | ✅ |
| string | ✅ | ✅ |
| enum | ✅ | ❌ |
| class / struct | ✅ | ⚠️ |
| array | ✅ | ❌ |
| ref / out / in | ✅ | ❌ |

### 标准库 `zlua`

| API | Mono | Il2Cpp |
|-----|:----:|:------:|
| `zlua.typeof` | ✅ | ⚠️ |
| `zlua.signature` / `get_method` | ✅ | ❌ |
| `make_generic_type` | ✅ | ❌ |

完整清单见 [项目状态](./project-status) 与 [路线图](../community/roadmap)。

## 开发环境建议

| 目标 | 推荐环境 |
|------|----------|
| 功能开发、API 验证 | **Editor（Mono）** |
| 发布前冒烟 | **Il2Cpp Player**，仅 Demo 级脚本 |
| 性能评估 | 待 Il2Cpp 完整实现后 |

## 下一步

- [项目状态与路线图](./project-status)
- [Editor 与 Player 差异](../guides/editor-vs-player)
