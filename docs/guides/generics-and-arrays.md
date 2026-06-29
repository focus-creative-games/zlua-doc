---
sidebar_position: 6
title: 泛型与数组
description: Lua 侧构造泛型类型、数组与元素访问。
---

# 泛型与数组

Mono 下可通过 `zlua` 标准库构造 **闭合泛型类型**、**数组类型** 与实例，并在 Lua 中像 C# 一样索引与传递。示例模式摘自 [zlua 库规范](../spec/lib-spec) §5、§7。

## 概述

| 任务 | 主要 API |
|------|----------|
| 闭合泛型 `List<int>` | `zlua.make_generic_type` |
| 数组类型 `int[]` | `zlua.make_szarray_type` |
| 创建数组实例 | `zlua.new_szarray_by_element_type` / `new_szarray_by_szarray_type` |
| 泛型方法 | `zlua.make_generic_inst` + 显式第一实参 |
| 长度 | `#arr`（szarray） |
| 转 Lua 表 | `zlua.to_table(arr)` |

## 泛型类型

### 构造 `List<int>`

```lua
CSharp.AC = CSharp['Assembly-CSharp']

local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32
)

local list = ListInt()          -- 无参构造
list:Add(10)
list:Add(20)
print(list:Count())             -- 属性或 Count 访问方式见类型绑定
```

:::tip
未闭合泛型定义须用 **反引号 arity**：``List`1``、``Dictionary`2``。含 namespace 的类型表用括号访问。
:::

### Dictionary 示例

```lua
local DictStrInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.Dictionary`2'],
    zlua.types.string,
    zlua.types.int32
)

local dict = DictStrInt()
dict:Add("hp", 100)
print(dict:ContainsKey("hp"))
```

`make_generic_type` 第一个参数为 **泛型定义类型表**，后续为类型实参（`zlua.types.*` 或 `typeof` 结果）。

## 泛型方法

方法 **自身** 带泛型参数（如 `void Foo<T>(T a)`）时，第一实参须为 `generic_inst`：

```lua
local inst = zlua.make_generic_inst(zlua.types.int32)
SomeType.Foo(inst, value)
```

泛型类上的普通方法（如 `List<int>.Add`）类型已闭合，**不**走此路径。详见 [类型系统规范](../spec/type-system-spec) §6。

## 数组

### 一维数组 `int[]`

```lua
-- 方式 A：元素类型 + 长度
local arr1 = zlua.new_szarray_by_element_type(zlua.types.int32, 4)

-- 方式 B：先构造数组类型
local IntArray = zlua.make_szarray_type(zlua.types.int32)
local arr2 = zlua.new_szarray_by_szarray_type(IntArray, 4)

arr1[0] = 10      -- 0 基索引，与 C# 一致
arr1[1] = 20
print(#arr1)      -- 4，等价 C# Length
```

### 元素访问

szarray 实例为 userdata，支持下标读写（规则见 [Class 编组规范](../spec/marshal/class)）。引用类型元素可为 `nil`。

### 与 Lua 互转

```lua
-- 任意元素类型 → Lua 表（1-based 索引对应 C# 0-based）
local t = zlua.to_table(arr1)

-- 仅 blittable 基元 szarray → 二进制 string
local bytes = zlua.to_bytes(int_byte_array)
```

### 多维数组

```lua
local IntMatrix = zlua.make_mdarray_type(zlua.types.int32, 2)
local matrix = zlua.new_mdarray_by_mdarray_type(
    IntMatrix,
    {0, 0},    -- lowbounds
    {3, 4}     -- sizes
)
-- mdarray 无 # 运算符；用 GetLength 等
```

## typeArg 规则

以下形式等价，可作为 `make_generic_type`、`signature` 等 API 的类型实参：

| 形式 | 示例 |
|------|------|
| `zlua.types.*` | `zlua.types.int32` |
| `zlua.typeof(typeTable)` | `zlua.typeof(CSharp.AC.Demo)` |
| 已解析的类型表 | `CSharp.mscorlib['System.String']` |

## Mono / Il2Cpp 支持

| 能力 | Mono | Il2Cpp |
|------|:----:|:------:|
| `make_generic_type` | ✅ | ❌ |
| `List<T>` / `Dictionary<,>` 使用 | ✅ | ❌ |
| szarray 创建与 `#` | ✅ | ❌ |
| `to_table` / `to_bytes` | ✅ | ❌ |
| 泛型方法 `make_generic_inst` | ✅ | ❌ |
| mdarray | ✅ | ❌ |

## 常见错误

| 现象 | 处理 |
|------|------|
| 泛型 arity 错误 | 检查 `` `1 `` / `` `2 `` 与实参个数 |
| `List` 找不到 | 使用 `System.Collections.Generic.List` 全名 |
| 数组越界 | 与 C# 相同，0 .. Length-1 |
| `#` 对 mdarray 无效 | 使用 `GetLength(dimension)` |

## 学习路径

| | |
|---|---|
| **上一篇** | [回调与 Delegate](./callbacks-and-delegates) |
| **下一篇** | [ref / out / in](./marshal-ref-out-in) |

## 相关文档

- [zlua 标准库](../reference/lua/zlua-lib)
- [类型系统规范](../spec/type-system-spec) §2.4、§7
- [zlua 库规范](../spec/lib-spec) §5、§7
