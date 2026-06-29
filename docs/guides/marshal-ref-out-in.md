---
sidebar_position: 7
title: ref / out / in 参数
description: Lua 侧传递 ref、out、in 参数的编组规则。
---

# ref / out / in 参数

C# 的 `ref` / `out` / `in` 在 Lua 侧通过 **StructUserData** 表达「可回写的槽位」。核心 API 为 `zlua.new_ref`；struct 的 `_ctor` / `__call` 产物也可作为真 ref。

规则详见 [编组规范](../spec/marshal/) §3、[zlua 库规范](../spec/lib-spec) §6。

## 概述

| 修饰符 | Lua 侧建议 | 调用后回写 |
|--------|------------|------------|
| **ref** | `zlua.new_ref(T, val)` 或 struct userdata | ✅ 原地 |
| **out** | `zlua.new_ref(T)` 默认 payload | ✅ 原地 |
| **in** | 同 ref，只读语义由 C# 保证 | — |
| 裸 number 传 `ref int` | 允许但 **拷贝语义** | ❌ 不回写 |

:::warning
向 `ref int` 传裸 `5` 调用会成功，但 **不会** 回写 Lua 数字；须用 `zlua.new_ref` 或 struct userdata。
:::

## `zlua.new_ref`

```lua
zlua.new_ref(ref_type [, value, ...]) → structUserdata
```

| 参数 | 说明 |
|------|------|
| `ref_type` | typeArg；须为 **值类型**（基元、enum、struct） |
| `value` | 可选；省略为 `default(T)` |
| `...` | struct / enum 构造参数，同 `_ctor` |

### ref 基元

```lua
local n = zlua.new_ref(zlua.types.int32, 5)
CSharp.AC.Counter.Increment(n)   -- C# void Increment(ref int x)
print(n)                          -- payload 已更新（经 userdata 字段或实现约定读取）
```

### out 参数

```lua
local result = zlua.new_ref(zlua.types.int32)   -- default 0
local ok = CSharp.AC.Parser.TryParse("42", result)
if ok then
    -- 读取 result payload
end
```

### ref struct

两种方式等价，均为 **真 ref**：

```lua
local Point2D = CSharp.AC['MyGame.Point2D']

-- 方式 A：构造即 ref userdata
local p = Point2D(1, 2)
CSharp.AC.Geometry.Offset(p, 10, 20)

-- 方式 B：new_ref
local q = zlua.new_ref(Point2D, 3, 4)
CSharp.AC.Geometry.Offset(q, 1, 1)
```

by-val 形参仍对 StructUserData **拷贝**；只有 `ref`/`out`/`in` 绑定 payload 地址。

## in 参数

`in T` 在 Lua 侧实参与 `ref` 相同（须 StructUserData 或 `new_ref`）；C# 侧保证只读。传裸值时为拷贝语义。

## 引用类型 ref

`ref` 引用类型（class）规则见 [Class 编组规范](../spec/marshal/class) §2；通常通过 class userdata 或专用槽位，**不能** 对 class 使用 `zlua.new_ref`（会报错）。

## Opaque 与 `zlua.to_user_data`

C# 返回的 **opaque lightuserdata**（临时形参槽）须在同一条同步调用链内用 `zlua.to_user_data` 升级为可持有 userdata。不可跨 `pcall` / 异步保存。见 [编组规范](../spec/marshal/) §4。

## 完整示例（示意）

C#：

```csharp
public static class RefDemo
{
    public static void Swap(ref int a, ref int b)
    {
        int t = a; a = b; b = t;
    }

    public static bool TryDivide(int a, int b, out float result)
    {
        if (b == 0) { result = 0; return false; }
        result = (float)a / b;
        return true;
    }
}
```

Lua：

```lua
local x = zlua.new_ref(zlua.types.int32, 1)
local y = zlua.new_ref(zlua.types.int32, 2)
CSharp.AC.RefDemo.Swap(x, y)

local quot = zlua.new_ref(zlua.types.single)
local ok = CSharp.AC.RefDemo.TryDivide(10, 4, quot)
```

## Mono / Il2Cpp 支持

| 能力 | Mono | Il2Cpp |
|------|:----:|:------:|
| `zlua.new_ref` 基元 | ✅ | ❌ |
| ref struct | ✅ | ❌ |
| out | ✅ | ❌ |
| in | ✅ | ❌ |
| ref class | ✅ | ❌ |
| 裸值拷贝语义 | ✅ | ❌ |

## 常见错误

| 现象 | 原因 |
|------|------|
| out 参数未更新 | 使用了裸 literal 而非 `new_ref` |
| `new_ref` 报错引用类型 | `ref_type` 必须是值类型 |
| opaque 过期 | 跨 pcall 使用 lightuserdata |
| Player 不支持 | Il2Cpp MVP 未实现 ref 路径 |

## 相关文档

- [枚举与 struct](./enums-and-structs)
- [Struct 编组规范](../spec/marshal/struct)
- [zlua 库规范](../spec/lib-spec) §6
