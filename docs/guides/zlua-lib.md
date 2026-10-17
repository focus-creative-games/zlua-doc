---
sidebar_position: 13
title: 常用 zlua 库
description: 日常最常用的 zlua API；其余见规范。
---

# 常用 zlua 库

| 层 | 职责 |
|----|------|
| **`CSharp`** | 程序集 / 类型 / 成员 / 构造 |
| **`zlua`** | 类型构造辅助、opaque、装箱、数组、delegate、泛型方法闭合（`inflate`） |
| **实例 userdata** | 成员经元表，不经 `zlua` |

全文 API：[05-LIB](/docs/spec/05-LIB/)、[参考](/docs/reference/lua/zlua-lib/)。本篇只列最常用。**不提供** `make_generic_method` / `register_method`（见规范 §9）。

## 类型实参（typeArg）

多数构造类 API 接受同一套 typeArg（[05-LIB §3](/docs/spec/05-LIB/)）：`zlua.types.*`、类型表、类型名字符串、`System.Type`（`zlua.typeof` 产物）。**例外：** GTAP 前缀 **仅** 接受 `System.Type`。

| API | 用途 |
|-----|------|
| `zlua.types.int32` 等 | 预置类型实参 |
| `zlua.typeof(typeTable)` | ≡ C# `typeof`，返回 `System.Type` |
| `zlua.get_type_from_name(name)` | 对标 `Type.GetType`（含 AQN、泛型、数组） |

## 重载

同名多候选时，短名走 dispatch；精确点名用 **全签名键**（miss 时懒解析并缓存）。冒号短名靠 Bind 期 **`[LuaAlias]`** / XML：

```lua
demo['Run(System.Int32)'](demo, 5)
local run_i32 = demo['Run(System.Int32)']
run_i32(demo, 20)
```

参数括号串可用 native `__zlua_create_signature(...)`（可本地封装为 `zlua.signature`）；**不能**单独当元表键。见 [方法重载](/docs/guides/overloads/)。

## 泛型类型与数组

```lua
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32)

local arr = zlua.new_szarray_by_element_type(zlua.types.int32, 4)
local t = zlua.to_table(arr)
local bytes = zlua.to_bytes(float_arr)  -- CLR blittable；不含 bool[] / char[]
```

## 泛型方法

开放泛型方法用 **`zlua.inflate`**（完整 typeArg，可缓存 closure）或 **GTAP**（前缀仅 `zlua.typeof(...)`）：

```lua
local GetRb = zlua.inflate(GameObject, "GetComponent", Rigidbody)
local rb = GetRb(go)
-- 或：go:GetComponent(zlua.typeof(Rigidbody))
```

见 [泛型](/docs/guides/generics/)、[函数调用](/docs/getting-started/method-calls/)。

## Opaque / ref

| API | 用途 |
|-----|------|
| `get_opaquevalue` / `set_opaquevalue` | 同步链内读写 Opaque（`ref`/`in`/`out` 默认 Push） |
| `to_user_data` | Opaque **拷贝** 为 Struct/Class userdata（长生命周期；见 [OPAQUE](/docs/spec/marshal/04-OPAQUE/)） |

`ref` struct：传同型 `Type(...)` userdata 即可写回。见 [ref/out/in](/docs/guides/ref-out-in/)。

## 装箱 / 门面

| API | 用途 |
|-----|------|
| `zlua.box(typeArg, value)` | 值类型 → ByObj userdata |
| `zlua.unbox(boxed)` | ByObj → 基元 / ByVal userdata |
| `zlua.cast(obj, targetType)` | 同 identity，换 IMT 门面 |

## Delegate

```lua
local d = zlua.to_delegate(fn, ActionIntType)  -- 第二参须已闭合
```

形参已是具体 `Action`/`Func` 时通常 **不必** 调用。见 [Function](/docs/guides/functions/)。

## 其它（需要时再查规范）

mdarray 系列、Native `__zlua_*` 对照表 —— [05-LIB](/docs/spec/05-LIB/) §8、§12。

## 学习路径

| | |
|---|---|
| **上一篇** | [Extension 方法](/docs/guides/extension-methods/) |
| **下一篇** | [第三方原生插件](/docs/guides/native-modules/) |

## 相关文档

- [05-LIB](/docs/spec/05-LIB/)
- [zlua-lib 参考](/docs/reference/lua/zlua-lib/)
- [第三方原生插件](/docs/guides/native-modules/) — socket / cjson 等不在 zlua 标准库内
