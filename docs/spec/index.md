---
mdx:
  format: md
sidebar_position: 0
title: 规范索引
description: ZLua 权威规范文档阅读顺序与索引。
---

# 规范文档

本区为 ZLua 的**权威语义规范**，供进阶开发者、测试编写者与贡献者查阅。

:::info 阅读建议
日常开发请优先阅读 [使用指南](../guides/csharp-to-lua)；需要精确语义时再查阅本区对应规范。
:::

## 推荐阅读顺序

1. [设计规范](./design-spec) — 总体目标与 L/Invoke 模型
2. [类型系统规范](./type-system-spec) — `CSharp` 表、元表、成员访问
3. [方法重载规范](./method-overload-spec) — dispatch 与显式绑定
4. [编组规范](./marshal/) — 参数编组总览与分册
5. [zlua 库规范](./lib-spec) — Lua 标准库 API
6. [元表索引规范](./meta-table-spec) — obj_indexer 三表分派

## 编组分册

| 文档 | 内容 |
|------|------|
| [编组总览](./marshal/) | 默认规则、`[LuaMarshalAs]` |
| [Class](./marshal/class) | 引用类型 |
| [Struct](./marshal/struct) | 值类型、enum |
| [Function](./marshal/function) | Delegate、Lua 回调 |

## 远期规划

- [VM 索引规范](./vm-index-spec) — PUC-Rio Lua 5.4 VM patch（远期）
