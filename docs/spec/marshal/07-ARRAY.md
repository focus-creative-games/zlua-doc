---
sidebar_position: 13
title: "数组 Marshal"
---

# 数组 Marshal

> **规范性：** 一维向量数组（szarray）、多维数组（mdarray）及 `byte[]` 在 Lua 与 C# 之间的 Marshal 规则。  
> **相关：** 类型表、创建、`#`、`get`/`set` → [`../02-TYPE-SYSTEM.md`](../02-TYPE-SYSTEM) §数组；`zlua.to_bytes` / `to_table` → [`../05-LIB.md`](../05-LIB)；class ByObj 基础 → [`06-CLASS.md`](./06-CLASS)；`[LuaMarshalAs]` → [`02-MARSHAL-AS.md`](./02-MARSHAL-AS)。

**平台原则：** Mono 与 Il2Cpp 的 **Lua 可见语义一致**；数组实例为 **ByObjUserData**（引用类型，走 ObjectRegistry / GCHandle 路径）。

---

## 1. 默认 Marshal 矩阵

未标注 `[LuaMarshalAs]` 时：

| C# 类型 | C# → Lua | Lua → C# | 说明 |
|---------|----------|----------|------|
| **`T[]`（szarray）** | **ByObjUserData** | **ByObjUserData** **或** **数组形态 Lua table** | 见 §2、§3 |
| **`T[,…]`（mdarray）** | **ByObjUserData** | **仅** **ByObjUserData** | **不** 接受 table |
| **`byte[]`** | 同 szarray | 同 szarray | 除非 `[LuaMarshalAs(Bytes)]` → ↔ Lua **string**（§6） |

数组实例统一 Push 为 **ByObjUserData**（`ObjectUserData` + 数组 ByObj 实例元表；载荷为 `Il2CppArray*` / 托管数组引用）。脚本侧经 `get` / `set`、`#arr`、`GetValue` / `SetValue` 等访问，见 [`../02-TYPE-SYSTEM.md`](../02-TYPE-SYSTEM)。

---

## 2. C# → Lua

| 项 | 规则 |
|----|------|
| 形态 | **ByObjUserData**（full userdata + 数组 IMT） |
| **`null`** | **`nil`** |
| 元素 Push | 按元素类型 `T` 的默认 marshal（基元 → integer/number；引用类型 → userdata；enum → integer/number） |
| **`[LuaMarshalAs(Bytes)]` on `byte[]`** | Push Lua **string**（原始 octet 序列，非 UTF-8 文本语义） |
| **`[LuaMarshalAs(OpaqueValue)]`** | Push **OpaqueValue**（仅 C#→Lua）；见 [`04-OPAQUE.md`](./04-OPAQUE) |
| **`params T[]` 返回值 / 形参（C#→Lua）** | 与 szarray 相同：Push **ByObjUserData**（**不** 默认 Push table）；`ParamsTable` 例外见 [`02-MARSHAL-AS.md`](./02-MARSHAL-AS) |

---

## 3. Lua → C#（szarray）

接受下列形态 **二选一**（外加 `nil`）：

| 实参形态 | Pop 行为 |
|----------|----------|
| **ByObjUserData** | 绑定类型须与目标 `T[]` 一致（或元素类型兼容）；读数组引用传入形参 |
| **Lua table（数组形态）** | 键 **`1`…`n`** 连续整数、**无空洞**；按顺序 Pop 各元素为 `T`，构造 **`T[n]`** |
| **`nil`** | 引用类型数组 → C# **`null`** |

### 3.1 table 形态约束

与 [`02-MARSHAL-AS.md`](./02-MARSHAL-AS) 中顺序 table 规则相同：

| 接受 | 拒绝 |
|------|------|
| `{ v1, v2, … }`，键 `1..n` 连续 | **稀疏 table** |
| 空表 `{}` → **`T[0]`**（零长度数组） | **字符串键** table |
| | **`0` 起标** 伪数组（v1 **不** 兼容） |
| | 非整型键 |

Pop 各元素时按 **`T`** 的默认 marshal 规则（含 enum integer、嵌套 szarray 的 table 或 userdata 等）。

