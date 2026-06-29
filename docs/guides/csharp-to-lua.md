---
sidebar_position: 1
title: C# 调用 Lua
description: 使用 LuaInvoke 从 C# 调用 Lua 函数。
---

# C# 调用 Lua

ZLua 通过 `[LuaInvoke("module", "method")]` 标记 `static extern` 函数，实现 C# → Lua 调用。

## 基本用法

```csharp
[LuaInvoke("app", "main")]
private static extern void AppMain();

[LuaInvoke("app", "add")]
private static extern int AppAdd(int a, int b);
```

- **module** — Lua 模块名，对应 `LoadLuaModule` 加载的文件名
- **method** — 模块 `return` 表中的函数名

## Editor 与 Player 行为

| 环境 | 实现 |
|------|------|
| Editor (Mono) | 编译后 dnlib 注入，调用 `RunLuaFunc` |
| Player (Il2Cpp) | IL 改写为 `InternalCall`，直接调用 C++ 桥接函数 |

开发者无需区分两种模式，用法完全一致。

## 约束

- 必须为 **`static extern`** 函数
- 不能是泛型类的成员函数，也不能自身是泛型函数

## 相关规范

- [设计规范](../spec/design-spec) — `LuaInvokeAttribute` 完整说明
- [快速开始](../getting-started/quick-start)
