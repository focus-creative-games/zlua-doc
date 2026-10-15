---
sidebar_position: 12.3
title: params 参数
description: C# params T[] 在 Lua 侧的展开传参、整段数组与常见陷阱。
---

# params 参数

C# 方法尾部的 **`params T[]`** 在 Lua→C# 时按 **展开优先**（对齐 C# `params`），与普通 `T[]` 形参不同。权威细则：[02-MARSHAL-AS §7](/docs/spec/marshal/02-MARSHAL-AS/)、[重载规范](/docs/spec/04-METHOD-OVERLOAD/) §3.3。

入门摘要见 [函数调用](/docs/getting-started/method-calls/)。

## 和普通 `T[]` 的差别

| | 普通 `T[]` 形参 | `params T[]` |
|--|----------------|--------------|
| 展开多槽 `Foo(1, 2, 3)` | **不支持** | **支持**（元素类型为 `T`） |
| 省略 | 视是否可选 / 可空 | → **`T[0]`**（空数组，不是 `null`） |
| 整段 `T[]` userdata | 支持 | 支持（恰好 1 个实参且可赋给 `T[]`） |
| Lua table 当整个数组 | 支持（数组形态 table） | **不支持** |
| 单独 `nil` 当整个 `null` 数组 | 可（→ null 引用） | **不支持**（`nil` 只能是展开中的一个元素） |

**无** 专用 `LuaMarshalType`（历史 `ParamsTable` 已移除）。

## 基本用法

```csharp
static void Sum(params int[] values) { /* … */ }
static void Prefix(int head, params int[] tail) { /* … */ }
static void CountNulls(params string[] values) { /* … */ }
```

```lua
-- 展开
Demo.Sum(1, 2, 3)
Demo.Sum()                 -- → int[0]
Demo.Prefix(0, 1, 2)       -- head=0, tail={1,2}

-- 整段：已有 T[] userdata（如 zlua.new_szarray_*）
Demo.Sum(arr)

-- nil 是元素，不是 null 数组
Demo.CountNulls(nil)              -- string[]{ null }
Demo.CountNulls("a", nil, "b")
```

## 不要这样写

```lua
-- ✗ table 不能当整个 params 数组
-- Demo.Sum({ 1, 2, 3 })

-- ✗ 单独 nil 不能当 null 的 int[]
-- Demo.Sum(nil)

-- 若手里只有 Lua table：先做成 T[] userdata，再整段传入
local arr = zlua.new_szarray_by_element_type(zlua.types.int32, 3)
arr[0], arr[1], arr[2] = 1, 2, 3
Demo.Sum(arr)
```

数组构造见 [数组](/docs/guides/arrays/)。

## 与重载

带 `params` 的候选可接受实参个数为 **`[minLuaArity, +∞)`**。选优时：转换分数相同后，**整段 userdata** 优于 **展开**；再相同则 **非 params** 候选优于带 `params` 的（对齐 C# 定参优先）。详见 [方法重载](/docs/guides/overloads/)。

## 不支持的范围

| 场景 | 态度 |
|------|------|
| 普通方法 / 构造上的 `params` | ✅ |
| **GetFunction** 取得的 delegate 调用 | ❌ |
| **delegate bridge**（C# 调 Lua 回调）上的 `params` | ❌ |

见 [09-FUNCTION](/docs/spec/marshal/09-FUNCTION/)。

## 常见错误

| 现象 | 处理 |
|------|------|
| `Sum({1,2,3})` mismatch | table 不能整段给 params；改展开或先造 `T[]` userdata |
| `Sum(nil)`（`params int[]`） | `int` 元素不接受 nil；省略写 `Sum()` → `int[0]` |
| 期望多槽隐式收集却走了定参重载 | 定参优先；用全签名键或改掉冲突重载 |
| GetFunction / 回调上的 params | 不支持；改成显式 `T[]` 形参 |

## 学习路径

| | |
|---|---|
| **上一篇** | [方法重载](/docs/guides/overloads/) |
| **下一篇** | [LuaAlias](/docs/guides/lua-alias/) |

## 相关文档

- [函数调用（入门）](/docs/getting-started/method-calls/)
- [数组](/docs/guides/arrays/)
- [方法重载](/docs/guides/overloads/)
- [02-MARSHAL-AS §7](/docs/spec/marshal/02-MARSHAL-AS/)
- [04-METHOD-OVERLOAD](/docs/spec/04-METHOD-OVERLOAD/)
