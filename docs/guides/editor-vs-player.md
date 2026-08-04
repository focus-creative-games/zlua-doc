---
sidebar_position: 91
title: Editor 与 Player
description: Mono Editor 与 Il2Cpp Player 双运行时的差异（附录）。
---

# Editor 与 Player

附录。发布清单亦可参阅 [构建流程](/docs/guides/build/)。ZLua 双后端：**Lua 可见语义必须一致**；实现路径不同。

| | Editor (Mono) | Player (Il2Cpp) |
|---|---------------|-----------------|
| **状态** | **已完成** | **已完成** |
| 实现 | Expression Emit + 三表 indexer | C++ stub + native indexer |
| C#→Lua | `GetFunction<T>` + Delegate 桥 | 同左 |
| 性能 | 日常迭代 | 基准以 Player 为准（见 [性能对比](/docs/compare/PERFORMANCE/)） |
| Generate | 无 per-type C# Wrap；Editor 无需 Generate | **`ZLua/Generate/All`**（C++ stub，非 C# Wrap） |

详见 [Mono 实现](/docs/impl/MONO/)、[Il2Cpp 实现](/docs/impl/IL2CPP/)、[项目状态](/docs/getting-started/project-status/)。

:::info 语义一致
Event、Marshal、类型访问等以 [规范](/docs/spec/00-OVERVIEW/) 为准；两端均 **无** Event 专用元表（`add_` / `remove_`）。
:::

## Player 发布检查清单

- [ ] 执行 **`ZLua/Generate/All`**
- [ ] Lua 已 Sync 到 StreamingAssets（见 [zlua-demo](https://github.com/focus-creative-games/zlua-demo)）
- [ ] 脚本行为符合 [规范](/docs/spec/00-OVERVIEW/)（勿依赖已废弃的 Event `.get` / `.set`）
- [ ] 对照 [兼容性矩阵](/docs/getting-started/compatibility/) 做冒烟



























## 学习路径

| | |
|---|---|
| **上一篇** | [排错指南](/docs/guides/troubleshooting/) |
| **下一篇** | — |

## 相关文档

- [构建流程](/docs/guides/build/)
- [第三方原生插件](/docs/guides/native-modules/) — Editor 动态 / Player 静态差异亦适用于 C 模块
- [双运行时](/docs/concepts/dual-runtime/)
- [选型对比](/docs/compare/)
- [排错指南](/docs/guides/troubleshooting/)
