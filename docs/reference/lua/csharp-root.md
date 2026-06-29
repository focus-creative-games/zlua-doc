---
sidebar_position: 1
title: CSharp 根表
description: Lua 侧访问 C# 程序集与类型的入口。
---

# CSharp 根表

```lua
CSharp                    -- 全局根表
CSharp.{assemblyName}     -- 程序集
CSharp.AC.Demo            -- 类型（无 namespace）
CSharp.AC['Ns.Type']      -- 类型（含 namespace）
```

## 常用 API

| 操作 | 写法 |
|------|------|
| 构造 | `TypeTable()` |
| 静态成员 | `TypeTable.member` |
| 实例成员 | `obj:method()` / `obj.field` |

## 详见

- [类型系统规范](../../spec/type-system-spec)
- [Lua 访问 C# 基础](../../guides/lua-to-csharp-basics)