### 3.2 示例

```lua
-- ByObjUserData
CS.Demo.Process(arr)

-- table → T[n]
CS.Demo.Process({ 1, 2, 3 })
CS.Demo.Process({})          -- T[0]

-- null
CS.Demo.Process(nil)
```

---

## 4. Lua → C#（mdarray）

| 实参 | Pop 行为 |
|------|----------|
| **ByObjUserData** | 绑定类型须匹配目标 mdarray |
| **`nil`** | **`null`** |
| **Lua table** | **不接受** |
| 其它 | **`luaL_error`** |

**不因** `[LuaMarshalAs]` 标注而接受 table（`UserData` 与默认等价；`OpaqueValue` 仅 C#→Lua）。

---

## 5. 数组元素读写（与 Marshal 的关系）

数组 **实例** 为 ByObjUserData；**元素** 读写走元素类型 marshal，不经整数组 Pop/Push：

| API | 说明 |
|-----|------|
| **`arr:get(i1, …)`** / **`arr:set(i1, …, value)`** | 下标为 **C# 各维下标**（szarray 默认 0 基）；返回/接受 **元素类型 `T` 的 Lua 形态** |
| **`GetValue` / `SetValue`** | 仍可用；`GetValue` 返回 **`object`（装箱）** |
| **`#arr`** | szarray → `Length`；mdarray → 各维长度之积 |

详见 [`../02-TYPE-SYSTEM.md`](../02-TYPE-SYSTEM) 数组章节。

> **与 `zlua.to_table` 的下标差异：** `to_table` 产出 **1 基** Lua 表（`t[i]` ↔ `arr[i-1]`）；`get`/`set` 使用 **C# 下标**。

---

## 6. `byte[]` 与 `[LuaMarshalAs(Bytes)]`

| 配置 | C# ↔ Lua |
|------|----------|
| **默认** | 同 **`T[]`** szarray（ByObjUserData；Lua→C# 亦可 table） |
| **`[LuaMarshalAs(Bytes)]`** | **强制** C# **`byte[]`** ↔ Lua **`string`**（octet 序列） |

标注 `Bytes` 时：

| 方向 | 规则 |
|------|------|
| **C# → Lua** | Push Lua **string** |
| **Lua → C#** | Pop **须为 string**；**不接受** ByObjUserData / table |

若标注于 **`string`** 形参/返回值，则走 **`byte[]` ↔ string** 的对偶规则（按声明类型解析）。

---

## 7. `params T[]` 形参

`params T[]` Marshal 规则与 §1.2 szarray **相同**（ByObjUserData 或 table）；差异在 Lua 传参形态与空/null 语义。详见 [`02-MARSHAL-AS.md`](./02-MARSHAL-AS) §ParamsTable。

要点摘要：

| 传入 | C# 收到 |
|------|---------|
| ByObjUserData | 该数组引用 |
| table `{}` | **`T[0]`** |
| table `{ … }` | 按元素构造的 **`T[n]`** |
| **`nil`** | **`null`**（**非** 空数组） |

Lua **不支持** C# 式多槽隐式收集（`Sum(1, 2, 3)` **非法**）；须 **单个** 实参占据 `params` 位。

**GetFunction 取得的 delegate 调用 / delegate bridge** 上的 `params` **不支持**；见 [`09-FUNCTION.md`](./09-FUNCTION)。

---

## 8. `zlua.to_bytes` / `zlua.to_table`

由 [`../05-LIB.md`](../05-LIB) 提供的 **szarray 辅助转换**（不改变默认 Pop/Push 规则，仅便利 API）。

### 8.1 `zlua.to_bytes`

```lua
zlua.to_bytes(szarray) → string
```

| 约束 | 说明 |
|------|------|
| 输入 | **仅** szarray userdata（**不支持** mdarray） |
| 元素类型 | **blittable**：基元，或 **不含引用类型字段** 的 struct（如 `float[]`、`Vector3[]`） |
| 实现 | 将数组实际内存当作 C 的 byte 缓冲区，长度为数据总字节数，**整段拷贝** 为 Lua 二进制 string（可含 `\0`）；字节序 / struct 布局与运行时托管布局一致 |
| 非法 | 非 szarray、元素含引用类型字段 → `luaL_error` |

