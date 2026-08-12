---
sidebar_position: 8
title: Arrays
description: Create, index, to_table, and to_bytes for one-dimensional and multidimensional arrays.
---

# Arrays

Use `zlua` to create **szarray** (`T[]`) and **mdarray**, and index them in Lua with C# semantics. For generic collections (`List<T>`, etc.), see [Generics](/docs/guides/generics/).

## One-dimensional arrays `T[]`

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

Reference-type elements may be `nil`. Out-of-range behavior matches C#.

## Convert to and from Lua tables

```lua
local t = zlua.to_table(arr)   -- Lua 表 1-based ↔ C# 0-based

-- blittable 元素 → 二进制 string（整段内存拷贝）
-- 如 byte[] / float[] / Vector3[]（struct 无引用字段）
local bytes = zlua.to_bytes(float_arr)
```

`to_bytes` requires blittable elements (primitives or structs with no reference fields); details are in the [zlua library Spec](/docs/spec/05-LIB/).

## Multidimensional arrays

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

`zlua.types.int32`, `zlua.typeof(typeTable)`, `zlua.get_type_from_name("System.Int32")`, and already-resolved type tables can all be used as element type arguments. See also [Common zlua library](/docs/guides/zlua-lib/).

## Common mistakes

| Symptom | Fix |
|------|------|
| Array out of range | Use `0 .. Length-1` |
| `#` does not work on mdarray | Use `GetLength(dimension)` |
| `to_bytes` fails | Elements are not blittable |

## Learning path

| | |
|---|---|
| **Previous** | [Function & Delegate](/docs/guides/functions/) |
| **Next** | [Generics](/docs/guides/generics/) |

## Related

- [zlua library Spec · arrays](/docs/spec/05-LIB/)
- [Class Marshal](/docs/spec/marshal/06-CLASS/)
- [Generics](/docs/guides/generics/)
