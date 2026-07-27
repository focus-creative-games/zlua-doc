---
mdx:
  format: md
sidebar_position: 1
title: 路线图
description: ZLua 版本计划与功能清单。
---

# 开发计划

## 运行时实现状态

| 运行时 | 环境 | 状态 |
|--------|------|------|
| **Il2Cpp** | Player 发布 | **已完成** |
| **Mono** | Unity Editor | **已完成** |

权威说明见 [项目状态](/docs/getting-started/project-status/)、[Mono 实现](/docs/impl/MONO/)、[Il2Cpp 实现](/docs/impl/IL2CPP/)。支持的 Unity / Lua 版本见 [兼容性](/docs/getting-started/compatibility/)。

---

## Il2Cpp（Player）

- [x] 内嵌 Lua + C++ 直桥
- [x] ReducedType stub 复用（`ZLua/Generate/All`）
- [x] `GetFunction` Delegate 桥
- [x] 懒绑定、`CSharp` 根表、重载、Marshal 路径
- [x] vs xLua 性能实测（见 [PERFORMANCE](/docs/compare/PERFORMANCE/)）
- [ ] 多平台工具链与更多设备实测

## Mono（Editor）

- [x] 目录与模块对齐 Il2Cpp
- [x] Expression Emit 桥、三表 indexer
- [x] `GetFunction` + Delegate 桥
- [x] 与 Il2Cpp Lua 可见语义一致

## 语义与文档

- [x] 本仓库 `docs/spec` 规范性契约（唯一语义标准）
- [x] `docs/impl` / `docs/compare` 实现对照与选型对比
- [ ] 用户指南与 reference 持续对齐校正
- [ ] toLua / SLua / Delegate / GC Alloc 等对比项补测

## 后续版本方向

- Luau
- 更多平台工具链与设备实测
- 迁移指南与案例（[migration](/docs/guides/migration/)）

## 相关文档

- [兼容性矩阵](/docs/getting-started/compatibility/)
- [贡献约定](/docs/community/contributing/)
- [测试框架](/docs/community/testing/)
