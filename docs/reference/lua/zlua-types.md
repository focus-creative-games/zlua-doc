---
sidebar_position: 3
title: zlua.types
description: zlua.types 内置 corlib 类型常量表。
---

# zlua.types

`zlua.types` 在 `zlualib.lua` 加载时初始化，提供常用 **System 类型全名字符串**，可直接作为 `zlua.signature`、`zlua.make_generic_type`、`zlua.new_ref` 等的 typeArg，等价于 `zlua.typeof(CSharp.mscorlib....)` 的简写。

源码：[ZLua~/lualib/zlualib.lua](https://github.com/focus-creative-games/zlua/blob/main/ZLua~/lualib/zlualib.lua)

:::info 命名变更
旧称 `zlua.corlibtypes` 已废弃，统一为 **`zlua.types`**。
:::

## 完整常量表

| Lua 键 | System 类型 | 典型用途 |
|--------|-------------|----------|
| `zlua.types.void` | `System.Void` | 仅签名场景（无参构造等） |
| `zlua.types.bool` | `System.Boolean` | signature、ref 槽 |
| `zlua.types.char` | `System.Char` | signature |
| `zlua.types.byte` | `System.Byte` | signature |
| `zlua.types.sbyte` | `System.SByte` | signature |
| `zlua.types.short` | `System.Int16` | signature |
| `zlua.types.ushort` | `System.UInt16` | signature |
| `zlua.types.int` | `System.Int32` | signature（与 `int32` 相同） |
| `zlua.types.int32` | `System.Int32` | signature、ref int |
| `zlua.types.uint` | `System.UInt32` | signature |
| `zlua.types.long` | `System.Int64` | signature |
| `zlua.types.ulong` | `System.UInt64` | signature |
| `zlua.types.float` | `System.Single` | signature |
| `zlua.types.double` | `System.Double` | signature |
| `zlua.types.intptr` | `System.IntPtr` | signature |
| `zlua.types.uintptr` | `System.UIntPtr` | signature |
| `zlua.types.decimal` | `System.Decimal` | 声明存在；互操作默认不支持 |
| `zlua.types.object` | `System.Object` | 泛型实参、签名 |
| `zlua.types.string` | `System.String` | signature |

## 用法示例

### 方法签名

```lua
local sig = zlua.signature(zlua.types.int32, zlua.types.string)
local fn = zlua.get_method(CSharp.AC.Demo, "SomeMethod", sig, false)
```

### ref 槽

```lua
local n = zlua.new_ref(zlua.types.int32, 5)
```

### 泛型闭合

```lua
local list_int = zlua.make_generic_type(CSharp.mscorlib['System.Collections.Generic.List`1'], zlua.types.int32)
```

## 与 `zlua.typeof` 的选择

| 场景 | 推荐 |
|------|------|
| corlib 基元 / `string` / `object` | `zlua.types.*` |
| 游戏程序集类型（`Demo`、`Point2D`） | `zlua.typeof(CSharp.AC.Demo)` 或类型表本身 |
| 泛型定义（未闭合 `List\`1`） | 类型表 + `make_generic_type` |

## Mono / Il2Cpp 支持

| 运行时 | 支持 |
|--------|:----:|
| Mono | ✅ |
| Il2Cpp MVP | ⚠️（部分 API 依赖 `signature` / `typeof`） |

## 相关文档

- [zlua 标准库](./zlua-lib)
- [方法重载](../../guides/methods-and-overloads)
- [zlua 库规范](../../spec/lib-spec) §3
