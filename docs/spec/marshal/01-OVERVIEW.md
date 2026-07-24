---
sidebar_position: 7
title: "Marshal 总览 — 默认规则矩阵"
---

# Marshal 总览 — 默认规则矩阵

> **规范性：** 未标注 `[LuaMarshalAs]`（或标注为 `LuaMarshalType.Default`）时，各 CLR 类型在 **C# ↔ Lua** 双向调用中的默认 Marshal。  
> **覆盖：** 参数、返回值、字段、属性上的 `[LuaMarshalAs]` 见 [02-MARSHAL-AS.md](./02-MARSHAL-AS)。  
> **实现：** → [../../impl/marshal/](../../impl/marshal/)。

## 1. 平台原则

- **Mono（Editor）与 Il2Cpp（Player）的 Lua 可见 Marshal 语义一致**；差异仅在实现层（零 GC、生成代码等），不改变脚本可观察行为。
- **函数 / delegate：** Lua 调用 C# 方法时，delegate 形参接受 Lua `function`，由桥接层隐式 marshal，详见 [09-FUNCTION.md](./09-FUNCTION)。
- **`[LuaInvoke]` / delegate bridge（C# → Lua）** 上 `ref`/`out`/`in` 的默认 Push 为 **OpaqueValue**，与 Lua→C# 路径不同，见 [03-BYREF.md](./03-BYREF)、[04-OPAQUE.md](./04-OPAQUE)。

## 2. 默认 Marshal 矩阵

