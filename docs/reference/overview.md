---
sidebar_position: 1
title: API 概览
description: ZLua C# 特性与 Lua API 索引。
---

# API 概览

程序员查表入口：C# 特性、运行时 API、Lua `CSharp` / `zlua` 标准库与编组规则。

## C# 特性

| 特性 | 说明 | 文档 |
|------|------|------|
| `[LuaInvoke]` | C# 调用 Lua 函数 | [LuaInvoke](./csharp/lua-invoke) |
| `[MonoLuaCallback]` | 原生 `int (IntPtr L)` 回调 | [MonoLuaCallback](./csharp/lua-callback) |
| `[LuaMarshalAs]` | 覆盖默认编组 | [LuaMarshalAs](./csharp/lua-marshal-as) |
| `[LuaAlias]` | 方法重载 Lua 别名 | [LuaAlias](./csharp/lua-alias) |

## C# 运行时 API

| 类型 | 说明 | 文档 |
|------|------|------|
| `LuaAppDomain` | **公开**初始化入口 | [LuaAppDomain](./csharp/lua-app-domain) |
| `LuaEnv` | 底层 `lua_State`（后端内部，一般不直接使用） | — |

## Lua API

| 模块 | 说明 | 文档 |
|------|------|------|
| `CSharp` | 程序集 / 类型懒加载根表 | [CSharp 根表](./lua/csharp-root) |
| `zlua` | 类型构造、重载、ref、数组、delegate | [zlua 标准库](./lua/zlua-lib) |
| `zlua.types` | corlib 类型常量 | [zlua.types](./lua/zlua-types) |

## 编组

| 资源 | 说明 |
|------|------|
| [编组速查表](./marshal-cheatsheet) | 默认规则 + `[LuaMarshalAs]` 摘要 |
| [编组规范](../spec/marshal/) | 权威完整规则 |

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

完整 API 语义以 [规范文档](../spec/) 为准；本区为 **查表摘要**，细节变更以规范为准。
