---
sidebar_position: 4
title: Marshal 速查表
description: C# 类型默认 Marshal 规则与 LuaMarshalAs 覆盖速查。
---

# Marshal 速查表

权威全文：[Marshal 总览](../spec/marshal/01-OVERVIEW)、[LuaMarshalAs](../spec/marshal/02-MARSHAL-AS)。

**形态：** ClassUserData、ByObjUserData、ByValUserData 为 full userdata；**OpaqueValue**、非托管 Pointer 为 lightuserdata。

## 默认规则（摘要）

| C# 类型 | C# → Lua | Lua → C# |
|---------|----------|----------|
| 基元 / bool | number/boolean | 同左 |
| `string` | string | string |
| `byte[]` | ByObjUserData | ByObj / table；`[Bytes]` → string |
| `class` | ClassUserData | ClassUserData / nil |
| `T[]` | ByObjUserData | ByObj / table |
| mdarray | ByObjUserData | **仅** ByObj（不接受 table） |
| `enum` | integer/number | integer 或 boxed |
| `struct` | 见 ByVal / ByObj / Opaque | 见 STRUCT 规范 |
| `Delegate` | DelegateUserData | function / userdata |
| `ref`/`out`/`in`（C#→Lua） | **OpaqueValue** | — |

## `[LuaMarshalAs]`（常用）

| LuaMarshalType | 效果 |
|----------------|------|
| Default | 上表 |
| UserData | 强制 full userdata |
| Bytes | `byte[]` ↔ Lua string |
| OpaqueLightUserData | C#→Lua opaque handle |

## 相关文档

- [LuaMarshalAs 参考](./csharp/lua-marshal-as)
- [BYREF](../spec/marshal/03-BYREF)
- [OPAQUE](../spec/marshal/04-OPAQUE)
- [STRUCT](../spec/marshal/05-STRUCT)
