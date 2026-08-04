---
sidebar_position: 1
title: API 概览
description: ZLua C# 特性与 Lua API 索引。
---

# API 概览

程序员查表入口：C# 特性、运行时 API、Lua `CSharp` / `zlua` 标准库与 Marshal 规则。

## C# 特性

| 特性 | 说明 | 文档 |
|------|------|------|
| `GetFunction<T>` | C# 调用 Lua 函数 | [LuaAppDomain](/docs/reference/csharp/lua-app-domain/) |
| `[MonoLuaCallback]` | 原生 `int (IntPtr L)` 回调 | [MonoLuaCallback](/docs/reference/csharp/lua-callback/) |
| `[LuaMarshalAs]` | 覆盖默认 Marshal | [LuaMarshalAs](/docs/reference/csharp/lua-marshal-as/) |
| `[LuaAlias]` | 方法重载 Lua 别名 | [LuaAlias](/docs/reference/csharp/lua-alias/) |

## C# 运行时 API

| 类型 | 说明 | 文档 |
|------|------|------|
| `LuaAppDomain` | **公开**初始化入口 | [LuaAppDomain](/docs/reference/csharp/lua-app-domain/) |
| `LuaEnv` | 底层 `lua_State`（后端内部，一般不直接使用） | — |

## Lua API

| 模块 | 说明 | 文档 |
|------|------|------|
| `CSharp` | 程序集 / 类型懒加载根表 | [CSharp 根表](/docs/reference/lua/csharp-root/) |
| `zlua` | 类型构造、重载、ref、数组、delegate | [zlua 标准库](/docs/reference/lua/zlua-lib/) |
| `zlua.types` | corlib 类型常量 | [zlua.types](/docs/reference/lua/zlua-types/) |

## Marshal

| 资源 | 说明 |
|------|------|
| [Marshal 速查表](/docs/reference/marshal-cheatsheet/) | 默认规则 + `[LuaMarshalAs]` 摘要 |
| [Marshal 规范](/docs/spec/marshal/) | 权威完整规则 |

## 使用指南索引

| 主题 | 文档 |
|------|------|
| 安装 / 互调 / 构建 / 调试 | [install](/docs/guides/install/) · [hello-interop](/docs/guides/hello-interop/) · [build](/docs/guides/build/) · [debugger](/docs/guides/debugger/) |
| Lua → C# | [lua-calling-csharp](/docs/guides/lua-calling-csharp/) |
| C# → Lua | [csharp-calling-lua](/docs/guides/csharp-calling-lua/) |
| 值类型 | [value-types](/docs/guides/value-types/) |
| Function | [functions](/docs/guides/functions/) |
| 数组 / 泛型 | [arrays](/docs/guides/arrays/) · [generics](/docs/guides/generics/) |
| ref / MarshalAs / 0GC | [ref-out-in](/docs/guides/ref-out-in/) · [lua-marshal-as](/docs/guides/lua-marshal-as/) · [zero-gc-marshal](/docs/guides/zero-gc-marshal/) |
| 重载 / LuaAlias / zlua 库 | [overloads](/docs/guides/overloads/) · [lua-alias](/docs/guides/lua-alias/) · [zlua-lib](/docs/guides/zlua-lib/) |
| 第三方原生插件 | [native-modules](/docs/guides/native-modules/) · [spec 05](/docs/spec/build/05-NATIVE-MODULES/) |
| 迁移 | [migration](/docs/guides/migration/) |

## 权威规范

完整 API 语义以 [规范文档](/docs/spec/00-OVERVIEW/) 为准；本区为 **查表摘要**，细节变更以规范为准。
