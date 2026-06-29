---
sidebar_position: 1
title: 设计概览
description: ZLua 的核心设计目标与 L/Invoke 模型。
---

# 设计概览

ZLua 的设计类比 **P/Invoke**：

| C# 互操作 | ZLua 对应 |
|-----------|-----------|
| P/Invoke | `[LuaInvoke]` (L/Invoke) |
| MonoPInvokeCallback | `[LuaCallback]` |
| MarshalAs | `[LuaMarshalAs]` |

## 核心原则

- **统一双向调用** — C# 调 Lua 用 `[LuaInvoke]`；Lua 调 C# 通过 `CSharp` 懒注册，用法贴近 C# 语义
- **自动生成** — Editor 生成 C# 桥接；发布 Il2Cpp 时生成 C++ 桥接，开发者无感
- **深度集成** — 启动时初始化全局 CLR 与 `lua_State`
- **C++ 直桥** — Player 下字段 offset 直读、函数经 `methodPointer` 调用，无 C# Wrapper

## 相关规范

- [设计规范](../spec/design-spec) — 完整设计说明
- [双运行时架构](./dual-runtime)
