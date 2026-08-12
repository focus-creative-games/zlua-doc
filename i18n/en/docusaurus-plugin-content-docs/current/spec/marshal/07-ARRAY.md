---
sidebar_position: 13
title: "Array Marshal"
---

# Array Marshal

> **Normative:** Marshal rules for one-dimensional vector arrays (szarray), multi-dimensional arrays (mdarray), and `byte[]` between Lua and C#.
> **Related:** Type tables, creation, `#`, `get`/`set` → [`../02-TYPE-SYSTEM.md`](/docs/spec/02-TYPE-SYSTEM/) §Arrays; `zlua.to_bytes` / `to_table` → [`../05-LIB.md`](/docs/spec/05-LIB/); class ByObj basics → [`06-CLASS.md`](/docs/spec/marshal/06-CLASS/); `[LuaMarshalAs]` → [`02-MARSHAL-AS.md`](/docs/spec/marshal/02-MARSHAL-AS/).

**Platform principle:** Mono and Il2Cpp share the same **Lua-visible semantics**; array instances are **ByObjUserData** (reference types on ObjectRegistry / GCHandle paths).

## 1. Default Marshal matrix

Without `[LuaMarshalAs]`:

| C# type | C# → Lua | Lua → C# | Notes |
|---------|----------|----------|-------|
| **`T[]` (szarray)** | **ByObjUserData** | **ByObjUserData** **or** **array-shaped Lua table** | See §2, §3 |
| **`T[,…]` (mdarray)** | **ByObjUserData** | **Only** **ByObjUserData** | Does **not** accept table |
| **`byte[]`** | Same as szarray | Same as szarray | Unless `[LuaMarshalAs(Bytes)]` → ↔ Lua **string** (§6) |

Array instances are always Push'd as **ByObjUserData** (`ObjectUserData` + array ByObj instance metatable; payload is `Il2CppArray*` / managed array reference). Scripts access via `get` / `set`, `#arr`, `GetValue` / `SetValue`, etc.; see [`../02-TYPE-SYSTEM.md`](/docs/spec/02-TYPE-SYSTEM/).

## 2. C# → Lua

