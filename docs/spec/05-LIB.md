---
sidebar_position: 5
title: "zlua 标准库"
---

# 05 — `zlua` 标准库

> 全局 **`zlua`** 表的 Lua API。  
> 源码：`Packages/com.code-philosophy.zlua/ZLua~/lualib/zlualib.lua`  
> Native：`build-win64/.../libil2cpp/zlua/lvm/ZLuaLib.cpp`（`RegisterGlobals`）

初始化时 native 注册 `__zlua_*` 全局 C 函数，再 `dostring` 加载 `zlualib.lua` 封装为 `zlua.*`。

**相关：** 类型访问 → [02-TYPE-SYSTEM.md](02-TYPE-SYSTEM.md)；重载 → [04-METHOD-OVERLOAD.md](04-METHOD-OVERLOAD.md)；编组 → [marshal/](marshal/)。

---

## 1. 职责边界

| 层级 | 职责 |
|------|------|
| **`CSharp`** | 程序集 / 类型懒加载；静态成员；`Type(...)` 构造 |
| **`zlua`** | 类型构造辅助、opaque、装箱、数组、delegate、方法别名注册 |
| **实例 userdata** | 成员经类型元表访问，**不经** `zlua` |

`zlua` **不**替代 `CSharp` 访问类型。

---

## 2. 加载

```lua
zlua = zlua or {}   -- zlualib.lua 初始化
```

Il2Cpp：脚本嵌入 `BuiltinScripts.inc`；Mono：Resources 或同等路径。**内容须与 `zlualib.lua` 同步。**

---

## 3. 类型实参（`typeArg`）

| 形式 | 示例 |
|------|------|
| `zlua.types.*` | `zlua.types.int32` → `"System.Int32"` |
| `CSharp` 类型表 | `CSharp.mscorlib['System.Int32']` |
| mscorlib 字符串 | `"System.Int32"`（**仅** corlib 类型） |

`zlua.typeof(typeTable)` 返回 `System.Type` 等价物，供签名等场景使用；闭合泛型 / 数组 **不能** 仅用字符串，须用类型表。

---

## 4. 类型查询

### 4.1 `zlua.typeof`

```lua
zlua.typeof(typeTable) → typeDescriptor
```

| 参数 | 说明 |
|------|------|
| `typeTable` | 须为 `CSharp` 解析出的类型表（含 `__klass` 等元数据） |

**Native：** `__zlua_typeof`

### 4.2 `zlua.types`

`zlualib.lua` 预置常量（可直接作 typeArg）：

| 键 | CLR 全名 |
|----|----------|
| `void` | `System.Void` |
| `bool` | `System.Boolean` |
| `char` | `System.Char` |
| `byte` / `sbyte` | `System.Byte` / `System.SByte` |
| `short` / `ushort` | `System.Int16` / `System.UInt16` |
| `int` / `int32` | `System.Int32` |
| `uint` | `System.UInt32` |
| `long` / `ulong` | `System.Int64` / `System.UInt64` |
| `float` | `System.Single` |
| `double` | `System.Double` |
| `intptr` / `uintptr` | `System.IntPtr` / `System.UIntPtr` |
| `decimal` | `System.Decimal` |
| `object` | `System.Object` |
| `string` | `System.String` |

---

## 5. 泛型类型

### 5.1 `zlua.make_generic_type`

```lua
zlua.make_generic_type(genericBaseType, typeArg1, ...) → typeTable
```

| 参数 | 说明 |
|------|------|
| `genericBaseType` | 未闭合泛型定义类型表（键含 `` ` `` 与 arity） |
| `typeArg…` | 泛型实参；个数须与定义一致 |

返回闭合泛型类型表；相同实参 **intern** 为同一表。

**Native：** `__zlua_make_generic_type`

```lua
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32
)
```

---

## 6. Opaque 读写

见 [marshal/04-OPAQUE.md](marshal/04-OPAQUE.md)。

### 6.1 `zlua.get_opaquevalue` / `zlua.set_opaquevalue`

```lua
zlua.get_opaquevalue(opaque_handle) → value
zlua.set_opaquevalue(opaque_handle, new_value)
```

| API | 说明 |
|-----|------|
| `get_opaquevalue` | 按默认 C#→Lua 规则压栈；`ref`/`in`/`out` 先解引用 |
| `set_opaquevalue` | 按默认 Lua→C# 写回槽 |
| 生命周期 | 仅当前 C#→Lua 调用未返回期间有效 |
| 形态 | **lightuserdata**；无 metatable |

**Native：** `__zlua_get_opaquevalue` / `__zlua_set_opaquevalue`

---

## 7. 装箱 / 拆箱 / 转换

### 7.1 `zlua.box`

```lua
zlua.box(typeArg, value) → byObjUserdata
```

| 参数 | 说明 |
|------|------|
| `typeArg` | **值类型**（基元、enum、struct）；引用类型 → error |
| `value` | 基元 / enum 字面量，或 ByVal struct userdata |

**Native：** `__zlua_box`

### 7.2 `zlua.unbox`

```lua
zlua.unbox(boxedValue) → luaValue | byValUserdata
```

参数须为 **ByObjUserData**。基元 → boolean/integer/number；enum → integer；struct → ByVal userdata。

**Native：** `__zlua_unbox`

### 7.3 `zlua.cast`

```lua
zlua.cast(obj, targetType) → userdata
```

| 参数 | 说明 |
|------|------|
| `obj` | ByObj class userdata |
| `targetType` | 类型表或 typeArg |

同一托管 identity，**IMT 门面 = targetType**。见 [marshal/06-CLASS.md](marshal/06-CLASS.md)。

**Native：** `__zlua_cast`

---

## 8. 数组

与 [02-TYPE-SYSTEM.md](02-TYPE-SYSTEM.md) §7 一致。

### 8.1 数组类型

```lua
zlua.make_szarray_type(typeArg) → szarrayTypeTable
zlua.make_mdarray_type(typeArg, rank) → mdarrayTypeTable   -- rank ∈ [1, 32]
```

**Native：** `__zlua_make_szarray_type` / `__zlua_make_mdarray_type`

### 8.2 数组实例

```lua
zlua.new_szarray_by_element_type(typeArg, length) → szarrayUserdata
zlua.new_szarray_by_szarray_type(szarrayTypeTable, length) → szarrayUserdata

