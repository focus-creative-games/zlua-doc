---
sidebar_position: 4
title: 元表模型
description: obj_indexer 三表分派与 strict miss 策略。
---

# 元表模型

Lua 侧通过 `__index` / `__newindex` 访问 C# 静态与实例成员。

## 三表分派

| 表 | 职责 |
|----|------|
| methodTable | 方法 lookup |
| fieldGetterTable | 读字段/无参 property |
| fieldSetterTable | 写字段/无参 property |

运行时按 method → getter → setter 顺序查表；未注册成员 **直接 Lua error**（strict miss），不走 C# 反射 fallback。

## 平台实现

| 运行时 | 实现 |
|--------|------|
| Mono (Editor) | Lua function `__index` / `__newindex` |
| Il2Cpp (Player) | C closure `DispatchIndex` / `DispatchNewIndex` |

## 权威规范

- [元表索引规范](../spec/meta-table-spec)
- [VM 索引优化（远期）](../spec/vm-index-spec)