| Item | Rules |
|------|-------|
| Shape | **ByObjUserData** (full userdata + array IMT) |
| **`null`** | **`nil`** |
| Element Push | Default marshal of element type `T` (primitives → integer/number; references → userdata; enum → integer/number) |
| **`[LuaMarshalAs(Bytes)]` on `byte[]`** | Push Lua **string** (raw octet sequence, not UTF-8 text semantics) |
| **`[LuaMarshalAs(OpaqueValue)]`** | Push **OpaqueValue** (C#→Lua only); see [`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/) |
| **`params T[]` return / parameter (C#→Lua)** | Same as szarray: Push **ByObjUserData** (does **not** default Push table) |

## 3. Lua → C# (szarray)

Accept **one of** the following (plus `nil`):

| Argument shape | Pop behavior |
|----------------|--------------|
| **ByObjUserData** | Bound type must match target `T[]` (or element types compatible); pass array reference |
| **Lua table (array shape)** | Keys **`1`…`n`** contiguous integers, **no holes**; Pop each element as `T`, construct **`T[n]`** |
| **`nil`** | Reference-type array → C# **`null`** |

### 3.1 Table shape constraints

Same ordered-table rules as [`02-MARSHAL-AS.md`](/docs/spec/marshal/02-MARSHAL-AS/):

| Accept | Reject |
|--------|--------|
| `{ v1, v2, … }` with contiguous keys `1..n` | **Sparse table** |
| Empty `{}` → **`T[0]`** (zero-length) | **String-key** table |
| | **0-based** pseudo-array (v1 **not** compatible) |
| | Non-integer keys |

When Popping elements, use default marshal of **`T`** (including enum integer, nested szarray table or userdata, etc.).

### 3.2 Examples

```lua
-- ByObjUserData
CS.Demo.Process(arr)

-- table → T[n]
CS.Demo.Process({ 1, 2, 3 })
CS.Demo.Process({})          -- T[0]

-- null
CS.Demo.Process(nil)
```

## 4. Lua → C# (mdarray)

| Argument | Pop behavior |
|----------|--------------|
| **ByObjUserData** | Bound type must match target mdarray |
| **`nil`** | **`null`** |
| **Lua table** | **Not accepted** |
| Other | **`luaL_error`** |

`[LuaMarshalAs]` does **not** make table acceptable (`UserData` equals default; `OpaqueValue` is C#→Lua only).

## 5. Array element R/W (vs Marshal)

The array **instance** is ByObjUserData; **element** R/W uses element-type marshal, not whole-array Pop/Push:

| API | Notes |
|-----|-------|
| **`arr:get(i1, …)`** / **`arr:set(i1, …, value)`** | Indices are **C# per-dimension indices** (szarray default 0-based); return/accept **Lua shape of element type `T`** |
| **`GetValue` / `SetValue`** | Still available; `GetValue` returns **`object` (boxed)** |
| **`#arr`** | szarray → `Length`; mdarray → product of dimension lengths |

Details: [`../02-TYPE-SYSTEM.md`](/docs/spec/02-TYPE-SYSTEM/) array chapter.

> **Index difference vs `zlua.to_table`:** `to_table` produces a **1-based** Lua table (`t[i]` ↔ `arr[i-1]`); `get`/`set` use **C# indices**.

## 6. `byte[]` and `[LuaMarshalAs(Bytes)]`

| Config | C# ↔ Lua |
|--------|----------|
| **Default** | Same as **`T[]`** szarray (ByObjUserData; Lua→C# may also use table) |
| **`[LuaMarshalAs(Bytes)]`** | **Force** C# **`byte[]`** ↔ Lua **`string`** (octet sequence) |

With `Bytes`:

| Direction | Rules |
|-----------|-------|
| **C# → Lua** | Push Lua **string** |
| **Lua → C#** | Pop **must be string**; does **not** accept ByObjUserData / table |

If annotated on a **`string`** parameter/return, use the dual **`byte[]` ↔ string** rules (resolved by declared type).

## 7. `params T[]` parameters

`params T[]` Marshal matches §1 szarray (ByObjUserData or table); differences are Lua call shape and empty/null semantics. Details: [`02-MARSHAL-AS.md`](/docs/spec/marshal/02-MARSHAL-AS/) §7.

Summary:

| Passed | C# receives |
|--------|-------------|
| ByObjUserData | That array reference |
| table `{}` | **`T[0]`** |
| table `{ … }` | **`T[n]`** built from elements |
| **`nil`** | **`null`** (**not** empty array) |

Lua does **not** support C#-style multi-slot implicit collection (`Sum(1, 2, 3)` is **illegal**); a **single** argument must occupy the `params` slot. **No** dedicated `LuaMarshalType` (historical `ParamsTable` removed).

`params` on **GetFunction-obtained delegate calls / delegate bridges** is **unsupported**; see [`09-FUNCTION.md`](/docs/spec/marshal/09-FUNCTION/).

## 8. `zlua.to_bytes` / `zlua.to_table`

szarray helpers from [`../05-LIB.md`](/docs/spec/05-LIB/) (do not change default Pop/Push; convenience only).

### 8.1 `zlua.to_bytes`

```lua
zlua.to_bytes(szarray) → string
```

| Constraint | Notes |
|------------|-------|
| Input | **Only** szarray userdata (**not** mdarray) |
| Element type | **blittable**: primitives, or structs **without** reference-type fields (e.g. `float[]`, `Vector3[]`) |
| Implementation | Treat array memory as a C byte buffer of total data bytes; **whole-buffer copy** to a Lua binary string (may contain `\0`); endianness / struct layout matches runtime managed layout |
| Illegal | Non-szarray, or elements with reference fields → `luaL_error` |

```lua
local bytes = zlua.to_bytes(int_arr)      -- #bytes == #int_arr * 4
local fbytes = zlua.to_bytes(float_arr)  -- float[] OK
local vbytes = zlua.to_bytes(vec3_arr)   -- Vector3[] (blittable) OK
```

**Native:** `__zlua_to_bytes`

Also: [`../05-LIB.md`](/docs/spec/05-LIB/) §8.3.

### 8.2 `zlua.to_table`

```lua
zlua.to_table(szarray) → table
```

| Constraint | Notes |
|------------|-------|
| Input | **Only** szarray userdata |
| Element type | **No restriction**; each element converts with default marshal |
| Output | Same-length table; keys **`1 .. n`**, `n = #szarray` |
| Indexing | **`t[i]` ↔ C# `arr[i - 1]`** (Lua 1-based ↔ C# 0-based) |

```lua
local t = zlua.to_table(obj_arr)
-- t[1] corresponds to arr[0]
```

Reference elements → userdata; struct elements → corresponding struct marshal shape.

**Native:** `__zlua_to_table`

### 8.3 Difference from Pop table path

| | **`zlua.to_table`** | **Lua→C# Pop table** |
|--|---------------------|----------------------|
| Direction | Array userdata → Lua table (read-only conversion) | Lua table → construct **`T[n]`** into C# |
| Use | Script iteration, serialization | Method parameters / returns |
| Constraints | Input must be szarray userdata | Must satisfy §3.1 array shape |

## 9. Array type construction (type tables)

Lua does **not** parse `int[]` directly via `CSharp[...]`; use:

```lua
local int_arr_type = zlua.make_szarray_type(zlua.types.int32)
local md_type = zlua.make_mdarray_type(zlua.types.int32, 2)
```

Instance creation:

```lua
local arr = zlua.new_szarray_by_element_type(zlua.types.int32, 10)
local matrix = zlua.new_mdarray_by_spec(zlua.types.int32, { 0, 0 }, { 2, 3 })
```

Details: [`../02-TYPE-SYSTEM.md`](/docs/spec/02-TYPE-SYSTEM/) and [`../05-LIB.md`](/docs/spec/05-LIB/).

## 10. `ref` / `out` / `in` array parameters

| Path | Rules |
|------|-------|
| **Lua → C#** | See [`03-BYREF.md`](/docs/spec/marshal/03-BYREF/), [`06-CLASS.md`](/docs/spec/marshal/06-CLASS/) §5: shared reference; **no rebind** |
| **C# → Lua** (GetFunction-obtained delegate / delegate bridge) | Default **OpaqueValue**; see [`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/) |

In-place mutation of a **mutable array** (`ref int[]` changing elements) → **visible** on Lua; `ref arr = otherArray` does **not** write back to the Lua variable.

## 11. Mono / Il2Cpp consistency

| Item | Requirement |
|------|-------------|
| szarray Push / Pop | ByObjUserData; table rules match |
| mdarray Pop | Only ByObjUserData |
| `to_bytes` / `to_table` | Semantics match |
| `Bytes` annotation | Same on both platforms |
| Error messages | Same or equivalent |

## 12. Related docs

| Doc | Contents |
|-----|----------|
| [`06-CLASS.md`](/docs/spec/marshal/06-CLASS/) | ByObjUserData, façade, ref reference types |
| [`02-MARSHAL-AS.md`](/docs/spec/marshal/02-MARSHAL-AS/) | `Bytes`, `OpaqueValue`, `params` (§7) |
| [`03-BYREF.md`](/docs/spec/marshal/03-BYREF/) | `ref` / `out` / `in` |
| [`../02-TYPE-SYSTEM.md`](/docs/spec/02-TYPE-SYSTEM/) | Array type tables, `get`/`set`, `#` |
| [`../05-LIB.md`](/docs/spec/05-LIB/) | `make_szarray_type`, `to_bytes`, `to_table` |
