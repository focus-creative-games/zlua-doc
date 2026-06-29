---
sidebar_position: 2
title: Lua 访问 C# 基础
description: 通过 CSharp 根表访问 C# 类型与成员。
---

# Lua 访问 C# 基础

所有 C# 类型经全局 **`CSharp`** 根表懒加载访问，语义贴近 C#。

## 类型路径

```
CSharp                          -- 根表，懒加载程序集
  └─ {assemblyName}             -- 程序集
       └─ {TypeName}            -- 无 namespace 的类型
       └─ ['Ns.Sub.Type']       -- 含 namespace 须括号访问
```

```lua
CSharp['AC'] = CSharp['Assembly-CSharp']  -- 可选别名

local demo = CSharp.AC.Demo()             -- 构造
local panel = CSharp.AC['MyGame.UI.Panel']()  -- 含 namespace
```

## 成员访问

| 场景 | 写法 |
|------|------|
| 实例字段 | `obj.x` |
| 实例属性 | `obj.x` / `obj:SetX(10)` |
| 实例方法 | `obj:Method(args)` |
| 静态字段 | `Type.staticField` |
| 静态方法 | `Type.StaticMethod(args)` |

:::info
仅 **public** 成员对 Lua 可见。静/实例成员使用独立元数据表，不可混用。
:::

## 相关文档

- [类型系统规范](../spec/type-system-spec) — 完整语义
- [字段与属性](./fields-and-properties)
- [方法重载](./methods-and-overloads)