| C# 类型 | C# → Lua | Lua → C# | 说明 |
|---------|----------|----------|------|
| `bool` | `boolean` | `boolean` | |
| `char` | **integer** / **number** | **integer** / **number** | 按 Unicode 码点（16 位） |
| `byte` | **integer** / **number** | **integer** / **number** | 见 §3 |
| `sbyte` | **integer** / **number** | **integer** / **number** | 见 §3 |
| `short` | **integer** / **number** | **integer** / **number** | 见 §3 |
| `ushort` | **integer** / **number** | **integer** / **number** | 见 §3 |
| `int` | **integer** / **number** | **integer** / **number** | 见 §3 |
| `uint` | **integer** / **number** | **integer** / **number** | 见 §3 |
| `long` | **integer** / **number** | **integer** / **number** | 见 §3 |
| `ulong` | **integer** / **number** | **integer** / **number** | 见 §3；须落在 Lua integer 可表示范围 |
| `float` | **number** | **number** | |
| `double` | **number** | **number** | |
| `IntPtr` | **integer** / **number** | **integer** / **number** | 指针 **数值**（`ToInt64` / `new IntPtr`）；与 [10-POINTER.md](./10-POINTER) 非托管指针 **不同** |
| `UIntPtr` | **integer** / **number** | **integer** / **number** | 同上 |
| `nint` / `nuint` | 同 `IntPtr` / `UIntPtr` | 同 `IntPtr` / `UIntPtr` | 本机整数别名 |
| `T*`（非托管指针） | **Pointer**（lightuserdata） | **Pointer**（lightuserdata） | 仅透传；见 [10-POINTER.md](./10-POINTER) |
| 函数指针（如 `delegate*<int,int>`） | **Pointer**（lightuserdata） | **Pointer**（lightuserdata） | 仅透传；见 [10-POINTER.md](./10-POINTER) |
| `System.TypedReference` | **OpaqueValue** | **OpaqueValue** | **仅** OpaqueValue；默认即此，见 [10-POINTER.md](./10-POINTER)、[04-OPAQUE.md](./04-OPAQUE) |
| `string` | **string** | **string** | |
| `byte[]` | **ByObjUserData** | **ByObjUserData** 或 **table** | 与 `T[]` 相同（§4）；`[LuaMarshalAs(Bytes)]` 时改为 ↔ **string**，见 [02-MARSHAL-AS.md](./02-MARSHAL-AS) |
| `class` | **ClassUserData** | **ClassUserData** | 引用身份；`nil` ↔ `null`；**成员门面 = 声明类型**，见 [06-CLASS.md](./06-CLASS) |
| `T[]`（一维 / szarray） | **ByObjUserData** | **ByObjUserData** 或 **table** | 见 §4、[07-ARRAY.md](./07-ARRAY) |
| `T[,]` 等多维（mdarray） | **ByObjUserData** | **ByObjUserData** | 见 §4；**不**接受 Lua table |
| `enum` | **integer** / **number** | **integer** / **number** 或 **ByObjUserData**（boxed） | 默认 **不** 推 userdata；boxed 仅经 `zlua.box`；详见 [08-ENUM.md](./08-ENUM) |
| `struct` | **ByValUserData** 或 **OpaqueValue** | **StructUserData** 或 `Type(...)` 产物 | C#→Lua 常规路径见 [05-STRUCT.md](./05-STRUCT)；标注 `OpaqueValue` 或 **`ref`/`in`/`out`** 时为 OpaqueValue（[04-OPAQUE.md](./04-OPAQUE)）。Lua→C# 亦接受 `SMT.__call` 构造的 StructUserData。**不**默认接受 table / 多栈参数；须 `[LuaMarshalAs(Table \| UnpackedValues)]` + `FieldOrPropertyNames`（[02-MARSHAL-AS.md](./02-MARSHAL-AS)） |
| `Delegate` | **function** 或 **DelegateUserData** | **function** 或 **DelegateUserData** | C#→Lua：若 `target` 为 Lua 回调源则 Push **function**，否则 ByObjUserData；见 [09-FUNCTION.md](./09-FUNCTION) |
| `object` | **ClassUserData**（`System.Object` 门面） | **boolean** / **number** / **string** / **userdata** | **门面 = 声明类型 `object`**，即使运行时是 `string` 等也 **不** 改走特殊 Marshal；见 [06-CLASS.md](./06-CLASS) |
| `Nullable<T>` | 同 `T` 或 `nil` | 同 `T` 或 `nil` | `T` 为值类型时 `nil` ↔ `null` |
| `interface` | **ClassUserData**（ByObj） | **ClassUserData** | 与 class 相同：**门面 = 接口声明类型**；亦可 `[LuaMarshalAs(Table \| UnpackedValues)]`（见 [02-MARSHAL-AS.md](./02-MARSHAL-AS)、[06-CLASS.md](./06-CLASS)） |
| `decimal` | **暂不支持**（默认） | **暂不支持**（默认） | v1 默认路径未纳入 |
| `ref struct`（如 `Span<T>`） | 见 [05-STRUCT.md](./05-STRUCT)、[../05-LIB.md](../05-LIB) | 同左 | 不能作为普通 by-val 形参默认传递 |
| `void`（返回值） | （无） | — | |
| `null` / `nil` | `nil` | `nil` | 仅 **引用类型**、**Nullable**、delegate 等可空形态 |

### 2.1 UserData 形态说明

上表中的 **ClassUserData**、数组 **ByObjUserData**（szarray / mdarray 实例）、**StructUserData**、boxed enum（ByObjUserData）、**DelegateUserData** 均为带类型元表的 **full userdata**（`lua_newuserdata` + metatable），脚本侧经 `:` / `.` 访问成员。

与下列形态 **不同**：

| 形态 | 特征 | 文档 |
|------|------|------|
| **OpaqueValue** | lightuserdata，**无** metatable | [04-OPAQUE.md](./04-OPAQUE) |
| **Pointer**（非托管指针 / 函数指针） | lightuserdata，**无** metatable，仅透传 | [10-POINTER.md](./10-POINTER) |

## 3. integer 与 number

- **Lua 5.4+**：整型基元、`char`、枚举底层整型、`IntPtr` / `UIntPtr` 数值优先使用 **integer**（`lua_pushinteger` / `lua_isinteger`）。
- **不支持 integer 的 Lua 版本**：退化为 **number**，须为整数值（无小数部分）。
- Il2Cpp Codegen 与 Mono 反射路径的 **可见语义一致**；仅实现层 API 不同。

