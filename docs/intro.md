---
sidebar_position: 1
slug: /intro
title: 介绍
description: ZLua 是什么、核心特性与适用场景。
---

# 介绍

**ZLua** 是一个针对 Unity Il2Cpp **极致优化**的现代原生 Lua 方案。

它用清晰的规则统一 C# 与 Lua 的双向调用，把 Lua 当作另一种 **Native**——类比 P/Invoke，提供 `LuaAppDomain.GetFunction`、`[LuaMarshalAs]` 等概念，屏蔽底层易错的 Lua C API。

## 为什么选择 ZLua

相对 xLua / toLua / SLua，ZLua 的核心主张是：

| | |
|--|--|
| **更易用** | 现代、简单、**零配置**（无 per-type C# Wrap 白名单） |
| **更完备** | 几乎覆盖全部常用 C#↔Lua 特性（泛型、重载、ref/out、数组、delegate…） |
| **更高效** | 已公开四方 Il2Cpp 实测；报告、环境与统计数据统一见 [性能对比](/docs/compare/PERFORMANCE/)。 |
| **更少 GC** | 提供低分配 Marshal 路径；须区分托管 / Lua 分配、首次绑定 / 稳态。见 [GC 边界](/docs/compare/GC/)。 |
| **共享桥接** | C++ stub 按约简签名复用；包体收益需要实测，见 [桥接分析](/docs/compare/BRIDGE/)。 |
| **版本更广** | 多种 Lua 引擎与维护中的 Unity LTS 系列；版本、平台与分支限制统一见 [兼容性矩阵](/docs/getting-started/compatibility/)。 |
| **HybridCLR 热更** | 统一安装与运行时元数据注册；步骤见 [HybridCLR 集成](/docs/guides/hybridclr/)。 |
| **维护更积极** | 全职专业团队 |

完整论述见 **[为什么选择 ZLua](/docs/concepts/why-zlua/)**；四方对照见 **[选型对比](/docs/compare/)**。

## 核心特性

| 能力 | 说明 |
|------|------|
| Lua → C# | `CSharp` 根表懒加载；字段/方法/属性；泛型与数组；重载；`add_`/`remove_` 订阅 event |
| C# → Lua | `LuaAppDomain.GetFunction<T>` 取得 Delegate 后 `Invoke` |
| 双运行时 | **Mono（Editor）与 Il2Cpp（Player）均已完成**；语义一致、实现路径不同 |
| Marshal | ByVal / ByObj / Opaque 等路径，见 [Marshal 规范](/docs/spec/marshal/) |

:::info 当前状态
<span class="runtimeBadge"><span class="runtimeBadgeMono">Mono · 已完成</span><span class="runtimeBadgeIl2cpp">Il2Cpp · 已完成</span></span>

日常在 **Editor（Mono）** 开发；发版与性能以 **Il2Cpp Player** 为准（构建前 `ZLua/Generate/All`）。详见 [项目状态](/docs/getting-started/project-status/)。
:::

## 下一步

- [快速开始](/docs/getting-started/quick-start/) — 跑通最小示例
- [为什么选择 ZLua](/docs/concepts/why-zlua/) — 选型理由
- [安装与集成](/docs/getting-started/installation/) — UPM 安装与工程结构
- [使用指南](/docs/getting-started/installation/) — 循序渐进教程（安装 → 互调 → 构建 → …）
- [HybridCLR 集成](/docs/guides/hybridclr/) — 双包安装顺序与热更约束
- [选型对比](/docs/compare/) — 相对 xLua / toLua / SLua
- [性能基准](https://github.com/focus-creative-games/zlua-benchmark) — 可复现 Il2Cpp 对比与[最新报告](https://github.com/focus-creative-games/zlua-benchmark/blob/main/reports/comparison_20260728_121554.md)
- [规范总览](/docs/spec/00-OVERVIEW/) — 权威语义契约
