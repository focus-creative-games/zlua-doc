---
sidebar_position: 2
title: zlua 标准库
description: 全局 zlua 表的 Lua API 参考。
---

# zlua 标准库

全局 **`zlua`** 在 `lua_State` 初始化时加载（`zlualib.lua`）。**类型访问**走 `CSharp`；**类型构造、重载、ref、数组、delegate 转换**走 `zlua`。

源码：[ZLua~/lualib/zlualib.lua](https://github.com/focus-creative-games/zlua/blob/main/ZLua~/lualib/zlualib.lua)

---

## 类型与签名

### `zlua.typeof(typeTable) → typeDescriptor`

返回类型的 System.Type 等价物（Mono 为真实 `Type`；Il2Cpp 为类型描述对象）。

| 参数 | 说明 |
|------|------|
| `typeTable` | `CSharp` 下的类型表 |

```lua
local t = zlua.typeof(CSharp.AC.Demo)
local listDef = CSharp.mscorlib['System.Collections.Generic.List`1']
```

### `zlua.types.*`

内置 corlib 类型名字符串，见 **[zlua.types 完整表](./zlua-types)**。

### `zlua.signature(typeArg, ...) → signature`

构造 **参数类型** 签名字符串，供 `get_method` 使用。**不包含**方法名。

| 参数 | 说明 |
|------|------|
| `typeArg...` | `zlua.types.*`、`zlua.typeof(T)` 或类型表 |

```lua
local sig = zlua.signature(zlua.types.int32, zlua.types.string)
-- 内部等价 "System.Int32,System.String" 等形式
```

:::warning
禁止 `obj[sig](obj, ...)` 查表调用；应 `get_method` 缓存 closure。
:::

### `zlua.get_method(target, methodName, signature, isStatic) → closure`

| 参数 | 说明 |
|------|------|
| `target` | 实例 userdata **或** 类型表（用于解析声明类型） |
| `methodName` | C# 方法名 |
| `signature` | `zlua.signature(...)` 返回值 |
| `isStatic` | `true` 查静态域；`false` 查实例域 |

```lua
local demo = CSharp.AC.Demo()
local run_i32 = zlua.get_method(demo, "Run", zlua.signature(zlua.types.int32), false)
run_i32(demo, 10)  -- 实例：点号 + 显式 self
```

### `zlua.register_method(target, alias, closure) → void`

| 参数 | 说明 |
|------|------|
| `target` | **类型表**（静态别名）或 **实例 userdata**（实例别名） |
| `alias` | methodTable 新键名；须满足键空间规则 |
| `closure` | `get_method` 返回值 |

```lua
zlua.register_method(demo, "run_i32", run_i32)
demo:run_i32(20)
```

---

## 泛型

### `zlua.make_generic_type(genericBaseType, typeArg...) → typeTable`

闭合开放泛型定义，如 `List<int>`。

```lua
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32)
local list = ListInt()
```

### `zlua.make_generic_inst(typeArg...) → genericInst`

泛型 **方法** 的类型实参包（非类型表）。

---

## ref / out / in

### `zlua.new_ref(ref_type [, value, ...]) → structUserdata`

创建 **真 ref** 槽位（StructUserData）。裸 Lua number/string 传 ref 形参时为 **拷贝语义**。

| 参数 | 说明 |
|------|------|
| `ref_type` | `zlua.types.*` 或 struct / enum 类型表 |
| `value...` | 可选初始值；省略或 nil → `default(T)` |

```lua
local n = zlua.new_ref(zlua.types.int32, 5)
local out = zlua.new_ref(zlua.types.int32)  -- out 参数
```

### `zlua.to_user_data(opaque) → userdata`

将 C#→Lua 推送的 **OpaqueValue**（lightuserdata）升级为 StructUserData / ClassUserData。须在 **同步调用链** 内使用。

---

## 数组

| API | 参数 | 返回值 | 说明 |
|-----|------|--------|------|
| `make_szarray_type(elementType)` | 元素类型 | 数组类型表 | `T[]` |
| `make_mdarray_type(elementType, rank)` | 元素类型、秩 | 多维类型表 | `T[,]` 等 |
| `new_szarray_by_element_type(type, len)` | 元素类型、长度 | ArrayUserData | |
| `new_szarray_by_szarray_type(arrType, len)` | 数组类型表、长度 | ArrayUserData | |
| `new_mdarray_by_mdarray_type(mdType, low, sizes)` | 类型、下界、尺寸 | ArrayUserData | |
| `new_mdarray_by_spec(elementType, low, sizes)` | 元素类型、下界、尺寸 | ArrayUserData | 便捷构造 |
| `to_table(szarray)` | 一维数组 | Lua table | 1-based 索引 |
| `to_bytes(szarray)` | blittable 数组 | string | 原始字节 |

---

## Delegate

### `zlua.to_delegate(func, delegateType) → delegateUserdata`

将 Lua function 转为指定 **Delegate 类型** userdata（显式形态；方法形参通常可直传 function）。

```lua
local handler = zlua.to_delegate(function(x) print(x) end, CSharp.AC['System.Action`1'])
```

---

## Mono / Il2Cpp 实现状态

| API | Mono | Il2Cpp |
|-----|:----:|:------:|
| typeof / types / signature | ✅ | ⚠️ |
| get_method / register_method | ✅ | ❌ |
| make_generic_type / make_generic_inst | ✅ | ❌ |
| new_ref / to_user_data | ✅ | ❌ |
| make_szarray_* / new_szarray_* | ✅ | ❌ |
| make_mdarray_* | ✅ | ❌ |
| to_table / to_bytes | ✅ | ❌ |
| to_delegate | ✅ | ❌ |

完整语义：[zlua 库规范](../../spec/lib-spec)

## 相关文档

- [zlua.types 常量表](./zlua-types)
- [API 概览](../overview)
- [方法重载](../../guides/methods-and-overloads)
- [泛型与数组](../../guides/generics-and-arrays)
- [ref / out / in](../../guides/marshal-ref-out-in)
