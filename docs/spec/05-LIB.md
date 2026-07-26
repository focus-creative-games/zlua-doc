---
sidebar_position: 5
title: "zlua 标准库"
---

# 05 — `zlua` 标准库

> 全局 **`zlua`** 表的 Lua API。  
> 源码：`Packages/com.code-philosophy.zlua/ZLua~/lualib/zlualib.lua`  
> Native：`build-win64/.../libil2cpp/zlua/lvm/ZLuaLib.cpp`（`RegisterGlobals`）

初始化时 native 注册 `__zlua_*` 全局 C 函数，再 `dostring` 加载 `zlualib.lua` 封装为 `zlua.*`。

**相关：** 类型访问 → [02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/)；重载 → [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/)；Marshal → [marshal/](/docs/spec/marshal/)。

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
| 闭合泛型 / 数组类型表 | `zlua.make_generic_type(...)` / `zlua.make_szarray_type(...)` 的返回值 |
| `zlua.get_type_from_name` | 按 CLR 类型名解析得到的类型表（见 §4.3） |
| **类型名字符串** | 与 §4.3 `get_type_from_name(typeFullName)` 的 **`name` 相同**（对标 `System.Type.GetType(string)`：含简单名、AQN、泛型、数组等）。凡接受 `typeArg` 的 API，字符串实参均按此解析，**不限于** mscorlib |

`zlua.typeof(typeTable)` 接受 **任意** ZLua 类型表（含泛型闭合表、数组类型表），返回该类型的 **`System.Type` 反射对象**（Lua 侧为 Type 的 class userdata），语义对应 C# 的 `typeof(T)`。

---

## 4. 类型查询

### 4.1 `zlua.typeof`

```lua
zlua.typeof(typeTable) → System.Type   -- class userdata
```

| 参数 / 返回 | 说明 |
|-------------|------|
| `typeTable` | **任意** ZLua 类型表：`CSharp` 解析出的类型表，或 `make_generic_type` / `make_*array_type` / `get_type_from_name` 等得到的类型表 |
| **返回值** | 对应类型的 **`System.Type` 实例**（反射对象），与 C# `typeof(...)` 得到的值同类 |

```lua
-- 等价于 C#：typeof(int)
local intType = zlua.typeof(CSharp['mscorlib']['System.Int32'])
-- intType 为 System.Type userdata，可传给需要 Type 的 C# API

local t1 = zlua.typeof(CSharp.AC.Demo)   -- 同 typeof(Demo)
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32
)
local t2 = zlua.typeof(ListInt)          -- 同 typeof(List<int>)
local IntArr = zlua.make_szarray_type(zlua.types.int32)
local t3 = zlua.typeof(IntArr)           -- 同 typeof(int[])
```

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

### 4.3 `zlua.get_type_from_name`

```lua
zlua.get_type_from_name(typeFullName) → typeTable
```

按名称解析 CLR 类型并返回对应 **类型表**（与 `CSharp` / `make_*` 路径得到的类型表同构；失败 → `luaL_error` 或按实现约定返回 `nil`，以实现为准）。

| 参数 | 说明 |
|------|------|
| `typeFullName` | 格式与 **`System.Type.GetType(string name)`** 的 `name` 相同 |

**支持（与 `Type.GetType` 对齐）：**

- 简单名 / 命名空间限定名（解析规则同 CLR，依赖已加载程序集）
- **Assembly-qualified name**（含程序集名、版本、culture、public key token 等）
- **泛型**（开放定义与闭合形式，如 `` System.Collections.Generic.List`1[[System.Int32]] ``）
- **数组**（如 `System.Int32[]`、`System.Int32[,]`）
- 嵌套类型等 `Type.GetType` 合法写法

```lua
-- corlib
local Int32 = zlua.get_type_from_name("System.Int32")

-- 程序集限定名
local Demo = zlua.get_type_from_name(
    "Demo, Assembly-CSharp, Version=0.0.0.0, Culture=neutral, PublicKeyToken=null"
)

-- 闭合泛型（GetType 风格）
local ListInt = zlua.get_type_from_name(
    "System.Collections.Generic.List`1[[System.Int32, mscorlib]]"
)

-- 数组
local IntArr = zlua.get_type_from_name("System.Int32[]")

