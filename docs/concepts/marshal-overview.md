---
sidebar_position: 5
title: 编组模型概览
description: C# 与 Lua 之间的默认参数编组规则。
---

# 编组模型概览

ZLua 在 Mono 与 Il2Cpp 上 **Lua 可见编组语义一致**；Il2Cpp 侧重零 GC 与生成代码快速路径。

## 分册索引

| 类型 | 规范 |
|------|------|
| 总览 | [编组规范](../spec/marshal/) |
| class / 引用类型 | [Class 编组](../spec/marshal/class) |
| struct / 值类型 | [Struct 编组](../spec/marshal/struct) |
| Delegate / 回调 | [Function 编组](../spec/marshal/function) |

## 覆盖规则

参数、返回值、方法或字段上的 `[LuaMarshalAs]` 可覆盖默认规则。

## 速查

- [编组速查表](../reference/marshal-cheatsheet)
