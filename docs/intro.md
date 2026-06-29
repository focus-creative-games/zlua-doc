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

在 xLua、tolua 等成熟方案已广泛使用的今天，ZLua 仍值得评估 —— 核心差异在于 **把 Lua 当作 Native** 的统一设计、**完整的现代 C# 互操作**、**Il2Cpp 直桥性能**、**多路径 GC 优化** 与 **零 C# Wrap 生成**。

详见 **[为什么选择 ZLua](./concepts/why-zlua)**（含与 xLua 的用法对比与 Il2Cpp 性能原理）。

简要概览：

- **极致易用**：`[LuaInvoke]` / `[LuaMarshalAs]` 类比 P/Invoke，双向调用规则统一
- **极致高效**：C++ 直桥 + 签名复用，热路径理论上有数倍甚至更高优化空间
- **零 Wrapper 膨胀**：不生成海量 C# Wrap，Player 侧原生桥接
- **完整 C# 支持**：泛型、数组、重载、ref/out/in（Mono 已全量实现）

## 核心特性

| 能力 | 说明 |
|------|------|
| Lua → C# | 类/struct 访问、静态/实例成员、方法调用、泛型、数组、重载、回调、协程、`ref`/`out`/`in` 等 |
| C# → Lua | `[LuaInvoke]` 标记 `static extern` 函数，自动桥接至 Lua 模块函数 |
| 双运行时 | Editor：**Mono 已实现 v1.0 全量功能**；Player：**Il2Cpp MVP**，逐步对齐 |
| 类型访问 | `CSharp.{assembly}.{Type}` 懒加载，语义贴近 C# |

:::info 当前状态
<span class="runtimeBadge"><span class="runtimeBadgeMono">Mono · 全功能</span><span class="runtimeBadgeIl2cpp">Il2Cpp · MVP</span></span>

**Mono（Editor）** 已实现 v1.0 全量互操作能力，适合日常开发与功能验证。**Il2Cpp（Player）** 仍处于 MVP 阶段，仅支持 Demo 级基础互操作；完整 C++ 直桥与性能优化预计 **2026 年 8 月** 发布。详见 [项目状态](./getting-started/project-status)。
:::

## 下一步

- [5 分钟快速开始](./getting-started/quick-start) — 跑通最小示例
- [安装与集成](./getting-started/installation) — UPM 安装与工程结构
- [使用指南](./guides/csharp-to-lua) — C# ↔ Lua 完整教程
- [API 参考](./reference/overview) — 特性、Lua API 与编组速查
- [核心概念](./concepts/design-overview) — 设计模型与调用路径
- [为什么选择 ZLua](./concepts/why-zlua) — 相对 xLua/tolua 的选型理由
- [ZLua 与 xLua 技术架构对比](./concepts/comparison-with-xlua) — 调用路径与理论性能
- [ZLua 与 xLua 全面对比报告](./concepts/xlua-comparison-report) — Examples 用法对照与选型证据
