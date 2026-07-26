---
sidebar_position: 16
title: "指针与不支持类型"
---

# 指针与不支持类型

> **规范性：** 非托管指针、函数指针、以及 v1 默认不支持或受限的 CLR 形态之 Marshal 规则。  
> **相关：** 默认矩阵 → [`01-OVERVIEW.md`](/docs/spec/marshal/01-OVERVIEW/)；`IntPtr` 整型规则 → [`01-OVERVIEW.md`](/docs/spec/marshal/01-OVERVIEW/)；OpaqueValue 对比 → [`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/)；Delegate 对比 → [`09-FUNCTION.md`](/docs/spec/marshal/09-FUNCTION/)；`ref struct` → [`05-STRUCT.md`](/docs/spec/marshal/05-STRUCT/)、[`../05-LIB.md`](/docs/spec/05-LIB/)。

**平台原则：** Mono 与 Il2Cpp 的 **Lua 可见语义一致**。

---

## 1. 与 `IntPtr` / `UIntPtr` 的区分

§1 总览中 **`IntPtr` / `UIntPtr` / `nint` / `nuint`** 走 **整型数值** Marshal（`ToInt64` / `new IntPtr`），**不是** 本节 Pointer。

| 类型 | Lua 默认形态 | 脚本可当作整数运算 |
|------|--------------|-------------------|
| **`IntPtr` / `UIntPtr` / `nint` / `nuint`** | integer / number | **可以**（按数值） |
| **`T*` / `void*` 等非托管指针** | **Pointer**（lightuserdata） | **不可以**（仅透传） |
| **函数指针** `delegate*<…>` | **Pointer**（lightuserdata） | **不可以**（仅透传） |

---

## 2. 非托管指针（`T*`、`void*` 等）

**范围：** CLR 中 `Type.IsPointer == true` 且元素为 **非托管** 类型的指针，例如 `int*`、`byte*`、`void*`、`MyStruct*`（`MyStruct` 为 unmanaged struct）。

**不包含** `IntPtr` / `UIntPtr`（见 §1）。

### 2.1 默认 Marshal

| 方向 | 默认形态 | 说明 |
|------|----------|------|
| **C# → Lua** | **Pointer**（**lightuserdata**） | Push 指针 **地址值**（`uintptr_t` / 平台指针宽度）；**无** metatable |
| **Lua → C#** | **Pointer**（**lightuserdata**） | Pop 时须为 Pointer 形态；按声明指针类型还原 |

### 2.2 Lua 侧能力（刻意受限）

| 允许 | 禁止 |
|------|------|
| 作为实参 **原样传递** 给下一个 C# 调用（同步链内透传） | **解引用**、读写指向内存 |
| 与 `nil` 区分（非 null 指针才有 Pointer） | `:` / `.` 成员访问、算术、`#`、`pairs` 等 |
| — | 写入全局 / 表 / upvalue 后在 **异步** 或 **跨 pcall** 使用（地址可能失效） |

**设计理由：** Lua 无法安全表达 C# 非托管指针的生命周期与别名；仅支持 **不透明令牌式透传**，供 native / 底层 API 衔接。

### 2.3 `[LuaMarshalAs]`

非托管指针允许 `Default` 与 **`OpaqueValue`**（仅 C#→Lua）。`UserData`、`Table` 等仍 **非法**（见 [`02-MARSHAL-AS.md`](/docs/spec/marshal/02-MARSHAL-AS/)）。`OpaqueValue` 与默认 Pointer lightuserdata 不同：走 Opaque 槽与 `get_opaquevalue` / `set_opaquevalue` 生命周期规则。

---

## 3. 函数指针（function pointer）

**范围：** CLR 中 `Type.IsFunctionPointer == true` 的类型，例如 C# 9+ 的 `delegate*<int, int>`、`delegate*<void>`。

### 3.1 默认 Marshal

| 方向 | 默认形态 | 说明 |
|------|----------|------|
| **C# → Lua** | **Pointer**（**lightuserdata**） | Push 函数入口 **地址**；**无** metatable |
| **Lua → C#** | **Pointer**（**lightuserdata**） | Pop 还原为对应 function pointer 类型 |

### 3.2 Lua 侧能力

与 §2 **相同**——**仅透传**，不能从 Lua 侧 **调用** 该地址。

### 3.3 `[LuaMarshalAs]`

与 §2.3 相同：允许 `Default` 与 **`OpaqueValue`**（仅 C#→Lua）。

### 3.4 与 `Delegate` 对比

| 类型 | Lua 默认形态 | Lua 侧可调用 |
|------|--------------|--------------|
| **`Action` / `Func<…>` 等 Delegate** | DelegateUserData 或 Lua function | **可以**（见 [`09-FUNCTION.md`](/docs/spec/marshal/09-FUNCTION/)） |
| **`delegate*<…>` 函数指针** | Pointer（lightuserdata） | **不可以** |

---

## 4. `System.TypedReference`

`TypedReference` **仅** 以 **OpaqueValue** 形态在 C# ↔ Lua 之间传递；**默认即为 OpaqueValue**，无需再标 `[LuaMarshalAs(OpaqueValue)]`。其它 marshal 形态（UserData / Table / integer 等）**均不支持**。

| 方向 | 规则 |
|------|------|
| **C# → Lua** | **默认** Push **OpaqueValue**（[04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/)）；脚本经 `get_opaquevalue` / `set_opaquevalue` 读写 |
| **Lua → C#** | **仅** 接受兼容的 **OpaqueValue** handle（类型校验后绑定地址）；其它 Lua 形态 → 错误 |
| **其它 `[LuaMarshalAs]`** | **非法**（回退或绑定期拒绝，见 [`02-MARSHAL-AS.md`](/docs/spec/marshal/02-MARSHAL-AS/)） |

**原因：** `TypedReference` 绑定受控栈上的类型化槽位，无法稳定映射为普通 Lua 值或 userdata；OpaqueValue 仅暴露当前调用期内的槽地址，与其语义匹配。

---

## 5. 其他不支持或受限类型

下列类型在 [`01-OVERVIEW.md`](/docs/spec/marshal/01-OVERVIEW/) 总览中已简要列出；此处集中说明。

### 5.1 `decimal`

| 方向 | 规则 |
|------|------|
| **默认** | **暂不支持** |
| **`[OpaqueValue]`（C#→Lua）** | **合法** |
| Pop/Push（Default） | 未纳入 v1 默认路径 |

### 5.2 `ref struct`（`Span<T>`、`ReadOnlySpan<T>` 等）

| 方向 | 规则 |
|------|------|
| **by-val 形参** | **不能** 作为普通默认 marshal |
| 受控路径 | 仅 `ref` StructUserData / [`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/) OpaqueValue 等 |

详见 [`05-STRUCT.md`](/docs/spec/marshal/05-STRUCT/)、[`../05-LIB.md`](/docs/spec/05-LIB/)。

### 5.3 `Nullable<T>`

| 方向 | 规则 |
|------|------|
| 有值 | 同 `T` 的 marshal |
| **`null`** | **`nil`** |
| `T` 为值类型 | Pop 接受 `nil` |

见 [`01-OVERVIEW.md`](/docs/spec/marshal/01-OVERVIEW/)、[`../02-TYPE-SYSTEM.md`](/docs/spec/02-TYPE-SYSTEM/) §Nullable。

### 5.4 `dynamic`

编译期按 **`object`** 处理；无独立 Lua 形态。

### 5.5 开放泛型形参

如 `void M<T>(T x)` 且 `T` 未实例化：由 **调用时类型实参** 决定 marshal；见 [`../02-TYPE-SYSTEM.md`](/docs/spec/02-TYPE-SYSTEM/)。

---

## 6. 注册 / 暴露阶段应拒绝的签名

以下属于 **签名非法**（非 marshal 规则细节）：

| 条件 | 行为 |
|------|------|
| **ref struct by-val** 形参组合 | **拒绝** |
| 无法解析的 **byref 修饰符** 组合 | **拒绝** |

**允许：** **GetFunction 取得的 delegate 调用**与 **delegate bridge** 上的 `ref`/`out`/`in`（C#→Lua 见 [`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/)；Lua→C# 见 [`03-BYREF.md`](/docs/spec/marshal/03-BYREF/)）。

---

## 7. Pointer Pop 细则

| 项 | 规则 |
|----|------|
| 接受形态 | **仅** Pointer lightuserdata |
| **不** 接受 | integer / number、full userdata、OpaqueValue handle 的隐式互转 |
| **`null` 指针** | C#→Lua：按实现 Push Pointer 或 `nil`（须两平台一致）；Lua→C#：`nil` 是否对应 null 指针以实现文档为准 |
| 错误 | 类型不匹配 → `luaL_error` / 等价异常 |

---

## 8. 三种 lightuserdata 对比

| 种类 | 用途 | metatable | 脚本读写 |
|------|------|-----------|----------|
| **Pointer**（§2、§3） | 非托管指针 / 函数指针透传 | **无** | **不可**解引用 |
| **OpaqueValue**（[`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/)） | C# 栈帧参数槽 handle | **无** | 经 `get_opaquevalue` / `set_opaquevalue` |
| **（非 lightuserdata）** ClassUserData 等 | 托管对象 | **有** IMT | `:` / `.` 成员访问 |

---

## 9. Mono / Il2Cpp 一致性

| 项 | 要求 |
|----|------|
| Pointer / function pointer Push | lightuserdata，地址宽度 = 平台指针 |
| Pointer Pop | 仅接受 Pointer；不与 integer / full userdata 隐式互转 |
| TypedReference | **仅** OpaqueValue（默认即此）；语义一致 |
| `decimal` / `ref struct` by-val | 一致的不支持或受限行为 |
| 错误消息 | 一致或等价 |

---

## 10. 相关文档

| 文档 | 内容 |
|------|------|
| [`01-OVERVIEW.md`](/docs/spec/marshal/01-OVERVIEW/) | 默认矩阵、`IntPtr` |
| [`02-MARSHAL-AS.md`](/docs/spec/marshal/02-MARSHAL-AS/) | 指针类型合法标注集合 |
| [`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/) | OpaqueValue vs Pointer |
| [`09-FUNCTION.md`](/docs/spec/marshal/09-FUNCTION/) | Delegate vs 函数指针 |
| [`05-STRUCT.md`](/docs/spec/marshal/05-STRUCT/) | `ref struct` |
| [`../02-TYPE-SYSTEM.md`](/docs/spec/02-TYPE-SYSTEM/) | Nullable、特殊类型族 |