zlua.new_mdarray_by_mdarray_type(mdarrayType, lowbounds, sizes) → mdarrayUserdata
zlua.new_mdarray_by_spec(typeArg, lowbounds, sizes) → mdarrayUserdata
```

| 参数 | 说明 |
|------|------|
| `length` | ≥ 0 |
| `lowbounds` / `sizes` | 长度为 `rank` 的 **连续整数** Lua 表（1..n） |

元素初始化为 `default(T)`。szarray 支持 `#arr`（`__len` → `Length`）。

**Native：** `__zlua_new_szarray_by_element_type` 等

### 8.3 `zlua.to_bytes`

```lua
zlua.to_bytes(szarray) → string
```

**当前 Il2Cpp 实现：** 参数须为 **`System.Byte[]`（szarray）** userdata；将 `0 .. Length-1` 逐字节拷贝为 Lua 二进制 string（可含 `\0`）。

非 `byte[]` → `luaL_error`。

**Native：** `__zlua_to_bytes`

### 8.4 `zlua.to_table`

```lua
zlua.to_table(szarray) → table
```

参数须为 **任意元素类型的 rank-1 szarray** userdata。返回表长度 `n = #arr`，**`t[i]` ↔ C# `arr[i-1]`**（Lua 1 基 ↔ C# 0 基）。

**Native：** `__zlua_to_table`

---

## 9. 泛型方法

### 9.1 `zlua.make_generic_method`

```lua
zlua.make_generic_method(genericMethodBase, typeArg1, ...) → closure
```

| 参数 | 说明 |
|------|------|
| `genericMethodBase` | 类型表上的 **direct method closure**（未单态化的泛型方法） |
| `typeArg…` | 泛型实参；个数须与方法泛型形参一致 |

返回单态化后的 **direct closure**；相同 `(base, typeArgs…)` **intern**（写入 `staticMap` / instance map 的内部签名键）。

**要求：** 不能传入 **dispatch closure**。

**Native：** `__zlua_make_generic_method`

```lua
local bar_int = zlua.make_generic_method(MyType.GenericBar, zlua.types.int32)
bar_int(obj, 42)
```

---

## 10. Delegate

### 10.1 默认

带 delegate 形参的 C# 方法可直接传 **Lua function**，由参数 marshal 隐式转换（[marshal/09-FUNCTION.md](marshal/09-FUNCTION.md)）。

### 10.2 `zlua.to_delegate`（显式）

```lua
zlua.to_delegate(func, delegateTypeTable) → delegateUserdata
```

| 参数 | 说明 |
|------|------|
| `func` | Lua function |
| `delegateTypeTable` | 已闭合的 delegate 类型表 |

**Native：** `__zlua_to_delegate`

---

## 11. 方法重载辅助

### 11.1 签名字符串（native）

```lua
-- 尚未在 zlualib.lua 封装；可直接调用 global：
local sig = __zlua_create_signature(zlua.types.int32, zlua.types.string)
-- "(System.Int32,System.String)"
```

供重载签名描述与调试对照（见 [04-METHOD-OVERLOAD.md](04-METHOD-OVERLOAD.md) §4）。建议在本地封装：

```lua
function zlua.signature(...)
    return __zlua_create_signature(...)
end
```

### 11.2 `zlua.register_method`

```lua
zlua.register_method(aliasName, methodOrClosure) → void
```

完整语义见 [04-METHOD-OVERLOAD.md](04-METHOD-OVERLOAD.md) §6.1。

要点：`aliasName` 在目标 method 表中 **必须尚未占用**（无论已有单项函数还是重载组）；否则 `luaL_error`。用于给 direct closure 挂 **新名**，不合并重载。

