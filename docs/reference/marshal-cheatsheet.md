---
sidebar_position: 4
title: 编组速查表
description: C# 类型默认编组规则与 LuaMarshalAs 覆盖速查。
---

# 编组速查表

未标注 `[LuaMarshalAs]`（或 `LuaMarshalType.Default`）时的 **默认编组**。完整语义与边界见 [编组规范 §1](../spec/marshal/#1-默认-marshal-规则总览)。

**UserData 形态：** ClassUserData、ArrayUserData、StructUserData、enum userdata、DelegateUserData 均为 **full userdata**（带 metatable）。**OpaqueValue**、非托管 **Pointer** 为 **lightuserdata**（无 metatable）。

## 默认规则总表

| C# 类型 | C# → Lua | Lua → C# | 说明 |
|---------|----------|----------|------|
| `bool` | boolean | boolean | |
| `char` | integer / number | integer / number | Unicode 码点 |
| `byte` … `ulong` | integer / number | integer / number | Lua 5.4 优先 integer |
| `float` / `double` | number | number | |
| `IntPtr` / `UIntPtr` / `nint` / `nuint` | integer / number | integer / number | 指针 **数值** |
| `T*` / `void*` / 函数指针 | lightuserdata | lightuserdata | **透传**，见 [§7](../spec/marshal/) |
| `TypedReference` | 不支持 | 不支持 | |
| `string` | string | string | |
| `byte[]` | ArrayUserData | ArrayUserData | `[Bytes]` → string |
| `class` | ClassUserData | ClassUserData / nil | nil ↔ null |
| `T[]` / 多维 | ArrayUserData | ArrayUserData | [Class 编组](../spec/marshal/class) |
| `enum` | integer / number | integer / number 或 enum userdata | 默认非 userdata |
| `struct` | OpaqueValue (lightuserdata) | StructUserData / table | C#→Lua 默认 StructHandle |
| `Delegate` | DelegateUserData | function / DelegateUserData | [Function 编组](../spec/marshal/function) |
| `object` | 按运行时类型 | bool/number/string/userdata | 多态 |
| `Nullable<T>` | T 或 nil | T 或 nil | T 为值类型 |
| `interface` | ClassUserData | ClassUserData | 同 class |
| `decimal` | 暂不支持 | 暂不支持 | |
| `ref struct` | 见 struct 规范 | 见 struct 规范 | 非普通 by-val |
| `void`（返回） | — | — | 无返回值 |
| `null` / `nil` | nil | nil | 引用类型、Nullable 等 |

### integer 与 number

Lua 5.4+ 整型基元优先 **integer**；否则退化为 **number**（须为整数值）。Mono 与 Il2Cpp **可见语义一致**。

## ref / out / in（Lua → C#）

| Lua 实参 | C# ref/out/in 行为 |
|----------|-------------------|
| **StructUserData**（`new_ref`、struct `_ctor` 等） | **真 ref**，C# 修改写回 |
| 裸 number / string / table 等 | **拷贝**到临时槽，**不写回** Lua local |

`[LuaInvoke]`、delegate bridge **不支持** ref/out。详见 [ref 指南](../guides/marshal-ref-out-in) 与 [编组规范 §3](../spec/marshal/#3-ref--out--inlua--c)。

## `[LuaMarshalAs]` 覆盖速查

| LuaMarshalType | 主要效果 | 典型场景 |
|----------------|----------|----------|
| **Default** | 上表默认 | — |
| **UserData** | 强制 full userdata | 基元/enum/string 需 boxed 形态 |
| **Bytes** | `byte[]` ↔ Lua string | 二进制协议、原始 octet |
| **OpaqueLightUserData** | C#→Lua lightuserdata 临时句柄 | 栈上 struct/object 槽；`to_user_data` 升级 |

各类型 **合法组合** 见 [LuaMarshalAs 参考](./csharp/lua-marshal-as) 与 [规范 §6.2](../spec/marshal/#62-各类型的合法-luamarshaltype-集合)。

## 分类型深入

| 类型 | 文档 |
|------|------|
| class / 数组 / 引用 | [Class 编组](../spec/marshal/class) |
| struct / enum userdata | [Struct 编组](../spec/marshal/struct) |
| Delegate / Lua function | [Function 编组](../spec/marshal/function) |
| 类型系统 / 枚举常量 | [类型系统规范](../spec/type-system-spec) |

## 相关文档

- [编组模型概览](../concepts/marshal-overview)
- [LuaMarshalAs](./csharp/lua-marshal-as)
- [enum / struct 指南](../guides/enums-and-structs)