local t = zlua.typeof(ListInt)   -- 可与 typeof 组合
```

与 `CSharp[asm][name]` / `make_generic_type` 的关系：

| 途径 | 适用 |
|------|------|
| `CSharp[...]` | 按程序集键 + 类型全名懒绑定（常用路径） |
| `make_generic_type` / `make_*array_type` | 从已有类型表构造闭合泛型 / 数组 |
| **`get_type_from_name`** | 单字符串解析（含 AQN、泛型、数组），对标 `Type.GetType` |

**Native：** `__zlua_get_type_from_name`

---

## 5. 泛型类型

### 5.1 `zlua.make_generic_type`

```lua
zlua.make_generic_type(genericBaseType, typeArg1, ...) → typeTable
```

| 参数 | 说明 |
|------|------|
| `genericBaseType` | 未闭合泛型定义：类型表，或 §3 **typeArg**（含类型名字符串） |
| `typeArg…` | 泛型实参（§3 typeArg）；个数须与定义一致 |

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

见 [marshal/04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/)。

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

同一托管 identity，**IMT 门面 = targetType**。见 [marshal/06-CLASS.md](/docs/spec/marshal/06-CLASS/)。

**Native：** `__zlua_cast`

---

## 8. 数组

与 [02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) §7 一致。

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
zlua.to_bytes(szarray) → string   -- Lua 二进制 string（可含 \0）
```

将 **一维 szarray** 的托管内存按 **原始字节布局** 拷贝为等长 Lua string。

元素类型须符合 **CLR 互操作意义上的 blittable**（与非托管内存表示一致、可直接 pin/memcpy；对齐 [Blittable and Non-Blittable Types](https://learn.microsoft.com/dotnet/framework/interop/blittable-and-non-blittable-types)）。

| 约束 | 说明 |
|------|------|
| 输入 | **仅** szarray userdata（**不支持** mdarray） |
| 允许的元素类型 | blittable 基元：`byte` / `sbyte` / `short` / `ushort` / `int` / `uint` / `long` / `ulong` / `float` / `double` / `IntPtr` / `UIntPtr`；以及 **仅含上述 blittable 字段** 的 struct（如 `Vector3`、纯值类型 POD） |
| **不接受** | `bool[]`、`char[]`（`Boolean` / `Char` 在 CLR 中为 non-blittable）；含 `bool` / `char` / 引用字段（`string`、class 等）的元素类型；其它 non-blittable → `luaL_error` |
| 实现 | 将数组在内存中的连续数据视为 C 的 `byte[]`，长度为 **实际数据字节数**（`Length × sizeof(元素)`，含对齐后的 struct 布局），整段 **memcpy** 到 Lua string |

```lua
local bytes = zlua.to_bytes(byte_arr)     -- byte[]
local fbytes = zlua.to_bytes(float_arr)   -- float[]；#fbytes == #float_arr * 4
local vbytes = zlua.to_bytes(vector3_arr) -- Vector3[]（blittable struct）亦可
-- zlua.to_bytes(bool_arr)  / zlua.to_bytes(char_arr)  → error（non-blittable）
```

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

带 delegate 形参的 C# 方法可直接传 **Lua function**，由参数 marshal 隐式转换（[marshal/09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/)）。

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

供重载签名描述与调试对照（见 [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §4）。建议在本地封装：

```lua
function zlua.signature(...)
    return __zlua_create_signature(...)
end
```

### 11.2 `zlua.register_method`

```lua
zlua.register_method(aliasName, methodOrClosure) → void
```

完整语义见 [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §6.1。

要点：`aliasName` 在目标 method 表中 **必须尚未占用**（无论已有单项函数还是重载组）；否则 `luaL_error`。用于给 direct closure 挂 **新名**，不合并重载。

**Native：** `__zlua_register_method`

---

## 12. Native 回调一览

以下为 **`ZLuaLib::RegisterGlobals` 实际注册** 的全局函数；`zlualib.lua` 封装列对应关系。

| Native 全局 | `zlua.*` 封装 | 说明 |
|-------------|---------------|------|
| `__zlua_typeof` | `zlua.typeof` | 任意类型表 |
| `__zlua_get_type_from_name` | `zlua.get_type_from_name` | 对标 `Type.GetType` |
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
| `__zlua_to_bytes` | `zlua.to_bytes` | CLR blittable 元素 szarray → Lua string（不含 `bool[]` / `char[]`） |
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

-- 数组 → 字节（CLR blittable：byte[] / float[] / Vector3[] 等；不含 bool[] / char[]）
local byteArr = zlua.new_szarray_by_element_type(zlua.types.byte, 8)
local raw = zlua.to_bytes(byteArr)
local floats = zlua.new_szarray_by_element_type(zlua.types.float, 4)
local fraw = zlua.to_bytes(floats)   -- #fraw == 16

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
function zlua.get_type_from_name(typeFullName) return __zlua_get_type_from_name(typeFullName) end
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
