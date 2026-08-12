---
sidebar_position: 5
title: "zlua standard library"
---

# 05 — `zlua` standard library

> Lua API of the global **`zlua`** table.
> Source: `Packages/com.code-philosophy.zlua/ZLua~/lualib/zlualib.lua`
> Native: `build-win64/.../libil2cpp/zlua/lvm/ZLuaLib.cpp` (`RegisterGlobals`)

At init, native registers `__zlua_*` global C functions, then `dostring`s `zlualib.lua` to wrap them as `zlua.*`.

**Related:** type access → [02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/); overloads → [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/); Marshal → [marshal/](/docs/spec/marshal/).

---

## 1. Responsibility boundary

| Layer | Role |
|-------|------|
| **`CSharp`** | Assembly / type lazy load; static members; `Type(...)` construction |
| **`zlua`** | Type construction helpers, opaque, boxing, arrays, delegates, method-alias registration |
| **Instance userdata** | Members via type metatables, **not** via `zlua` |

`zlua` does **not** replace `CSharp` for type access.

---

## 2. Loading

```lua
zlua = zlua or {}   -- zlualib.lua init
```

Il2Cpp: script embedded in `BuiltinScripts.inc`; Mono: Resources or equivalent path. **Content must stay in sync with `zlualib.lua`.**

---

## 3. Type arguments (`typeArg`)

| Form | Example |
|------|---------|
| `zlua.types.*` | `zlua.types.int32` → `"System.Int32"` |
| `CSharp` type table | `CSharp.mscorlib['System.Int32']` |
| Closed generic / array type table | Return of `zlua.make_generic_type(...)` / `zlua.make_szarray_type(...)` |
| `zlua.get_type_from_name` | Type table resolved by CLR type name (see §4.3) |
| **Type-name string** | Same as §4.3 `get_type_from_name(typeFullName)`’s **`name`** (mirrors `System.Type.GetType(string)`: simple name, AQN, generic, array, etc.). Any API that accepts `typeArg` resolves string args this way — **not** limited to mscorlib |

`zlua.typeof(typeTable)` accepts **any** ZLua type table (including closed generics and array type tables) and returns that type’s **`System.Type` reflection object** (Type class userdata on Lua), matching C# `typeof(T)`.

---

## 4. Type queries

### 4.1 `zlua.typeof`

```lua
zlua.typeof(typeTable) → System.Type   -- class userdata
```

| Parameter / return | Notes |
|--------------------|-------|
| `typeTable` | **Any** ZLua type table: from `CSharp`, or from `make_generic_type` / `make_*array_type` / `get_type_from_name`, etc. |
| **Return** | **`System.Type` instance** (reflection object) for that type, same kind as C# `typeof(...)` |

```lua
-- Equivalent to C#: typeof(int)
local intType = zlua.typeof(CSharp['mscorlib']['System.Int32'])
-- intType is System.Type userdata; may pass to C# APIs that need Type

local t1 = zlua.typeof(CSharp.AC.Demo)   -- same as typeof(Demo)
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32
)
local t2 = zlua.typeof(ListInt)          -- same as typeof(List<int>)
local IntArr = zlua.make_szarray_type(zlua.types.int32)
local t3 = zlua.typeof(IntArr)           -- same as typeof(int[])
```

**Native:** `__zlua_typeof`

### 4.2 `zlua.types`

Preset constants in `zlualib.lua` (usable directly as typeArg):

| Key | CLR full name |
|-----|---------------|
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

Resolve a CLR type by name and return the corresponding **type table** (isomorphic to tables from `CSharp` / `make_*` paths; failure → `luaL_error` or `nil` per implementation).

| Parameter | Notes |
|-----------|-------|
| `typeFullName` | Same format as **`System.Type.GetType(string name)`**’s `name` |

**Supported (aligned with `Type.GetType`):**

