---
sidebar_position: 3
title: 字段与属性
description: Lua 侧访问 C# 字段与 Property 的规则与性能说明。
---

# 字段与属性

在 Lua 中，字段与无参 Property 的访问写法一致：`obj.field`。

## 用法

```lua
local demo = CSharp.AC.Demo()
demo.x = 10
print(demo:GetX())  -- 也可通过 property getter
```

Il2Cpp Player 下，简单 Property（如 `int X { get; set; }`）会被优化为**字段直读**，十倍以上减少访问开销。

## 带参 Property

带 index 访问器的 Property 支持尚在 v1.0 开发中。完成后将在此补充示例。

## 相关规范

- [类型系统规范](../spec/type-system-spec)
- [元表索引规范](../spec/meta-table-spec)
