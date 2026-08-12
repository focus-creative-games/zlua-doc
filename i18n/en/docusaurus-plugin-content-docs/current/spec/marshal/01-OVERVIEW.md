---
sidebar_position: 7
title: "Marshal Overview — Default Rule Matrix"
---

# Marshal Overview — Default Rule Matrix

> **Normative:** Default Marshal for each CLR type in **C# ↔ Lua** bidirectional calls when `[LuaMarshalAs]` is absent (or set to `LuaMarshalType.Default`).
> **Overrides:** `[LuaMarshalAs]` on parameters, return values, fields, and properties — see [02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/).
> **Implementation:** → [../../impl/marshal/](/docs/impl/marshal/).

## 1. Platform principles

- **Mono (Editor) and Il2Cpp (Player) share the same Lua-visible Marshal semantics**; differences are implementation-only (zero GC, generated code, etc.) and do not change script-observable behavior.
- **Functions / delegates:** When Lua calls a C# method, a delegate parameter accepts a Lua `function`, marshaled implicitly by the bridge; see [09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/).
- **On GetFunction-obtained delegate calls / delegate bridges (C# → Lua)**, the default Push for `ref`/`out`/`in` is **OpaqueValue**, which differs from the Lua→C# path; see [03-BYREF.md](/docs/spec/marshal/03-BYREF/), [04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/).

## 2. Default Marshal matrix

| C# type | C# → Lua | Lua → C# | Notes |
|---------|----------|----------|-------|
| `bool` | `boolean` | `boolean` | |
| `char` | **integer** / **number** | **integer** / **number** | Unicode code point (16-bit) |
| `byte` | **integer** / **number** | **integer** / **number** | See §3 |
| `sbyte` | **integer** / **number** | **integer** / **number** | See §3 |
| `short` | **integer** / **number** | **integer** / **number** | See §3 |
| `ushort` | **integer** / **number** | **integer** / **number** | See §3 |
| `int` | **integer** / **number** | **integer** / **number** | See §3 |
| `uint` | **integer** / **number** | **integer** / **number** | See §3 |
| `long` | **integer** / **number** | **integer** / **number** | See §3 |
| `ulong` | **integer** / **number** | **integer** / **number** | See §3; must fit Lua integer range |
| `float` | **number** | **number** | |
| `double` | **number** | **number** | |
| `IntPtr` | **integer** / **number** | **integer** / **number** | Pointer **numeric value** (`ToInt64` / `new IntPtr`); **not** the unmanaged pointer in [10-POINTER.md](/docs/spec/marshal/10-POINTER/) |
| `UIntPtr` | **integer** / **number** | **integer** / **number** | Same |
| `nint` / `nuint` | Same as `IntPtr` / `UIntPtr` | Same as `IntPtr` / `UIntPtr` | Native integer aliases |
| `T*` (unmanaged pointer) | **Pointer** (lightuserdata) | **Pointer** (lightuserdata) | Pass-through only; see [10-POINTER.md](/docs/spec/marshal/10-POINTER/) |
| Function pointer (e.g. `delegate*<int,int>`) | **Pointer** (lightuserdata) | **Pointer** (lightuserdata) | Pass-through only; see [10-POINTER.md](/docs/spec/marshal/10-POINTER/) |
| `System.TypedReference` | **OpaqueValue** | **OpaqueValue** | **Only** OpaqueValue; default is this; see [10-POINTER.md](/docs/spec/marshal/10-POINTER/), [04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/) |
| `string` | **string** | **string** | |
| `byte[]` | **ByObjUserData** | **ByObjUserData** or **table** | Same as `T[]` (§4); with `[LuaMarshalAs(Bytes)]` ↔ **string**; see [02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/) |
| `class` | **ClassUserData** | **ClassUserData** | Reference identity; `nil` ↔ `null`; **member façade = declared type**; see [06-CLASS.md](/docs/spec/marshal/06-CLASS/) |
| `T[]` (1-D / szarray) | **ByObjUserData** | **ByObjUserData** or **table** | See §4, [07-ARRAY.md](/docs/spec/marshal/07-ARRAY/) |
| `T[,]` etc. (mdarray) | **ByObjUserData** | **ByObjUserData** | See §4; does **not** accept Lua table |
| `enum` | **integer** / **number** | **integer** / **number** or **ByObjUserData** (boxed) | Default does **not** push userdata; boxed only via `zlua.box`; see [08-ENUM.md](/docs/spec/marshal/08-ENUM/) |
| `struct` | **ByValUserData** or **OpaqueValue** | **StructUserData** or `Type(...)` product | C#→Lua normal path: [05-STRUCT.md](/docs/spec/marshal/05-STRUCT/); with `OpaqueValue` or **`ref`/`in`/`out`** → OpaqueValue ([04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/). Lua→C# also accepts StructUserData from `SMT.__call`. Does **not** accept table / multi-stack args by default; needs `[LuaMarshalAs(Table \| UnpackedValues)]` + `Members` ([02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/)) |
| `Delegate` | **function** or **DelegateUserData** | **function** or **DelegateUserData** | C#→Lua: if `target` is a Lua callback source, Push **function**, else ByObjUserData; see [09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/) |
| `object` | **ClassUserData** (`System.Object` façade) | **boolean** / **number** / **string** / **userdata** | **Façade = declared type `object`**; even if runtime is `string`, do **not** use special Marshal; see [06-CLASS.md](/docs/spec/marshal/06-CLASS/) |
| `Nullable<T>` | Same as `T` or `nil` | Same as `T` or `nil` | When `T` is a value type, `nil` ↔ `null` |
| `interface` | **ClassUserData** (ByObj) | **ClassUserData** | Same as class: **façade = interface declared type**; may also use `[LuaMarshalAs(Table \| UnpackedValues)]` (see [02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/), [06-CLASS.md](/docs/spec/marshal/06-CLASS/)) |
| `decimal` | **Not supported** (default) | **Not supported** (default) | Not in v1 default path |
| `ref struct` (e.g. `Span<T>`) | See [05-STRUCT.md](/docs/spec/marshal/05-STRUCT/), [../05-LIB.md](/docs/spec/05-LIB/) | Same | Cannot be passed as ordinary by-val default |
| `void` (return) | (none) | — | |
| `null` / `nil` | `nil` | `nil` | Only **reference types**, **Nullable**, delegates, and other nullable forms |

### 2.1 UserData shapes

**ClassUserData**, array **ByObjUserData** (szarray / mdarray instances), **StructUserData**, boxed enum (ByObjUserData), and **DelegateUserData** in the table above are all **full userdata** with a typed metatable (`lua_newuserdata` + metatable). Scripts access members via `:` / `.`.

These differ from:

| Shape | Traits | Docs |
|-------|--------|------|
| **OpaqueValue** | lightuserdata, **no** metatable | [04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/) |
| **Pointer** (unmanaged / function pointer) | lightuserdata, **no** metatable, pass-through only | [10-POINTER.md](/docs/spec/marshal/10-POINTER/) |

## 3. integer and number

- **Lua 5.4+:** Integer primitives, `char`, enum underlying integers, and `IntPtr` / `UIntPtr` numeric values prefer **integer** (`lua_pushinteger` / `lua_isinteger`).
- **Lua versions without integer:** Fall back to **number**, which must be an integral value (no fractional part).
- Il2Cpp Codegen and Mono reflection paths share the same **visible semantics**; only implementation APIs differ.

## 4. Arrays (szarray / mdarray)

| C# type | C# → Lua | Lua → C# |
|---------|----------|----------|
| **`T[]` (szarray)** | **ByObjUserData** (array instance userdata) | **ByObjUserData**, **or** **array-shaped Lua table** (below) |
| **`T[,…]` (mdarray)** | **ByObjUserData** | **Only** **ByObjUserData** |
| **`byte[]`** | Same as szarray (unless `[LuaMarshalAs(Bytes)]`) | Same as szarray |

### 4.1 C# → Lua

Array instances are always Push'd as **ByObjUserData** (`ObjectUserData` + array ByObj instance metatable; payload is a managed array reference). Scripts access via `GetValue` / `SetValue`, `#arr` (szarray), etc.; see [../02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/), [07-ARRAY.md](/docs/spec/marshal/07-ARRAY/).

### 4.2 Lua → C# (szarray)

Accept **one of**:

| Argument shape | Pop behavior |
|----------------|--------------|
| **ByObjUserData** | Bound type must match target `T[]` (or element types compatible); pass array reference |
| **Lua table (array shape)** | Keys **`1`…`n`** contiguous integers, **no holes**; Pop each element as `T`, construct **`T[n]`** |
| **`nil`** | Reference-type array → C# **`null`** |

### 4.3 Lua → C# (mdarray)

**Only** accepts **ByObjUserData**; does **not** accept table. `null` remains **`nil` ↔ null**.

### 4.4 Table shape constraints (szarray Pop)

Same as ordered-table rules in [02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/):

- **Reject** sparse tables, string-key tables, or **0**-based pseudo-arrays (v1 is **not** compatible).

## 5. Reference-type façade (summary)

For all **reference type** parameters, return values, and fields/properties (`class` / `interface` / `object` / arrays / delegates, etc.):

| Concept | Meaning |
|---------|---------|
| **Identity** | Managed object reference held by userdata (runtime actual instance) |
| **View / façade** | **IMT** and member visibility attached to userdata; **sole source = declared type of this Marshal** |

**Rule summary:**

1. **C# → Lua:** Always choose default marshal shape and ByObj IMT by **declared type**; do **not** reattach the actual runtime type's mt, and do **not** switch to special Marshal such as `string` because of runtime type.
2. **Downcast:** Only `zlua.cast(obj, targetType)` (see [../05-LIB.md](/docs/spec/05-LIB/); target must be assignable from current façade type; returns **new userdata** (same identity, new façade).
3. **Object cache:** Key is **`(identity, viewType)`**; one instance may have multiple view userdata.

Full rules: [06-CLASS.md](/docs/spec/marshal/06-CLASS/).

## 6. Related docs

| Topic | Doc |
|-------|-----|
| `[LuaMarshalAs]` overrides | [02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/) |
| `ref` / `in` / `out` | [03-BYREF.md](/docs/spec/marshal/03-BYREF/) |
| OpaqueValue | [04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/) |
| struct | [05-STRUCT.md](/docs/spec/marshal/05-STRUCT/) |
| class / interface | [06-CLASS.md](/docs/spec/marshal/06-CLASS/) |
| Arrays / `Bytes` | [07-ARRAY.md](/docs/spec/marshal/07-ARRAY/) |
| Enum | [08-ENUM.md](/docs/spec/marshal/08-ENUM/) |
| delegate / Lua function | [09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/) |
| Pointers / unsupported types | [10-POINTER.md](/docs/spec/marshal/10-POINTER/) |
| Overloads and argument matching | [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) |
| `zlua.*` API | [../05-LIB.md](/docs/spec/05-LIB/) |
