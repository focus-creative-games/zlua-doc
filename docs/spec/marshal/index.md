---
sidebar_position: 17
title: "Marshal 规范（`spec/marshal/`）"
---

# Marshal 规范（`spec/marshal/`）

> **规范性：** C# ↔ Lua 值在栈上的形态与转换规则。  
> **实现：** → [../../impl/marshal/](../../impl/marshal/)。

## 本目录

| 文件 | 内容 |
|------|------|
| [01-OVERVIEW.md](./01-OVERVIEW) | 默认 Marshal 矩阵、integer/number、数组摘要、引用门面摘要 |
| [02-MARSHAL-AS.md](./02-MARSHAL-AS) | `[LuaMarshalAs]`、`LuaMarshalType`、合法集合、Table/Unpacked/Params/Bytes/UserData/Opaque |
| [03-BYREF.md](./03-BYREF) | `ref` / `in` / `out`（C#→Lua Opaque；Lua→C#：Opaque/ByVal 直传地址，其余临时槽） |
| [04-OPAQUE.md](./04-OPAQUE) | OpaqueValue、`get_opaquevalue` / `set_opaquevalue`、生命周期、回传分流 |
| [05-STRUCT.md](./05-STRUCT) | struct ByVal / ByObj / Handle、`box`/`unbox` |
| [06-CLASS.md](./06-CLASS) | class / interface / 声明类型门面 |
| [07-ARRAY.md](./07-ARRAY) | szarray / mdarray / `Bytes` |
| [08-ENUM.md](./08-ENUM) | 默认 integer + `zlua.box` |
| [09-FUNCTION.md](./09-FUNCTION) | Delegate ↔ Lua function |
| [10-POINTER.md](./10-POINTER) | `T*`、函数指针、不支持类型 |

## 阅读顺序

1. **[01-OVERVIEW.md](./01-OVERVIEW)** — 默认行为总表  
2. **[02-MARSHAL-AS.md](./02-MARSHAL-AS)** — 何时覆盖默认、如何配置 Table/Unpacked/Params  
3. **按类型深入：** [05-STRUCT](./05-STRUCT) / [06-CLASS](./06-CLASS) / [07-ARRAY](./07-ARRAY) / [08-ENUM](./08-ENUM) / [09-FUNCTION](./09-FUNCTION)  
4. **双向 byref 分叉：** Lua→C# → [03-BYREF.md](./03-BYREF)；C#→Lua → [04-OPAQUE.md](./04-OPAQUE)

## 交叉引用

| 主题 | 其它 spec |
|------|-----------|
| `CSharp` 类型表、构造入口 | [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM) |
| 重载与实参匹配 | [../04-METHOD-OVERLOAD.md](../04-METHOD-OVERLOAD) |
| `zlua.box` / `unbox` / `cast` / `get_opaquevalue` / `set_opaquevalue` | [../05-LIB.md](../05-LIB) |
| 元表与成员索引（非 Marshal） | [../metatable/](../metatable/) |

## 平台原则

- **Mono（Editor）与 Il2Cpp（Player）的 Lua 可见 Marshal 语义一致**；差异仅在 `impl/` 层。
- **无 Event 专用支持**；使用 `add_*` / `remove_*` 普通方法（见 [../../README.md](../../intro)）。