## 4. 数组（szarray / mdarray）

| C# 类型 | C# → Lua | Lua → C# |
|---------|----------|----------|
| **`T[]`（szarray）** | **ByObjUserData**（数组实例 userdata） | **ByObjUserData**，**或** **数组形态 Lua table**（见下） |
| **`T[,…]`（mdarray）** | **ByObjUserData** | **仅** **ByObjUserData** |
| **`byte[]`** | 同 szarray（除非 `[LuaMarshalAs(Bytes)]`） | 同 szarray |

### 4.1 C# → Lua

数组实例统一 Push 为 **ByObjUserData**（`ObjectUserData` + 数组 ByObj 实例元表；载荷为托管数组引用）。脚本侧经 `GetValue` / `SetValue`、`#arr`（szarray）等访问，见 [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM)、[07-ARRAY.md](./07-ARRAY)。

### 4.2 Lua → C#（szarray）

接受下列 **二选一**：

| 实参形态 | Pop 行为 |
|----------|----------|
| **ByObjUserData** | 绑定类型须与目标 `T[]` 一致（或元素类型兼容）；读数组引用传入形参 |
| **Lua table（数组形态）** | 键 **`1`…`n`** 连续整数、**无空洞**；按顺序 Pop 各元素为 `T`，构造 **`T[n]`** |
| **`nil`** | 引用类型数组 → C# **`null`** |

### 4.3 Lua → C#（mdarray）

**仅**接受 **ByObjUserData**；**不**接受 table。`null` 仍 **`nil` ↔ null**。

### 4.4 table 形态约束（szarray Pop）

与 [02-MARSHAL-AS.md](./02-MARSHAL-AS) 中顺序 table 规则相同：

- **不接受** 稀疏 table、字符串键 table、或 **`0`** 起标的伪数组（v1 **不**兼容）。

## 5. 引用类型门面（摘要）

对所有 **引用类型** 形参、返回值、字段/属性（`class` / `interface` / `object` / 数组 / delegate 等）：

| 概念 | 含义 |
|------|------|
| **Identity** | userdata 持有的托管对象引用（运行时实际实例） |
| **View / 门面** | userdata 挂接的 **IMT** 与成员可见性；**唯一来源 = 本次 Marshal 的声明类型** |

**规则摘要：**

1. **C# → Lua**：始终按 **声明类型** 选择默认 marshal 形态与 ByObj IMT；**不** 因运行时实际类型不同而改挂实际类型 mt，也 **不** 因此改走 `string` 等特殊 Marshal。
2. **Downcast**：仅 `zlua.cast(obj, targetType)`（见 [../05-LIB.md](../05-LIB)）；要求目标类型可从当前门面类型赋值，返回 **新 userdata**（同 identity、新门面）。
3. **对象缓存**：键为 **`(identity, viewType)`**；同一实例可有多个视图 userdata。

完整规则见 [06-CLASS.md](./06-CLASS)。

## 6. 相关文档

| 主题 | 文档 |
|------|------|
| `[LuaMarshalAs]` 覆盖默认 | [02-MARSHAL-AS.md](./02-MARSHAL-AS) |
| `ref` / `in` / `out` | [03-BYREF.md](./03-BYREF) |
| OpaqueValue | [04-OPAQUE.md](./04-OPAQUE) |
| struct | [05-STRUCT.md](./05-STRUCT) |
| class / interface | [06-CLASS.md](./06-CLASS) |
| 数组 / `Bytes` | [07-ARRAY.md](./07-ARRAY) |
| 枚举 | [08-ENUM.md](./08-ENUM) |
| delegate / Lua function | [09-FUNCTION.md](./09-FUNCTION) |
| 指针 / 不支持类型 | [10-POINTER.md](./10-POINTER) |
| 重载与实参匹配 | [../04-METHOD-OVERLOAD.md](../04-METHOD-OVERLOAD) |
| `zlua.*` API | [../05-LIB.md](../05-LIB) |
