---
sidebar_position: 13
title: 常用 zlua 库
description: 日常最常用的 zlua API；其余见规范。
---

# 常用 zlua 库

| 层 | 职责 |
|----|------|
| **`CSharp`** | 程序集 / 类型 / 成员 / 构造 |
| **`zlua`** | 类型构造辅助、opaque、数组、delegate、重载短名 |
| **实例 userdata** | 成员经元表，不经 `zlua` |

全文 API：[05-LIB](/docs/spec/05-LIB/)、[参考](/docs/reference/lua/zlua-lib/)。本篇只列最常用。

## 类型实参

| API | 用途 |
|-----|------|
| `zlua.types.int32` 等 | 预置类型实参 |
| `zlua.typeof(typeTable)` | ≡ C# `typeof`，返回 `System.Type` |
| `zlua.get_type_from_name(name)` | 对标 `Type.GetType` |

## 重载

同名多候选时，Bind 已自动挂全签名键（如 `Run(System.Int32)`），一般 **不必** 先调库：

```lua
demo['Run(System.Int32)'](demo, 5)
```

需要短名 + 冒号时再 `register_method`：

```lua
local run_i32 = demo['Run(System.Int32)']
zlua.register_method("run_i32", run_i32)
demo:run_i32(5)   -- 注册后的好处：可读短名 + 冒号语法
```

`zlua.signature(...)` 只生成参数括号部分（如 `"(System.Int32)"`），用于对照/拼接；**不能**单独当元表键。见 [方法重载](/docs/guides/overloads/)。

## 泛型与数组

```lua
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32)

local arr = zlua.new_szarray_by_element_type(zlua.types.int32, 4)
local t = zlua.to_table(arr)
local bytes = zlua.to_bytes(float_arr)  -- blittable 元素
```

见 [泛型](/docs/guides/generics/)、[数组](/docs/guides/arrays/)。

## Opaque / ref

| API | 用途 |
|-----|------|
| `get_opaquevalue` / `set_opaquevalue` | 同步链内读写 Opaque |
| `new_ref` | 显式可写回引用 |
| `to_user_data` | Opaque 升级为 userdata 门面（见规范） |

见 [ref/out/in](/docs/guides/ref-out-in/)。

## Delegate

```lua
local d = zlua.to_delegate(fn, ActionIntType)  -- 第二参须已闭合
```

形参已是具体 `Action`/`Func` 时通常 **不必** 调用。见 [Function](/docs/guides/functions/)。

## 其它（需要时再查规范）

`box` / `unbox` / `cast`、`make_generic_method`、mdarray 系列、Native `__zlua_*` —— 见 [05-LIB](/docs/spec/05-LIB/)。


## 学习路径

| | |
|---|---|
| **上一篇** | [方法重载](/docs/guides/overloads/) |
| **下一篇** | [迁移指南](/docs/guides/migration/) |

## 相关文档

- [05-LIB](/docs/spec/05-LIB/)  
- [zlua-lib 参考](/docs/reference/lua/zlua-lib/)