**Native：** `__zlua_register_method`

---

## 12. Native 回调一览

以下为 **`ZLuaLib::RegisterGlobals` 实际注册** 的全局函数；`zlualib.lua` 封装列对应关系。

| Native 全局 | `zlua.*` 封装 | 说明 |
|-------------|---------------|------|
| `__zlua_typeof` | `zlua.typeof` | |
| `__zlua_create_signature` | *(无)* | 见 §11.1 |
| `__zlua_make_generic_type` | `zlua.make_generic_type` | |
| `__zlua_make_szarray_type` | `zlua.make_szarray_type` | |
| `__zlua_make_mdarray_type` | `zlua.make_mdarray_type` | |
| `__zlua_new_szarray_by_element_type` | `zlua.new_szarray_by_element_type` | |
| `__zlua_new_szarray_by_szarray_type` | `zlua.new_szarray_by_szarray_type` | |
| `__zlua_new_mdarray_by_mdarray_type` | `zlua.new_mdarray_by_mdarray_type` | |
| `__zlua_new_mdarray_by_spec` | `zlua.new_mdarray_by_spec` | |
| `__zlua_make_generic_method` | `zlua.make_generic_method` | |
| `__zlua_register_method` | `zlua.register_method` | 两参数 |
| `__zlua_box` | `zlua.box` | |
| `__zlua_unbox` | `zlua.unbox` | |
| `__zlua_cast` | `zlua.cast` | |
| `__zlua_to_delegate` | `zlua.to_delegate` | |
| `__zlua_get_opaquevalue` | `zlua.get_opaquevalue` | |
| `__zlua_set_opaquevalue` | `zlua.set_opaquevalue` | |
| `__zlua_to_bytes` | `zlua.to_bytes` | 当前：`byte[]` only |
| `__zlua_to_table` | `zlua.to_table` | szarray |

---

## 13. 示例

```lua
CSharp.AC = CSharp['Assembly-CSharp']
local Demo = CSharp.AC.Demo
local demo = Demo()

-- 泛型
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32
)
local list = ListInt()

-- 数组
local arr = zlua.new_szarray_by_element_type(zlua.types.int32, 4)
arr:set(0, 1)   -- 经类型绑定 get/set，见 02-TYPE-SYSTEM §7

local byteArr = zlua.new_szarray_by_element_type(zlua.types.byte, 8)
local raw = zlua.to_bytes(byteArr)

-- opaque（C# 调 Lua 回调内）
-- local v = zlua.get_opaquevalue(refHandle)

-- 别名
local run = demo.run_i32
zlua.register_method("run_hot", run)
demo:run_hot(99)

-- 门面
local child = zlua.cast(demo, CSharp.AC.Child)
```

---

## 14. `zlualib.lua` 骨架（与仓库一致）

```lua
zlua = zlua or {}

function zlua.typeof(typeTable) return __zlua_typeof(typeTable) end
function zlua.make_generic_type(genericType, ...) return __zlua_make_generic_type(genericType, ...) end
function zlua.make_generic_method(genericMethodBase, ...) return __zlua_make_generic_method(genericMethodBase, ...) end
function zlua.make_szarray_type(elementType) return __zlua_make_szarray_type(elementType) end
function zlua.make_mdarray_type(elementType, rank) return __zlua_make_mdarray_type(elementType, rank) end
function zlua.new_szarray_by_element_type(elementType, length) return __zlua_new_szarray_by_element_type(elementType, length) end
function zlua.new_szarray_by_szarray_type(szarrayType, length) return __zlua_new_szarray_by_szarray_type(szarrayType, length) end
function zlua.new_mdarray_by_mdarray_type(mdarrayType, lowbounds, sizes) return __zlua_new_mdarray_by_mdarray_type(mdarrayType, lowbounds, sizes) end
function zlua.new_mdarray_by_spec(elementType, lowbounds, sizes) return __zlua_new_mdarray_by_spec(elementType, lowbounds, sizes) end
function zlua.to_bytes(szarray) return __zlua_to_bytes(szarray) end
function zlua.to_table(szarray) return __zlua_to_table(szarray) end
function zlua.to_delegate(func, delegateType) return __zlua_to_delegate(func, delegateType) end
function zlua.get_opaquevalue(opaque_handle) return __zlua_get_opaquevalue(opaque_handle) end
function zlua.set_opaquevalue(opaque_handle, new_value) return __zlua_set_opaquevalue(opaque_handle, new_value) end
function zlua.box(typeArg, value) return __zlua_box(typeArg, value) end
function zlua.unbox(boxedValue) return __zlua_unbox(boxedValue) end
function zlua.cast(obj, targetType) return __zlua_cast(obj, targetType) end
function zlua.register_method(aliasName, methodOrClosure) return __zlua_register_method(aliasName, methodOrClosure) end

zlua.types = { /* 见 §4.2 */ }
```
