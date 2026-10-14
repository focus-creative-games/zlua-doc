---
sidebar_position: 3
title: 方法重载（入门）
description: 同名多签名时默认按实参匹配；需要点名再用全签名键或 Bind 期别名。
---

# 方法重载（入门）

同名多签名时，默认按实参匹配；需要点名再用全签名键或 Bind 期别名。

## 为什么需要

Lua 没有编译期重载选择。C# 里 `Run(int)` 与 `Run(string)` 同名时，脚本侧要靠运行时匹配，或显式点名某一签名。

## 默认写法（优先）

```lua
demo:Run(10)        -- 匹配 Run(int)
demo:Run("hello")   -- 匹配 Run(string)
```

多候选时走 **dispatch**；只有一个 public 候选时该短名是 **direct**（零分派）。

## 精确点名

```lua
demo['Run(System.Int32)'](demo, 10)
```

键名含括号，须用括号键，并 **显式传 `self`**。方法名是 CLR `MethodInfo.Name`（不是 `[LuaAlias]` 短名）。

## 想要冒号短名

在 C# 标 `[LuaAlias("run_i32")]`（或 Alias XML），Bind 后即可 `demo:run_i32(10)`。**不要**期待运行时再挂短名。详见 [LuaAlias](/docs/guides/lua-alias/)。

## 下一步

默认参数、全签名键懒解析与缓存、排错见 [方法重载（指南）](/docs/guides/overloads/)。
