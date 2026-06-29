---
sidebar_position: 6
title: 泛型与数组
description: Lua 侧构造泛型类型与访问数组。
---

# 泛型与数组

## 泛型

通过 `zlua` 标准库辅助构造泛型类型：

```lua
-- 详见 zlua 标准库规范
local listType = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32
)
```

## 数组

数组类型构造与元素访问规则见类型系统规范。

## 相关规范

- [类型系统规范](../spec/type-system-spec)
- [zlua 标准库](../spec/lib-spec)