- Simple / namespace-qualified names (CLR resolution rules; depends on loaded assemblies)
- **Assembly-qualified name** (assembly, version, culture, public key token, etc.)
- **Generics** (open definitions and closed forms, e.g. `` System.Collections.Generic.List`1[[System.Int32]] ``)
- **Arrays** (e.g. `System.Int32[]`, `System.Int32[,]`)
- Nested types and other legal `Type.GetType` spellings

```lua
-- corlib
local Int32 = zlua.get_type_from_name("System.Int32")

-- Assembly-qualified name
local Demo = zlua.get_type_from_name(
    "Demo, Assembly-CSharp, Version=0.0.0.0, Culture=neutral, PublicKeyToken=null"
)

-- Closed generic (GetType style)
local ListInt = zlua.get_type_from_name(
    "System.Collections.Generic.List`1[[System.Int32, mscorlib]]"
)

-- Array
local IntArr = zlua.get_type_from_name("System.Int32[]")

local t = zlua.typeof(ListInt)   -- combinable with typeof
```

Relation to `CSharp[asm][name]` / `make_generic_type`:

| Path | Use |
|------|-----|
| `CSharp[...]` | Lazy bind by assembly key + type full name (common path) |
| `make_generic_type` / `make_*array_type` | Build closed generic / array from existing type tables |
| **`get_type_from_name`** | Single-string resolve (AQN, generic, array), mirrors `Type.GetType` |

**Native:** `__zlua_get_type_from_name`

---

## 5. Generic types

### 5.1 `zlua.make_generic_type`

```lua
zlua.make_generic_type(genericBaseType, typeArg1, ...) → typeTable
```

| Parameter | Notes |
|-----------|-------|
| `genericBaseType` | Open generic definition: type table, or §3 **typeArg** (including type-name strings) |
| `typeArg…` | Generic arguments (§3 typeArg); count must match the definition |

Returns a closed generic type table; same arguments **intern** to the same table.

**Native:** `__zlua_make_generic_type`

```lua
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32
)
```

---

## 6. Opaque read/write

See [marshal/04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/).

### 6.1 `zlua.get_opaquevalue` / `zlua.set_opaquevalue`

```lua
zlua.get_opaquevalue(opaque_handle) → value
zlua.set_opaquevalue(opaque_handle, new_value)
```

| API | Notes |
|-----|-------|
| `get_opaquevalue` | Push per default C#→Lua rules; `ref`/`in`/`out` dereference first |
| `set_opaquevalue` | Write slot back per default Lua→C# |
| Lifetime | Valid only while the current C#→Lua call has not returned |
| Shape | **lightuserdata**; no metatable |

**Native:** `__zlua_get_opaquevalue` / `__zlua_set_opaquevalue`

---

## 7. Box / unbox / cast

### 7.1 `zlua.box`

```lua
zlua.box(typeArg, value) → byObjUserdata
```

| Parameter | Notes |
|-----------|-------|
| `typeArg` | **Value type** (primitive, enum, struct); reference type → error |
| `value` | Primitive / enum literal, or ByVal struct userdata |

**Native:** `__zlua_box`

### 7.2 `zlua.unbox`

```lua
zlua.unbox(boxedValue) → luaValue | byValUserdata
```

Argument must be **ByObjUserData**. Primitive → boolean/integer/number; enum → integer; struct → ByVal userdata.

**Native:** `__zlua_unbox`

### 7.3 `zlua.cast`

```lua
zlua.cast(obj, targetType) → userdata
```

| Parameter | Notes |
|-----------|-------|
| `obj` | ByObj class userdata |
| `targetType` | Type table or typeArg |

Same managed identity; **IMT façade = targetType**. See [marshal/06-CLASS.md](/docs/spec/marshal/06-CLASS/).

**Native:** `__zlua_cast`

---

## 8. Arrays

Aligned with [02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) §7.

### 8.1 Array types

```lua
zlua.make_szarray_type(typeArg) → szarrayTypeTable
zlua.make_mdarray_type(typeArg, rank) → mdarrayTypeTable   -- rank ∈ [1, 32]
```

**Native:** `__zlua_make_szarray_type` / `__zlua_make_mdarray_type`

### 8.2 Array instances

```lua
zlua.new_szarray_by_element_type(typeArg, length) → szarrayUserdata
zlua.new_szarray_by_szarray_type(szarrayTypeTable, length) → szarrayUserdata

