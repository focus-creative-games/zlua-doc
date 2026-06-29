---
sidebar_position: 3
title: 类型系统概览
description: CSharp 根表、元表与静实例隔离模型。
---

# 类型系统概览

## 设计目标

| 目标 | 说明 |
|------|------|
| 统一入口 | 所有类型经 `CSharp` 根表懒加载 |
| 语义贴近 C# | `Type()` 构造、`obj:Method()` 与 C# 一致 |
| 静实例隔离 | 静态与实例成员使用独立元数据表 |
| 仅 public | Lua 仅可访问 public 成员 |
| 可优化 | Il2Cpp 字段/无参属性走 `__index` 快速路径 |

## 元表模型

成员访问经 **三表分派**（method / field-getter / field-setter），详见 [元表模型](./metatable-model)。

## 权威规范

- [类型系统规范](../spec/type-system-spec)
