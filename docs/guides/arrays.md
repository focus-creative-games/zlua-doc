---
sidebar_position: 8
title: 数组
description: 一维 / 多维数组的创建、索引、to_table 与 to_bytes。
---

# 数组

通过 `zlua` 创建 **szarray**（`T[]`）与 **mdarray**，在 Lua 中按 C# 语义索引。泛型集合（`List<T>` 等）见 [泛型](/docs/guides/generics/)。

## 一维数组 `T[]`

```lua
-- 方式 A：元素类型 + 长度
local arr = zlua.new_szarray_by_element_type(zlua.types.int32, 4)

-- 方式 B：先构造数组类型
local IntArray = zlua.make_szarray_type(zlua.types.int32)
local arr2 = zlua.new_szarray_by_szarray_type(IntArray, 4)

arr[0] = 10      -- 0 基，与 C# 一致
arr[1] = 20
print(#arr)      -- Length
```

引用类型元素可为 `nil`。越界与 C# 相同。

## 与 Lua 表互转

```lua
local t = zlua.to_table(arr)   -- Lua 表 1-based ↔ C# 0-based

-- blittable 元素 → 二进制 string（整段内存拷贝）
-- 如 byte[] / float[] / Vector3[]（struct 无引用字段）
local bytes = zlua.to_bytes(float_arr)
```

`to_bytes` 要求元素 blittable（基元或无引用字段的 struct）；细则见 [zlua 库规范](/docs/spec/05-LIB/)。

## 多维数组

```lua
local IntMatrix = zlua.make_mdarray_type(zlua.types.int32, 2)
local matrix = zlua.new_mdarray_by_mdarray_type(
    IntMatrix,
    {0, 0},    -- lowbounds
    {3, 4}     -- sizes
)
-- mdarray 无 # ；用 GetLength 等
```

## typeArg

`zlua.types.int32`、`zlua.typeof(typeTable)`、`zlua.get_type_from_name("System.Int32")`、已解析类型表均可作为元素类型实参。更多见 [常用 zlua 库](/docs/guides/zlua-lib/)。

## 常见错误

| 现象 | 处理 |
|------|------|
| 数组越界 | 使用 `0 .. Length-1` |
| `#` 对 mdarray 无效 | `GetLength(dimension)` |
| `to_bytes` 失败 | 元素非 blittable |






## 学习路径

| | |
|---|---|
| **上一篇** | [Function 与 Delegate](/docs/guides/functions/) |
| **下一篇** | [泛型](/docs/guides/generics/) |

## 相关文档

- [zlua 库规范 · 数组](/docs/spec/05-LIB/)  
- [Class Marshal](/docs/spec/marshal/06-CLASS/)  
- [泛型](/docs/guides/generics/)
