---
sidebar_position: 1
slug: /intro
title: 介绍
description: ZLua 是什么、核心特性与适用场景。
---

# 介绍

**ZLua** 是一个针对 Unity Il2Cpp **极致优化**的现代原生 Lua 方案。

它用清晰的规则统一了 C# 与 Lua 之间的双向调用，把 Lua 当作另一种 **Native**——类比 P/Invoke，ZLua 提供了 `[LuaInvoke]`、`[LuaCallback]`、`[LuaMarshalAs]` 等对应概念，对开发者完全屏蔽底层复杂易错的 Lua C API 操作。

## 为什么选择 ZLua

- **极致易用**：统一 C# 与 Lua 双向调用；Lua 中访问 C# 类时自动注册元表，Editor 与 Il2Cpp 发布对开发者无感。
- **极致高效**：在 Il2Cpp 中内嵌 Lua，C++ 层让 Il2Cpp 与 Lua 虚拟机直接互操作，数倍甚至十倍以上优化 C# 与 Lua 之间的调用开销。
- **零 Wrapper 膨胀**：字段与 Property 按偏移直读内存，相同签名的函数共享桥接函数，不再单独优化海量 wrapper。
- **专职维护**：跟进 Unity 版本，支持 Lua 5.1–5.5、LuaJIT、Luau 等。

## 核心特性

| 能力 | 说明 |
|------|------|
| Lua → C# | 类/struct 访问、静态/实例成员、方法调用、泛型、数组、重载、回调、协程、`ref`/`out`/`in` 等 |
| C# → Lua | `[LuaInvoke]` 标记 `static extern` 函数，自动桥接至 Lua 模块函数 |
| 双运行时 | Editor：**Mono 已实现 v1.0 全量功能**；Player：**Il2Cpp MVP**，逐步对齐 |
| 类型访问 | `CSharp.{assembly}.{Type}` 懒加载，语义贴近 C# |

:::info 当前状态
**Mono（Editor）** 已实现 v1.0 全量互操作能力，适合日常开发与功能验证。**Il2Cpp（Player）** 仍处于 MVP 阶段，仅支持 Demo 级基础互操作；完整 C++ 直桥与性能优化预计 **2026 年 8 月** 发布。详见 [项目状态](./getting-started/project-status)。
:::

## 下一步

- [5 分钟快速开始](./getting-started/quick-start) — 跑通最小示例
- [安装与集成](./getting-started/installation) — UPM 安装与工程结构
- [使用指南](./guides/csharp-to-lua) — C# ↔ Lua 完整教程
- [API 参考](./reference/overview) — 特性、Lua API 与编组速查
- [与 xLua 对比](./concepts/comparison-with-xlua) — 技术选型参考
