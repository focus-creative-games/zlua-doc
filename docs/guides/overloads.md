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

## 默认参数

支持 C# **尾部**可选形参（`HasDefault`）。Lua 实参个数可落在 `[minArity, maxArity]`：省略的尾部形参在 invoke 时填 C# 默认值（Bind 期缓存，热路径不解析 metadata blob）。

```csharp
public static int Foo(int x, int y = 5) => x + y;
public static string Bar(string s, int a = 1, int b = 2) => $"{s}:{a},{b}";
public static int G(int x) => x;
public static int G(int x, int y = 5) => x + y;
```

```lua
Demo.Foo(1)          -- y=5
Demo.Foo(1, 9)
Demo.Bar("hi")       -- a=1, b=2
Demo.Bar("hi", 7)    -- b=2
Demo.G(1)            -- 选 G(int)，而非「用默认展开」的 G(int,int)
Demo.G(1, 4)         -- G(int, int)
```

| 规则 | 说明 |
|------|------|
| 仅尾部连续默认 | 与 C# 相同：中间不能「跳过」必选形参 |
| 过少实参 | 无法覆盖到首个无默认形参 → `argument mismatch` / 无匹配重载 |
| 多重载 tie-break | 转换分数相同时，**少用默认参数**的候选更优 |
| 构造 | `Type(...)` / `SMT.__call` 同样支持 |

权威细则：[重载规范](/docs/spec/04-METHOD-OVERLOAD/) §3.3。

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
demo:run_i32(10)    -- 短名 + 冒号，O(1)；Run(int) 已换名，不再挂 "Run"
demo:Run("hi")      -- 未换名的 Run(string)
```

别名是 **换名**（替换默认 Lua 键），不是追加。XML（`luaAliasXmlPaths` / `ZLuaAlias`）与更多例子见 [LuaAlias](/docs/guides/lua-alias/)。C# extension 挂实例表见 [Extension 方法](/docs/guides/extension-methods/)。

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
| 调错重载 / `ambiguous` | 全签名键、`[LuaAlias]` 或 `register_method` 短名；注意默认参数 tie-break |
| `argument mismatch`（带默认） | 必选形参未给够；不能跳过中间参数 |
| 想用 `demo['(System.Int32)']` | **禁止**；必须带方法名：`Run(System.Int32)` |
| `register_method` 报已占用 | 换未使用的别名；不要覆盖 `Run` / 已有全签名键 |

## 学习路径

| | |
|---|---|
| **上一篇** | [0GC Marshal](/docs/guides/zero-gc-marshal/) |
| **下一篇** | [LuaAlias](/docs/guides/lua-alias/) |

## 相关文档

- [LuaAlias 指南](/docs/guides/lua-alias/) — Attribute + XML 专篇
- [方法重载规范](/docs/spec/04-METHOD-OVERLOAD/) §3.7、§5、§6
- [常用 zlua 库](/docs/guides/zlua-lib/)