```lua
local bytes = zlua.to_bytes(int_arr)      -- #bytes == #int_arr * 4
local fbytes = zlua.to_bytes(float_arr)  -- float[] 亦可
local vbytes = zlua.to_bytes(vec3_arr)   -- Vector3[]（blittable）亦可
```

**Native：** `__zlua_to_bytes`

细则亦见 [`../05-LIB.md`](../05-LIB) §8.3。

### 8.2 `zlua.to_table`

```lua
zlua.to_table(szarray) → table
```

| 约束 | 说明 |
|------|------|
| 输入 | **仅** szarray userdata |
| 元素类型 | **无限制**；每个元素按默认 marshal 转为 Lua 值 |
| 输出 | 等长表；键 **`1 .. n`**，`n = #szarray` |
| 下标 | **`t[i]` ↔ C# `arr[i - 1]`**（Lua 1 基 ↔ C# 0 基） |

```lua
local t = zlua.to_table(obj_arr)
-- t[1] 对应 arr[0]
```

引用类型元素 → userdata；struct 元素 → 对应 struct marshal 形态。

**Native：** `__zlua_to_table`

### 8.3 与 Pop table 路径的区别

| | **`zlua.to_table`** | **Lua→C# Pop table** |
|--|---------------------|----------------------|
| 方向 | 数组 userdata → Lua 表（只读转换） | Lua 表 → 构造 **`T[n]`** 传入 C# |
| 用途 | 脚本遍历、序列化 | 方法形参 / 返回值 |
| 约束 | 输入须为 szarray userdata | 须满足 §3.1 数组形态约束 |

---

## 9. 数组类型构造（类型表）

Lua 侧 **不** 经 `CSharp[...]` 直接解析 `int[]`；须：

```lua
local int_arr_type = zlua.make_szarray_type(zlua.types.int32)
local md_type = zlua.make_mdarray_type(zlua.types.int32, 2)
```

实例创建：

```lua
local arr = zlua.new_szarray_by_element_type(zlua.types.int32, 10)
local matrix = zlua.new_mdarray_by_spec(zlua.types.int32, { 0, 0 }, { 2, 3 })
```

详见 [`../02-TYPE-SYSTEM.md`](../02-TYPE-SYSTEM) 与 [`../05-LIB.md`](../05-LIB)。

---

## 10. `ref` / `out` / `in` 数组形参

| 路径 | 规则 |
|------|------|
| **Lua → C#** | 见 [`03-BYREF.md`](./03-BYREF)、[`06-CLASS.md`](./06-CLASS) §5：共享引用；**无 rebind** |
| **C# → Lua**（GetFunction 取得的 delegate / delegate bridge） | 默认 **OpaqueValue**；见 [`04-OPAQUE.md`](./04-OPAQUE) |

对 **可变数组** 原地修改（`ref int[]` 改元素）→ Lua 侧 **可见**；`ref arr = otherArray` **不回写** Lua 变量。

---

## 11. Mono / Il2Cpp 一致性

| 项 | 要求 |
|----|------|
| szarray Push / Pop | ByObjUserData；table 规则一致 |
| mdarray Pop | 仅 ByObjUserData |
| `to_bytes` / `to_table` | 语义一致 |
| `Bytes` 标注 | 两平台一致 |
| 错误消息 | 一致或等价 |

---

## 12. 相关文档

| 文档 | 内容 |
|------|------|
| [`06-CLASS.md`](./06-CLASS) | ByObjUserData、门面、ref 引用类型 |
| [`02-MARSHAL-AS.md`](./02-MARSHAL-AS) | `Bytes`、`ParamsTable`、`OpaqueValue` |
| [`03-BYREF.md`](./03-BYREF) | `ref` / `out` / `in` |
| [`../02-TYPE-SYSTEM.md`](../02-TYPE-SYSTEM) | 数组类型表、`get`/`set`、`#` |
| [`../05-LIB.md`](../05-LIB) | `make_szarray_type`、`to_bytes`、`to_table` |
