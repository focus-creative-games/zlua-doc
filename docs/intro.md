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
| **更高效** | 约 **98%** 对齐用例快于 xLua；Lua→C# 平均约 **2.62×**；常见访问约 **4×** |
| **更少 GC** | 引用类型与 struct 默认 **0 GC**；OpaqueValue 等灵活策略 |
| **极小桥接** | 同签名合并的 C++ stub；体积可小一个数量级；可至 **0 桥接函数** |
| **版本更广** | Lua 5.1–5.5 / LuaJIT（Il2Cpp 上 JIT 仅 Android / iOS）；Unity 2021+；团结引擎 |
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

- [5 分钟快速开始](/docs/getting-started/quick-start/) — 跑通最小示例
- [为什么选择 ZLua](/docs/concepts/why-zlua/) — 选型理由
- [安装与集成](/docs/getting-started/installation/) — UPM 安装与工程结构
- [使用指南](/docs/guides/csharp-to-lua/) — C# ↔ Lua 完整教程
- [选型对比](/docs/compare/) — 相对 xLua / toLua / SLua
- [规范总览](/docs/spec/00-OVERVIEW/) — 权威语义契约
