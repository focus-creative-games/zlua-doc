---
sidebar_position: 12
title: 方法重载
description: 默认分派、全签名键懒解析与缓存、[LuaAlias] 短名。
---

# 方法重载

Lua 无静态类型，同名多签名不能靠编译期选定。ZLua 提供：默认分派、**全签名键**（`__index` miss 时懒解析并缓存）、Bind 期 **`[LuaAlias]` / XML** 短名，以及脚本内 **本地缓存** direct closure。参考：[Demo.Run](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Demo.cs)、[app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua)。

更短入门见 [函数调用（入门）](/docs/getting-started/method-calls/)。日常 `demo:Run(10)` 在 [Lua 调用 C#](/docs/guides/lua-calling-csharp/) 已够用；歧义或热路径再读本篇。权威细则：[重载规范](/docs/spec/04-METHOD-OVERLOAD/)。

开放泛型方法（`GetComponent<T>` 等）不是重载问题，见 [泛型](/docs/guides/generics/)。

## 怎么选

| 方式 | 写法 | 何时用 |
|------|------|--------|
| 默认 dispatch | `demo:Run(10)` | 实参能唯一匹配 |
| **全签名键**（懒解析） | `demo['Run(System.Int32)'](demo, 5)` | 精确点名某一重载；首次访问 miss 后缓存为 direct |
| `[LuaAlias]` / XML | `demo:run_i32(5)` | 能改 C# 或配 XML，热路径要 **冒号 + 短名** |
| 本地缓存 direct | `local run = demo['Run(System.Int32)']; run(demo, 5)` | 循环里反复调同一固定重载 |

Bind 完成后 **不提供** 运行时挂短名 API；短名冒号只靠 Bind 期别名。

## 默认 dispatch

```lua
demo:Run(10)        -- Run(int)
demo:Run("hello")   -- Run(string)
```

仅一个 public 重载时该短名是 **direct**（零分派）；多个时挂 **dispatch**，按实参匹配。

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

## 全签名键（懒解析）

Bind **不会**预先为每个方法挂 `MethodName(Type.FullName,…)` 键。访问元表时若 method 表未命中，且键为含 `(` 的字符串，则在当前类型及基类链上按签名查找，生成 **direct** closure 并 **写入缓存**，再返回。

| 项 | 说明 |
|----|------|
| 键格式 | `方法名(参数 Type.FullName,…)`，**不含**返回类型；方法名是 CLR `MethodInfo.Name`（不是 `[LuaAlias]` 短名） |
| 适用范围 | **任意** public 实例/静态方法（含只有一个候选的；已被别名换名的仍可用 CLR 名拼键） |
| 排除 | 类实例构造、静态构造 `.cctor` —— 构造仍只走类型表 `__call` |
| 与短名 | 不改变已有 `Run` 的 direct/dispatch；只是额外多一条签名键 |

多重重载时短名 `Run` 仍是 dispatch；全签名键 bypass 分派：

| 键 | 含义 |
|----|------|
| `Run` | 运行时分派（多候选时） |
| `Run(System.Int32)` | 固定 `Run(int)`（首次括号键访问后缓存） |
| `Run(System.String)` | 固定 `Run(string)` |

```lua
demo['Run(System.Int32)'](demo, 5)
demo['Run(System.String)'](demo, "hi")
-- 单候选亦可：demo['GetValue()'](demo)

-- 热路径：首次 miss 后键已缓存，可存本地变量
local run_i32 = demo['Run(System.Int32)']
run_i32(demo, 20)
```

键名含括号，**不能**写 `demo:Run(System.Int32)(...)`，须括号键 + 点号 + 显式 `self`。需要 **冒号 + 短名** 时在 C# 或 XML 配 `[LuaAlias]`（见下节）。

拼参数括号部分可用 `zlua.signature(...)`，见 [重载规范](/docs/spec/04-METHOD-OVERLOAD/) §4.1。

## `[LuaAlias]`

```csharp
[LuaAlias("run_i32")]
public void Run(int value) { }

public void Run(string value) { }
```

```lua
demo:run_i32(10)    -- 短名 + 冒号，direct；Run(int) 已换名，不再挂默认名 "Run"
demo:Run("hi")      -- 未换名的 Run(string) → dispatch
```

别名是 **换名**（替换默认 Lua 键），不是追加。XML（`luaAliasXmlPaths` / `ZLuaAlias`）与更多例子见 [LuaAlias](/docs/guides/lua-alias/)。C# extension 挂实例表见 [Extension 方法](/docs/guides/extension-methods/)。

## 常见错误

| 现象 | 处理 |
|------|------|
| 调错重载 / `ambiguous` | 全签名键、`[LuaAlias]`，或本地缓存 direct；注意默认参数 tie-break |
| `argument mismatch`（带默认） | 必选形参未给够；不能跳过中间参数 |
| 想用 `demo['(System.Int32)']` | **禁止**；必须带方法名：`Run(System.Int32)` |
| 全签名键 `member not found` | 核对 CLR 方法名与 `Type.FullName` 是否与元数据一致；构造不能用全签名键 |
| 想要运行时挂短名 | 不支持；用 Bind 期 `[LuaAlias]` / XML，或括号键 + 本地缓存 |

## 学习路径

| | |
|---|---|
| **上一篇** | [0GC Marshal](/docs/guides/zero-gc-marshal/) |
| **下一篇** | [LuaAlias](/docs/guides/lua-alias/) |

## 相关文档

- [函数调用（入门）](/docs/getting-started/method-calls/)
- [params 参数](/docs/guides/params/)
- [LuaAlias 指南](/docs/guides/lua-alias/) — Attribute + XML 专篇
- [泛型](/docs/guides/generics/) — 开放泛型方法（非重载）
- [方法重载规范](/docs/spec/04-METHOD-OVERLOAD/) §3.7、§5、§6
- [常用 zlua 库](/docs/guides/zlua-lib/)
