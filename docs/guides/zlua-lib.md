---
sidebar_position: 13
title: 常用 zlua 库
description: 日常最常用的 zlua API；其余见规范。
---

# 常用 zlua 库

| 层 | 职责 |
|----|------|
| **`CSharp`** | 程序集 / 类型 / 成员 / 构造 |
| **`zlua`** | 类型构造辅助、opaque、数组、delegate、泛型方法闭合（`inflate`） |
| **实例 userdata** | 成员经元表，不经 `zlua` |

全文 API：[05-LIB](/docs/spec/05-LIB/)、[参考](/docs/reference/lua/zlua-lib/)。本篇只列最常用。

## 类型实参

| API | 用途 |
|-----|------|
| `zlua.types.int32` 等 | 预置类型实参 |
| `zlua.typeof(typeTable)` | ≡ C# `typeof`，返回 `System.Type` |
| `zlua.get_type_from_name(name)` | 对标 `Type.GetType` |

## 重载

同名多候选时，短名走 dispatch；精确点名某一重载用 **全签名键**（`__index` miss 时懒解析并缓存为 direct）。需要 **冒号 + 短名** 时在 C# 或 XML 配 **`[LuaAlias]`**（Bind 后元表冻结，**不提供**运行时挂短名）：

```lua
demo['Run(System.Int32)'](demo, 5)

-- 热路径：首次 miss 后键已缓存
local run_i32 = demo['Run(System.Int32)']
run_i32(demo, 20)

-- Bind 期别名：demo:run_i32(5)  （见 [LuaAlias](/docs/guides/lua-alias/)）
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

开放泛型 **方法** 用 `zlua.inflate` 或调用侧 **GTAP**（前缀 `zlua.typeof(...)`），见 [泛型](/docs/guides/generics/)。

## Opaque / ref

| API | 用途 |
|-----|------|
| `get_opaquevalue` / `set_opaquevalue` | 同步链内读写 Opaque |
| `to_user_data` | Opaque 升级为 userdata 门面（见规范） |

`ref` struct：传同型 `Type(...)` userdata 即可写回。见 [ref/out/in](/docs/guides/ref-out-in/)。

## Delegate

```lua
local d = zlua.to_delegate(fn, ActionIntType)  -- 第二参须已闭合
```

形参已是具体 `Action`/`Func` 时通常 **不必** 调用。见 [Function](/docs/guides/functions/)。

## 其它（需要时再查规范）

`box` / `unbox` / `cast`、`inflate` / GTAP、mdarray 系列、Native `__zlua_*` —— 见 [05-LIB](/docs/spec/05-LIB/) §9。

## 学习路径

| | |
|---|---|
| **上一篇** | [Extension 方法](/docs/guides/extension-methods/) |
| **下一篇** | [第三方原生插件](/docs/guides/native-modules/) |

## 相关文档

- [05-LIB](/docs/spec/05-LIB/)
- [zlua-lib 参考](/docs/reference/lua/zlua-lib/)
- [第三方原生插件](/docs/guides/native-modules/) — socket / cjson 等不在 zlua 标准库内
