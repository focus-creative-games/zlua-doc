---
sidebar_position: 12
title: Editor 与 Player
description: Mono Editor 与 Il2Cpp Player 双运行时的差异。
---

# Editor 与 Player

ZLua 实现两套代码以兼顾开发体验与发布性能。**当前实现进度差异很大：Mono 已具备 v1.0 全量能力，Il2Cpp 仍为 MVP。**

| | Editor (Mono) | Player (Il2Cpp) |
|---|---------------|-----------------|
| **功能成熟度** | **v1.0 全量已实现** | **MVP**，仅 Demo 级基础互操作 |
| 实现 | `ZLua.Mono`，反射 + 表达式编译 | `ZLua.Il2Cpp`，C++ 直桥（建设中） |
| Lua→C# | 完整 API（重载、泛型、数组等） | 字段 + 常见签名方法（手写桥接） |
| C#→Lua | `[LuaInvoke]` | `[LuaInvoke]` |
| 性能 | 对标 xLua CodeEmit 档 | 设计目标数倍～十倍于 xLua（**尚未落地**） |
| 目标 | 开发期完整语义 | 与 Mono **Lua 可见语义一致**（对齐进行中） |

:::warning Player 功能限制
构建 Il2Cpp Player 前，请确认脚本未依赖 Mono 独有能力（泛型、重载显式绑定、ref/out/in、Event 等）。详见 [项目状态](../getting-started/project-status#il2cpp-mvp)。
:::

:::info 性能说明
性能对比**仅对完整 Il2Cpp 实现有意义**；当前 Player MVP 尚未体现设计目标中的性能优势。
:::

## Player 发布检查清单

从 Editor 切 Player 前逐项确认：

- [ ] Lua 已 [Sync 到 StreamingAssets](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Editor/SyncLuaScriptsToStreamingAssets.cs)
- [ ] 未使用 `zlua.make_generic_type` / `List<T>` / 数组 API
- [ ] 未使用 `zlua.get_method` / `[LuaAlias]` 依赖的重载显式绑定（MVP 无 dispatch）
- [ ] 未使用 delegate 形参、Event `.get` / `.set`
- [ ] 未使用 `zlua.new_ref` / `ref` / `out` / `in`
- [ ] 脚本能力在 [app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua) 同等范围内 smoke 通过

更细矩阵见 [兼容性](../getting-started/compatibility) 与 [排错指南](./troubleshooting)。

## 学习路径

| | |
|---|---|
| **上一篇** | [排错指南](./troubleshooting) |
| **下一篇** | [最佳实践](./best-practices) |

## 相关文档

- [双运行时架构](../concepts/dual-runtime)
- [设计概览](../concepts/design-overview)
- [ZLua 与 xLua 技术架构对比](../concepts/comparison-with-xlua)
- [Il2Cpp 架构](../architecture/il2cpp-architecture)
- [排错指南](./troubleshooting)
