---
sidebar_position: 2
title: zlua 标准库
description: 全局 zlua 表的 Lua API 参考。
---

# zlua 标准库

全局 **`zlua`** 在 `lua_State` 初始化时加载（`zlualib.lua`）。**类型访问**走 `CSharp`；**类型构造、opaque、装箱、数组、delegate、泛型方法闭合**走 `zlua`。重载分派与全签名键在 **元表** 上完成；Bind 后 **不提供** `make_generic_method` / `register_method`。

权威契约：[05-LIB](/docs/spec/05-LIB/)。源码：[ZLua~/lualib/zlualib.lua](https://github.com/focus-creative-games/zlua/blob/main/ZLua~/lualib/zlualib.lua)

---

## 类型实参（typeArg）

凡接受 typeArg 的 API，可用（[05-LIB §3](/docs/spec/05-LIB/)）：

| 形式 | 示例 |
|------|------|
| `zlua.types.*` | `zlua.types.int32` |
| `CSharp` / `make_*` 类型表 | `CSharp.mscorlib['System.Int32']` |
| 类型名字符串 | 对标 `Type.GetType(string)` |
| `System.Type` userdata | `zlua.typeof(typeTable)` 的返回值 |

**GTAP 前缀**仅接受 **`System.Type`**，不接受类型表 / 字符串 / `zlua.types.*`。

---

## 类型与签名

### `zlua.typeof(typeTable) → System.Type`

| 参数 / 返回 | 说明 |
|-------------|------|
| `typeTable` | 任意 ZLua 类型表 |
| 返回值 | `System.Type` 反射对象（≡ C# `typeof`） |

```lua
local intType = zlua.typeof(CSharp['mscorlib']['System.Int32'])
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32)
local listType = zlua.typeof(ListInt)
```

### `zlua.get_type_from_name(typeFullName) → typeTable`

对标 `System.Type.GetType(string)`。支持 AQN、泛型、数组等；失败 → error（不静默 `nil`）。

```lua
local Int32 = zlua.get_type_from_name("System.Int32")
local IntArr = zlua.get_type_from_name("System.Int32[]")
```

### `zlua.types.*`

内置 corlib 类型名，见 **[zlua.types 完整表](/docs/reference/lua/zlua-types/)**。

### 签名字符串

Native：`__zlua_create_signature(typeArg...)` → `"(System.Int32,System.String)"`（**尚未**在 `zlualib.lua` 封装；可本地包一层 `zlua.signature`）。

全签名键在 `__index` miss 时懒解析并缓存；**禁止**把仅参数括号当元表键：

```lua
demo['Run(System.Int32)'](demo, 10)
```

短名冒号靠 Bind 期 `[LuaAlias]` / XML。见 [重载规范](/docs/spec/04-METHOD-OVERLOAD/)。

---

## 泛型类型

### `zlua.make_generic_type(genericBaseType, typeArg...) → typeTable`

闭合开放泛型定义；相同实参 intern。

```lua
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32)
local list = ListInt()
```

---

## 泛型方法

### `zlua.inflate(type, methodNameOrSignature, typeArg...) → closure`

在 **已闭合** 声明类型上查找开放泛型方法并单态化。typeArg 为完整 §3；实例 closure 为 ByObj：`f(self, …)`。

```lua
local GetRb = zlua.inflate(GameObject, "GetComponent",
    CSharp['UnityEngine.CoreModule']['UnityEngine.Rigidbody'])
local rb = GetRb(go)
```

### GTAP

对元表上的开放泛型短名，在普通实参前连续放 **N** 个 `zlua.typeof(...)` 隐式闭合。与 `inflate` 共用 intern。

```lua
local rb = go:GetComponent(zlua.typeof(Rigidbody))
```

详见 [05-LIB §9](/docs/spec/05-LIB/)、[重载规范 §3.8](/docs/spec/04-METHOD-OVERLOAD/)。

---

## Opaque / ref

`ref` / `out` / `in` **无** `zlua.new_ref`。C#→Lua 默认 Push Opaque；Lua→C# 写回看实参形态。见 [ref/out/in](/docs/guides/ref-out-in/)、[03-BYREF](/docs/spec/marshal/03-BYREF/)。

### `zlua.get_opaquevalue` / `zlua.set_opaquevalue`

同步调用链内读写 Opaque handle（lightuserdata）。

### `zlua.to_user_data(opaque) → userdata`

将 Opaque **拷贝** 为 StructUserData / ClassUserData（长生命周期）。契约见 [04-OPAQUE](/docs/spec/marshal/04-OPAQUE/)（未列入 [05-LIB §12](/docs/spec/05-LIB/) Native 一览时以 Opaque 规范为准）。

---

## 装箱 / 拆箱 / 门面

### `zlua.box(typeArg, value) → byObjUserdata`

`typeArg` 须为 **值类型**；引用类型 → error。

### `zlua.unbox(boxedValue) → luaValue | byValUserdata`

参数须为 ByObjUserData。基元 → boolean/number；enum → integer；struct → ByVal userdata。

### `zlua.cast(obj, targetType) → userdata`

同托管 identity，**IMT 门面 = targetType**。见 [06-CLASS](/docs/spec/marshal/06-CLASS/)。

---

## 数组

| API | 说明 |
|-----|------|
| `make_szarray_type(elementType)` | `T[]` 类型表 |
| `make_mdarray_type(elementType, rank)` | 多维类型表；`rank ∈ [1, 32]` |
| `new_szarray_by_element_type(type, len)` | 按元素类型 + 长度 |
| `new_szarray_by_szarray_type(arrType, len)` | 按数组类型表 + 长度 |
| `new_mdarray_by_mdarray_type(mdType, low, sizes)` | `low`/`sizes` 为长度 = rank 的连续整数表 |
| `new_mdarray_by_spec(elementType, low, sizes)` | 便捷构造 |
| `to_table(szarray)` | → Lua table；`t[i]` ↔ `arr[i-1]` |
| `to_bytes(szarray)` | CLR **blittable** 元素整段拷贝为 binary string；**不接受** `bool[]` / `char[]` 及含引用字段的元素 |

---

## Delegate

### `zlua.to_delegate(func, delegateType) → delegateUserdata`

显式转换；方法形参通常可直传 Lua function。

```lua
local handler = zlua.to_delegate(function(x) print(x) end, ActionIntType)
```

---

## Mono / Il2Cpp 实现状态

双端 **Lua 可见语义一致**。

| API | Mono | Il2Cpp |
|-----|:----:|:------:|
| typeof / types / get_type_from_name | ✅ | ✅ |
| `__zlua_create_signature` | ✅ | ✅ |
| make_generic_type / inflate / GTAP | ✅ | ✅ |
| get/set_opaquevalue | ✅ | ✅ |
| box / unbox / cast | ✅ | ✅ |
| make_*array_* / new_*array_* | ✅ | ✅ |
| to_table / to_bytes | ✅ | ✅ |
| to_delegate | ✅ | ✅ |

完整语义：[05-LIB](/docs/spec/05-LIB/)

## 相关文档

- [zlua.types 常量表](/docs/reference/lua/zlua-types/)
- [API 概览](/docs/reference/overview/)
- [方法重载](/docs/guides/overloads/)
- [泛型](/docs/guides/generics/)
- [函数调用](/docs/getting-started/method-calls/)
- [ref / out / in](/docs/guides/ref-out-in/)
