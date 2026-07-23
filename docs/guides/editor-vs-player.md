---
sidebar_position: 12
title: Editor 与 Player
description: Mono Editor 与 Il2Cpp Player 双运行时的差异。
---

# Editor 与 Player

ZLua 双后端：**Lua 可见语义必须一致**；实现路径不同。

| | Editor (Mono) | Player (Il2Cpp) |
|---|---------------|-----------------|
| **状态** | **已完成** | **已完成** |
| 实现 | Expression Emit + 三表 indexer | C++ stub + native indexer |
| C#→Lua | `[LuaInvoke]` + Weaver | `[LuaInvoke]` + InternalCall / 生成 stub |
| 性能 | 日常迭代 | 基准以 Player 为准（见 [性能对比](../compare/PERFORMANCE)） |
| Generate | 无 per-type C# Wrap；Editor 无需 Generate | **`ZLua/Generate/All`**（C++ stub，非 C# Wrap） |

详见 [Mono 实现](../impl/MONO)、[Il2Cpp 实现](../impl/IL2CPP)、[项目状态](../getting-started/project-status)。

:::info 语义一致
Event、编组、类型访问等以 [规范](../spec/00-OVERVIEW) 为准；两端均 **无** Event 专用元表（`add_` / `remove_`）。
:::

## Player 发布检查清单

- [ ] 执行 **`ZLua/Generate/All`**
- [ ] Lua 已 Sync 到 StreamingAssets（见 [zlua-demo](https://github.com/focus-creative-games/zlua-demo)）
- [ ] 脚本行为符合 [规范](../spec/00-OVERVIEW)（勿依赖已废弃的 Event `.get` / `.set`）
- [ ] 对照 [兼容性矩阵](../getting-started/compatibility) 做冒烟








## 学习路径

| | |
|---|---|
| **上一篇** | [排错指南](./troubleshooting) |
| **下一篇** | [最佳实践](./best-practices) |

## 相关文档

- [双运行时](../concepts/dual-runtime)
- [选型对比](../compare/)
- [排错指南](./troubleshooting)
