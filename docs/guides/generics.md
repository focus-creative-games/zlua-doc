---
sidebar_position: 9
title: 泛型
description: 闭合泛型类型与泛型方法在 Lua 侧的构造与调用。
---

# 泛型

用 `zlua.make_generic_type` 得到 **闭合** 泛型类型表，再像普通类型一样构造与调成员。仅调用 `GetComponent<T>` 等开放泛型方法时，可先看 [函数调用（入门）](/docs/getting-started/method-calls/)。数组见 [数组](/docs/guides/arrays/)。

## 闭合泛型类型

未闭合定义须带 **反引号 arity**：``List`1``、``Dictionary`2``。

```lua
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32
)

local list = ListInt()
list:Add(10)
list:Add(20)
```

```lua
local DictStrInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.Dictionary`2'],
    zlua.types.string,
    zlua.types.int32
)

local dict = DictStrInt()
dict:Add("hp", 100)
```

第一个参数为 **泛型定义类型表**，其后为类型实参（`zlua.types.*`、类型表等）。

## 泛型方法

方法 **自身** 带类型参数（如 `T GetComponent<T>()`）时，用 **`zlua.inflate`** 或调用侧 **GTAP** 闭合；**只**闭合方法的泛型形参。声明类型若仍开放（如 ``List`1``），须先 `make_generic_type` 再 `inflate`。

| 路径 | 适用 |
|------|------|
| **`zlua.inflate`** | 按已闭合类型 + 方法名/全签名键闭合；热路径可缓存返回的 closure |
| **GTAP** | 在短名调用前前缀 **N** 个 `System.Type`（`zlua.typeof(...)`）；**不**接受类型表 / 字符串 / `zlua.types.*` 作前缀 |

```lua
-- inflate：完整 §3 typeArg（类型表、字符串、System.Type 等）
local GetRb = zlua.inflate(GameObject, "GetComponent",
    CSharp['UnityEngine.CoreModule']['UnityEngine.Rigidbody'])
local rb = GetRb(go)

-- GTAP：仅 System.Type 前缀
local Rigidbody = CSharp['UnityEngine.CoreModule']['UnityEngine.Rigidbody']
local rb2 = go:GetComponent(zlua.typeof(Rigidbody))
```

已闭合类上的普通方法（如 `List<int>.Add`）**不**走本节。详见 [类型系统 §6](/docs/spec/02-TYPE-SYSTEM/)、[05-LIB §9](/docs/spec/05-LIB/)。

闭合后返回值按 **声明类型** 挂门面；若需按运行时实际类型出门面，见 [返回值门面类型](/docs/guides/actual-type-userdata/) 或 `zlua.cast`。短名多候选时可用全签名键作 `inflate` 第二参，见 [方法重载](/docs/guides/overloads/)。

## 常见错误

| 现象 | 处理 |
|------|------|
| arity 错误 | 检查 `` `1 `` / `` `2 `` 与实参个数 |
| `List` 找不到 | 使用 `System.Collections.Generic.List`1`` 全名 + 括号键 |
| 对非开放泛型方法用 `inflate` | 仅方法自身带泛型形参时需要 |
| GTAP 传类型表 | 须 `zlua.typeof(typeTable)`，或改用 `inflate` |

## 学习路径

| | |
|---|---|
| **上一篇** | [数组](/docs/guides/arrays/) |
| **下一篇** | [ref / in / out](/docs/guides/ref-out-in/) |

## 相关文档

- [函数调用（入门）](/docs/getting-started/method-calls/) — 重载 / 泛型方法 / `params`
- [返回值门面类型](/docs/guides/actual-type-userdata/)
- [方法重载](/docs/guides/overloads/)
- [zlua 库规范](/docs/spec/05-LIB/)
- [类型系统](/docs/spec/02-TYPE-SYSTEM/)
- [数组](/docs/guides/arrays/)
