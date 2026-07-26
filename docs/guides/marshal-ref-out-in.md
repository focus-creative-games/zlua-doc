---
sidebar_position: 7
title: ref / out / in 参数
description: byref 与 OpaqueValue Marshal 规则摘要。
---

# ref / out / in 参数

权威细则：[BYREF](/docs/spec/marshal/03-BYREF/)、[OPAQUE](/docs/spec/marshal/04-OPAQUE/)。

## 双路径摘要

| 路径 | 默认行为 |
|------|----------|
| **C# → Lua**（GetFunction 取得的 delegate / delegate bridge） | `ref`/`out`/`in` 默认 Push **OpaqueValue**（lightuserdata） |
| **Lua → C#** | 不区分 ref/out/in 的 Pop 规则；能否写回取决于实参形态 |

## Lua → C#：何时能写回

| Lua 实参 | C# 修改能否反映到该 Lua 值 |
|----------|---------------------------|
| **OpaqueValue**（类型兼容） | ✅ |
| **ByValUserData** 且类型 == A | ✅（写回 payload） |
| 裸 number / string / 多数 ByObj | ❌（进临时槽） |

```lua
local x = 5
Demo.Increment(x)          -- x 仍为 5

local p = Point2D(1, 2)    -- ByValUserData
Demo.Offset(p, 10, 20)     -- p 字段可变
```

Opaque 读写：`zlua.get_opaquevalue` / `zlua.set_opaquevalue`（同步调用链内有效）。

## Mono / Il2Cpp 支持

| 能力 | Mono | Il2Cpp |
|------|:----:|:------:|
| OpaqueValue 写回 | ✅ | ✅ |
| ByValUserData 写回 | ✅ | ✅ |
| 裸 number / string 写回 | ❌ | ❌ |

细则以 [BYREF](/docs/spec/marshal/03-BYREF/)、[OPAQUE](/docs/spec/marshal/04-OPAQUE/) 为准；两端语义一致。














## 学习路径

| | |
|---|---|
| **上一篇** | [泛型与数组](/docs/guides/generics-and-arrays/) |
| **下一篇** | [Lua 模块加载](/docs/guides/lua-module-loading/) |

## 相关文档

- [Marshal 总览](/docs/spec/marshal/01-OVERVIEW/)
- [Struct Marshal](/docs/spec/marshal/05-STRUCT/)
- [Marshal 速查](/docs/reference/marshal-cheatsheet/)
