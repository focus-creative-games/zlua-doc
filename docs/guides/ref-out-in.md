---
sidebar_position: 10
title: ref / in / out
description: byref 参数的默认 Opaque 行为与写回规则。
---

# ref / in / out

权威：[BYREF](/docs/spec/marshal/03-BYREF/)、[OPAQUE](/docs/spec/marshal/04-OPAQUE/)。特性级强制形态见 [LuaMarshalAs](/docs/guides/lua-marshal-as/)。

## 双路径摘要

| 方向 | 行为 |
|------|------|
| **C# → Lua**（`GetFunction` / delegate 桥） | `ref` / `out` / `in` 默认 Push **OpaqueValue** |
| **Lua → C#** | 不按 `ref`/`out`/`in` 关键字区分 Pop；**能否写回**看实参形态 |

## 写回规则（直觉）

| Lua 实参形态 | 写回 C# byref |
|--------------|---------------|
| OpaqueValue（`get`/`set_opaquevalue`） | ✅ |
| 同型 ByValUserData（如 struct userdata） | ✅（真 ref 语义） |
| 裸 number / string / 多数 ByObj | ❌ |

```lua
local x = 5
Demo.Increment(x)          -- 若形参为 ref int：裸 number 不写回，x 仍为 5

local p = Point2D(1, 2)
Demo.Offset(p)             -- ref Point2D：字段可写回 p
```

## Opaque 读写

C#→Lua 拿到的 byref 槽位通常是 Opaque：

```lua
-- 在同一次同步调用链内
local v = zlua.get_opaquevalue(slot)
zlua.set_opaquevalue(slot, newValue)
```

也可用 `zlua.new_ref(Point2D, ...)` 显式建可写回引用。详见 [常用 zlua 库](/docs/guides/zlua-lib/)。

:::warning
Opaque **不可**跨 `pcall` / 跨帧持久化当长期句柄用。需要 userdata 门面时用 `zlua.to_user_data`（见规范）。
:::

## 与值类型章的关系

by-val struct 是 **拷贝**；要「改字段并反映到 C#」须走 `ref` / Opaque / `new_ref`。见 [值类型](/docs/guides/value-types/)。






## 学习路径

| | |
|---|---|
| **上一篇** | [泛型](/docs/guides/generics/) |
| **下一篇** | [LuaMarshalAs 与高级 0GC](/docs/guides/lua-marshal-as/) |

## 相关文档

- [BYREF](/docs/spec/marshal/03-BYREF/)  
- [OPAQUE](/docs/spec/marshal/04-OPAQUE/)  
- [LuaMarshalAs](/docs/guides/lua-marshal-as/)
