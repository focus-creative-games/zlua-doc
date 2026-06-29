---
sidebar_position: 2
title: zlua 标准库
description: 全局 zlua 表的 Lua API 索引。
---

# zlua 标准库

全局 `zlua` 表提供类型构造、重载绑定等辅助 API。

## 常用函数

| 函数 | 说明 |
|------|------|
| `zlua.typeof(typeTable)` | 获取类型描述对象 |
| `zlua.types.*` | 预置 corlib 类型常量 |
| `zlua.signature(...)` | 构造方法重载签名 |
| `zlua.get_method(obj, name, sig, isStatic)` | 查找并重载方法 |
| `zlua.register_method(target, alias, closure)` | 注册方法别名 |
| `zlua.make_generic_type(gtd, ...)` | 构造泛型类型 |
| `zlua.make_szarray_type(elementType)` | 构造数组类型 |

## 详见

- [zlua 库规范](../../spec/lib-spec) — 完整 API 说明
- [方法重载指南](../../guides/methods-and-overloads)
