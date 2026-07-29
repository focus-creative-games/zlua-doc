---
sidebar_position: 9
title: 泛型
description: 闭合泛型类型与泛型方法在 Lua 侧的构造与调用。
---

# 泛型

用 `zlua.make_generic_type` 得到 **闭合** 泛型类型表，再像普通类型一样构造与调成员。数组见 [数组](/docs/guides/arrays/)。

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

第一个参数为 **泛型定义类型表**，其后为类型实参（`zlua.types.*`、`typeof` 结果等）。

## 泛型方法

方法 **自身** 带类型参数（如 `void Foo<T>(T a)`）时，第一实参须为 `generic_inst`：

```lua
local inst = zlua.make_generic_inst(zlua.types.int32)
SomeType.Foo(inst, value)
```

已闭合类上的普通方法（如 `List<int>.Add`）**不**走此路径。见 [类型系统 §6](/docs/spec/02-TYPE-SYSTEM/)。

## 常见错误

| 现象 | 处理 |
|------|------|
| arity 错误 | 检查 `` `1 `` / `` `2 `` 与实参个数 |
| `List` 找不到 | 使用 `System.Collections.Generic.List`1`` 全名 + 括号键 |
| 对已闭合方法误传 `make_generic_inst` | 仅开放泛型方法需要 |











## 学习路径

| | |
|---|---|
| **上一篇** | [数组](/docs/guides/arrays/) |
| **下一篇** | [ref / in / out](/docs/guides/ref-out-in/) |

## 相关文档

- [zlua 库规范](/docs/spec/05-LIB/)  
- [类型系统](/docs/spec/02-TYPE-SYSTEM/)  
- [数组](/docs/guides/arrays/)
