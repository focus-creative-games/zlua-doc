---
sidebar_position: 12
title: 方法重载
description: 默认分派、全签名键、LuaAlias 与 register_method 短名。
---

# 方法重载

Lua 无静态类型，同名多签名不能靠编译期选定。ZLua 提供：默认分派、**全签名键**（Bind 自动）、`[LuaAlias]`、以及 `register_method` 短名。参考：[Demo.Run](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Demo.cs)、[app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua)。

日常 `demo:Run(10)` 在 [Lua 调用 C#](/docs/guides/lua-calling-csharp/) 已够用；歧义或热路径再读本篇。权威细则：[重载规范](/docs/spec/04-METHOD-OVERLOAD/)。

## 怎么选

| 方式 | 写法 | 何时用 |
|------|------|--------|
| 默认 dispatch | `demo:Run(10)` | 实参能唯一匹配 |
| **全签名键**（自动） | `demo['Run(System.Int32)'](demo, 5)` | 精确点名；**无需** `register_method` |
| `[LuaAlias]` | `demo:run_i32(5)` | 能改 C#，热路径短名 |
| `register_method` | 注册后 `demo:run_i32(5)` | 不能改 C#，又要短名 + **冒号** |

## 默认 dispatch

```lua
demo:Run(10)        -- Run(int)
demo:Run("hello")   -- Run(string)
```

仅一个 public 重载时零分派；多个时按实参匹配。

## 全签名键（同名冲突时自动注册）

当同一方法名有多个重载（例如 `Run(int)` / `Run(string)`）时，除 `Run` 的 dispatch 外，Bind 还会为每个候选挂 **direct** 键：

`方法名(参数 Type.FullName, …)`（**不含**返回类型）：

| 键 | 含义 |
|----|------|
| `Run` | 运行时分派 |
| `Run(System.Int32)` | 固定 `Run(int)` |
| `Run(System.String)` | 固定 `Run(string)` |

```lua
-- 精确调用，不必 register_method
demo['Run(System.Int32)'](demo, 5)
demo['Run(System.String)'](demo, "hi")
```

键名含括号，**不能**写 `demo:Run(System.Int32)(...)`，须括号键 + 点号 + 显式 `self`。

## `[LuaAlias]`

```csharp
[LuaAlias("run_i32")]
public void Run(int value) { }

public void Run(string value) { }
```

```lua
demo:run_i32(10)    -- 短名 + 冒号，O(1)
```

## `register_method`：短名 + 冒号

全签名键已经能精确调用，但写法冗长。`register_method` 把 **direct closure** 挂到尚未占用的短名上；之后可用冒号：

```lua
local run_i32 = demo['Run(System.Int32)']
zlua.register_method("run_i32", run_i32)

-- 好处：短名进入 method 表，之后直接
demo:run_i32(5)
```

两参数形式（与 [05-LIB](/docs/spec/05-LIB/) 一致）：`zlua.register_method(aliasName, directClosure)`。  
`aliasName` 若已存在（含 `Run`、全签名键、其它别名）→ 报错，不覆盖。

也可从 `[LuaAlias]` 键取 closure 再挂另一个自定义名。

## 常见错误

| 现象 | 处理 |
|------|------|
| 调错重载 / `ambiguous overload` | 全签名键、`[LuaAlias]` 或 `register_method` 短名 |
| 想用 `demo['(System.Int32)']` | **禁止**；必须带方法名：`Run(System.Int32)` |
| `register_method` 报已占用 | 换未使用的别名；不要覆盖 `Run` / 已有全签名键 |






## 学习路径

| | |
|---|---|
| **上一篇** | [0GC Marshal](/docs/guides/zero-gc-marshal/) |
| **下一篇** | [常用 zlua 库](/docs/guides/zlua-lib/) |

## 相关文档

- [方法重载规范](/docs/spec/04-METHOD-OVERLOAD/) §3.7、§6  
- [常用 zlua 库](/docs/guides/zlua-lib/)
