---
sidebar_position: 2
title: zlua 标准库
description: 全局 zlua 表的 Lua API 参考。
---

# zlua 标准库

全局 **`zlua`** 在 `lua_State` 初始化时加载（`zlualib.lua`）。与 `CSharp` 根表配合使用：类型访问走 `CSharp`，类型构造、重载、ref、数组等走 `zlua`。

源码：[zlua/ZLua~/lualib/zlualib.lua](https://github.com/focus-creative-games/zlua/blob/main/ZLua~/lualib/zlualib.lua)

## 类型与签名

### `zlua.typeof(typeTable) → typeDescriptor`

返回类型的 System.Type 等价物。

```lua
local t = zlua.typeof(CSharp.AC.Demo)
```

### `zlua.types.*`

预置 corlib 类型名，可直接作 typeArg：

| 常量 | 对应 |
|------|------|
| `zlua.types.int32` | `System.Int32` |
| `zlua.types.int64` | `System.Int64` |
| `zlua.types.single` | `System.Single` |
| `zlua.types.double` | `System.Double` |
| `zlua.types.boolean` | `System.Boolean` |
| `zlua.types.string` | `System.String` |
| `zlua.types.object` | `System.Object` |
| `zlua.types.void` | 签名场景 |

### `zlua.signature(typeArg, ...) → signature`

构造方法重载匹配用签名。见 [方法重载](../../guides/methods-and-overloads)。

### `zlua.get_method(target, name, sig, isStatic) → closure`

查找指定重载。`isStatic == true` 时 `target` 为类型表。

### `zlua.register_method(target, alias, closure) → void`

注册方法别名到 methodTable。

---

## 泛型

### `zlua.make_generic_type(genericBaseType, typeArg...) → typeTable`

闭合泛型，如 `List<int>`。见 [泛型与数组](../../guides/generics-and-arrays)。

### `zlua.make_generic_inst(typeArg...) → genericInst`

泛型 **方法** 的类型实参包。

---

## ref / out

### `zlua.new_ref(ref_type [, value, ...]) → structUserdata`

创建 ref 槽位。见 [ref / out / in](../../guides/marshal-ref-out-in)。

### `zlua.to_user_data(opaque) → userdata`

opaque lightuserdata → 正式 Struct/Class userdata（同步调用链内）。

---

## 数组

| API | 说明 |
|-----|------|
| `zlua.make_szarray_type(elementType)` | `T[]` 类型 |
| `zlua.make_mdarray_type(elementType, rank)` | 多维类型 |
| `zlua.new_szarray_by_element_type(type, len)` | 创建向量 |
| `zlua.new_szarray_by_szarray_type(arrType, len)` | 同上 |
| `zlua.new_mdarray_by_mdarray_type(mdType, low, sizes)` | 多维实例 |
| `zlua.to_table(szarray)` | → Lua 表 |
| `zlua.to_bytes(szarray)` | blittable → string |

---

## Mono / Il2Cpp 实现状态

| API | Mono | Il2Cpp |
|-----|:----:|:------:|
| typeof / types / signature | ✅ | ⚠️ |
| get_method / register_method | ✅ | ❌ |
| make_generic_type | ✅ | ❌ |
| new_ref | ✅ | ❌ |
| make_szarray_type / new_szarray_* | ✅ | ❌ |
| to_table / to_bytes | ✅ | ❌ |

完整语义：[zlua 库规范](../../spec/lib-spec)

## 相关文档

- [API 概览](../overview)
- [泛型与数组](../../guides/generics-and-arrays)
- [方法重载](../../guides/methods-and-overloads)