zlua.new_mdarray_by_mdarray_type(mdarrayType, lowbounds, sizes) → mdarrayUserdata
zlua.new_mdarray_by_spec(typeArg, lowbounds, sizes) → mdarrayUserdata
```

| Parameter | Notes |
|-----------|-------|
| `length` | ≥ 0 |
| `lowbounds` / `sizes` | Length-`rank` Lua tables of **consecutive integers** (1..n) |

Elements initialize to `default(T)`. szarray supports `#arr` (`__len` → `Length`).

**Native:** `__zlua_new_szarray_by_element_type`, etc.

### 8.3 `zlua.to_bytes`

```lua
zlua.to_bytes(szarray) → string   -- Lua binary string (may contain \0)
```

Copy a **rank-1 szarray**’s managed memory as a **raw byte layout** into an equal-length Lua string.

Element type must be **CLR-interop blittable** (same representation as unmanaged memory; pin/memcpy-safe; aligned with [Blittable and Non-Blittable Types](https://learn.microsoft.com/dotnet/framework/interop/blittable-and-non-blittable-types)).

| Constraint | Notes |
|------------|-------|
| Input | **Only** szarray userdata (**no** mdarray) |
| Allowed element types | blittable primitives: `byte` / `sbyte` / `short` / `ushort` / `int` / `uint` / `long` / `ulong` / `float` / `double` / `IntPtr` / `UIntPtr`; and structs whose fields are **only** such blittable fields (e.g. `Vector3`, pure value-type POD) |
| **Rejected** | `bool[]`, `char[]` (`Boolean` / `Char` are non-blittable in CLR); element types with `bool` / `char` / reference fields (`string`, class, etc.); other non-blittable → `luaL_error` |
| Implementation | Treat the array’s contiguous in-memory data as a C `byte[]` of length **actual data bytes** (`Length × sizeof(element)`, including aligned struct layout), then **memcpy** the whole range into a Lua string |

```lua
local bytes = zlua.to_bytes(byte_arr)     -- byte[]
local fbytes = zlua.to_bytes(float_arr)   -- float[]; #fbytes == #float_arr * 4
local vbytes = zlua.to_bytes(vector3_arr) -- Vector3[] (blittable struct) also OK
-- zlua.to_bytes(bool_arr)  / zlua.to_bytes(char_arr)  → error (non-blittable)
```

**Native:** `__zlua_to_bytes`

### 8.4 `zlua.to_table`

```lua
zlua.to_table(szarray) → table
```

Argument must be a **rank-1 szarray** userdata of any element type. Returned table length `n = #arr`, with **`t[i]` ↔ C# `arr[i-1]`** (Lua 1-based ↔ C# 0-based).

**Native:** `__zlua_to_table`

---

## 9. Generic methods

### 9.1 `zlua.make_generic_method`

```lua
zlua.make_generic_method(genericMethodBase, typeArg1, ...) → closure
```

| Parameter | Notes |
|-----------|-------|
| `genericMethodBase` | **direct method closure** on a type table (unspecialized generic method) |
| `typeArg…` | Generic arguments; count must match the method’s generic formals |

Returns a specialized **direct closure**; same `(base, typeArgs…)` **intern**s (written under an internal signature key in `staticMap` / instance map).

**Requirement:** must not pass a **dispatch closure**.

**Native:** `__zlua_make_generic_method`

```lua
local bar_int = zlua.make_generic_method(MyType.GenericBar, zlua.types.int32)
bar_int(obj, 42)
```

---

## 10. Delegate

### 10.1 Default

C# methods with delegate formals may take a **Lua function** directly; parameter marshal converts implicitly ([marshal/09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/)).

### 10.2 `zlua.to_delegate` (explicit)

```lua
zlua.to_delegate(func, delegateTypeTable) → delegateUserdata
```

| Parameter | Notes |
|-----------|-------|
| `func` | Lua function |
| `delegateTypeTable` | Closed delegate type table |

**Native:** `__zlua_to_delegate`

---

## 11. Overload helpers

### 11.1 Signature string (native)

```lua
-- Not yet wrapped in zlualib.lua; call the global directly:
local sig = __zlua_create_signature(zlua.types.int32, zlua.types.string)
-- "(System.Int32,System.String)"
```

For overload signature description and debug comparison (see [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §4). Suggested local wrap:

```lua
function zlua.signature(...)
    return __zlua_create_signature(...)
end
```

### 11.2 `zlua.register_method`

```lua
zlua.register_method(aliasName, methodOrClosure) → void
```

Full semantics: [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §6.1.

Highlights:

- Same-name overloads already have **full-signature keys** at Bind (e.g. `Run(System.Int32)`); you may call `obj['Run(System.Int32)'](obj, …)` directly — **no** need for `register_method` first
- `register_method` hangs a **direct** closure on an **unused** short name; then **colon** works: `obj:run_i32(5)`
- Existing `aliasName` (default name / full-signature key / other alias) → `luaL_error`; does not merge overloads

```lua
local run_i32 = demo['Run(System.Int32)']
zlua.register_method("run_i32", run_i32)
demo:run_i32(5)
```

**Native:** `__zlua_register_method`

---

## 12. Native callbacks overview

Globals actually registered by **`ZLuaLib::RegisterGlobals`**; `zlualib.lua` wraps as listed.

| Native global | `zlua.*` wrap | Notes |
|---------------|---------------|-------|
| `__zlua_typeof` | `zlua.typeof` | Any type table |
| `__zlua_get_type_from_name` | `zlua.get_type_from_name` | Mirrors `Type.GetType` |
| `__zlua_create_signature` | *(none)* | See §11.1 |
| `__zlua_make_generic_type` | `zlua.make_generic_type` | |
| `__zlua_make_szarray_type` | `zlua.make_szarray_type` | |
| `__zlua_make_mdarray_type` | `zlua.make_mdarray_type` | |
| `__zlua_new_szarray_by_element_type` | `zlua.new_szarray_by_element_type` | |
| `__zlua_new_szarray_by_szarray_type` | `zlua.new_szarray_by_szarray_type` | |
| `__zlua_new_mdarray_by_mdarray_type` | `zlua.new_mdarray_by_mdarray_type` | |
| `__zlua_new_mdarray_by_spec` | `zlua.new_mdarray_by_spec` | |
| `__zlua_make_generic_method` | `zlua.make_generic_method` | |
| `__zlua_register_method` | `zlua.register_method` | Two parameters |
| `__zlua_box` | `zlua.box` | |
| `__zlua_unbox` | `zlua.unbox` | |
| `__zlua_cast` | `zlua.cast` | |
| `__zlua_to_delegate` | `zlua.to_delegate` | |
| `__zlua_get_opaquevalue` | `zlua.get_opaquevalue` | |
| `__zlua_set_opaquevalue` | `zlua.set_opaquevalue` | |
| `__zlua_to_bytes` | `zlua.to_bytes` | CLR blittable-element szarray → Lua string (excludes `bool[]` / `char[]`) |
| `__zlua_to_table` | `zlua.to_table` | szarray |

---

## 13. Examples

```lua
CSharp.AC = CSharp['Assembly-CSharp']
local Demo = CSharp.AC.Demo
local demo = Demo()

-- Generic
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32
)
local list = ListInt()

-- Array
local arr = zlua.new_szarray_by_element_type(zlua.types.int32, 4)
arr:set(0, 1)   -- via type-bound get/set; see 02-TYPE-SYSTEM §7

-- Array → bytes (CLR blittable: byte[] / float[] / Vector3[], etc.; not bool[] / char[])
local byteArr = zlua.new_szarray_by_element_type(zlua.types.byte, 8)
local raw = zlua.to_bytes(byteArr)
local floats = zlua.new_szarray_by_element_type(zlua.types.float, 4)
local fraw = zlua.to_bytes(floats)   -- #fraw == 16

-- opaque (inside a C#→Lua callback)
-- local v = zlua.get_opaquevalue(refHandle)

-- Full-signature key / short name
demo['Run(System.Int32)'](demo, 10)
local run = demo['Run(System.Int32)']
zlua.register_method("run_hot", run)
demo:run_hot(99)

-- Façade
local child = zlua.cast(demo, CSharp.AC.Child)
```

---

## 14. `zlualib.lua` skeleton (matches repo)

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

zlua.types = { /* see §4.2 */ }
```
