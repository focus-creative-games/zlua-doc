---
sidebar_position: 6
title: 从 xLua 迁移
description: 从 xLua / tolua 迁移到 ZLua 的指南（规划中）。
---

# 从 xLua 迁移

:::info 规划中
xLua / tolua 迁移指南计划在 **v2.0** 提供。在此之前可参考 [与 xLua 对比](../concepts/comparison-with-xlua) 了解架构差异。
:::

## 主要差异预览

| 维度 | xLua | ZLua |
|------|------|------|
| 类型访问 | `CS.Namespace.Type` | `CSharp.{asm}.Type` |
| C# 调 Lua | `LuaEnv` + `DoString` / Delegate | `[LuaInvoke]` |
| 代码生成 | `[LuaCallCSharp]` 生成 Wrap | 无 C# Wrap，C++ 桥接 |
| 重载 | 生成 Wrap 分派 | dispatch + `zlua.get_method` |

## 相关文档

- [与 xLua 对比](../concepts/comparison-with-xlua)
- [路线图](./roadmap)
