---
sidebar_position: 1
title: API 概览
description: ZLua C# 特性与 Lua API 索引。
---

# API 概览

## C# 特性

| 特性 | 说明 | 文档 |
|------|------|------|
| `[LuaInvoke]` | C# 调用 Lua 函数 | [详情](./csharp/lua-invoke) |
| `[LuaCallback]` | Lua 回调 C# 函数（受限） | [详情](./csharp/lua-callback) |
| `[LuaMarshalAs]` | 覆盖默认编组规则 | [详情](./csharp/lua-marshal-as) |
| `[LuaAlias]` | 方法重载别名 | [方法重载规范](../spec/method-overload-spec) |

## C# 运行时 API

| 类型 | 说明 |
|------|------|
| `LuaAppDomain` | 初始化、模块加载 |
| `LuaEnv` | Lua 环境管理 |

## Lua API

| 模块 | 说明 |
|------|------|
| `CSharp` | 程序集 / 类型懒加载根表 |
| `zlua` | 标准库（类型构造、重载、ref、数组等） |

- [CSharp 根表](./lua/csharp-root)
- [zlua 标准库](./lua/zlua-lib)
- [编组速查表](./marshal-cheatsheet)

## 使用指南索引

| 主题 | 文档 |
|------|------|
| C# → Lua | [csharp-to-lua](../guides/csharp-to-lua) |
| Lua → C# | [lua-to-csharp-basics](../guides/lua-to-csharp-basics) |
| 重载 | [methods-and-overloads](../guides/methods-and-overloads) |
| Delegate | [callbacks-and-delegates](../guides/callbacks-and-delegates) |
| Event | [events](../guides/events) |
| 泛型 / 数组 | [generics-and-arrays](../guides/generics-and-arrays) |
| ref / out / in | [marshal-ref-out-in](../guides/marshal-ref-out-in) |
| enum / struct | [enums-and-structs](../guides/enums-and-structs) |

## 权威规范

完整 API 语义以 [规范文档](../spec/) 为准。
