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
| **`zlua`** | Type construction helpers, opaque, boxing, arrays, delegates, generic method closing (`inflate`) |
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
| **`System.Type` object** | Reflection object from `zlua.typeof(...)` (Type class userdata on Lua, including `RuntimeType` and other subclasses). Any API that accepts `typeArg` may take it directly; equivalent to passing the corresponding type table |

`zlua.typeof(typeTable)` accepts **any** ZLua type table (including closed generics and array type tables) and returns that type’s **`System.Type` reflection object** (Type class userdata on Lua), matching C# `typeof(T)`. That return value may itself be used again as a `typeArg`.

**Subset: GTAP prefix (§9.2).** When calling an open generic method, prefix type arguments accept **only** **`System.Type` objects** (ByObj userdata) from the table above — **not** type tables / strings / `zlua.types.*`. For full §3 ergonomics use `zlua.inflate` (§9.1); its typeArgs match this section **exactly**.

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

Resolve a CLR type by name and return the corresponding **type table** (isomorphic to tables from `CSharp` / `make_*` paths; failure → **`luaL_error`** / a clear error — **must not** silently return `nil`).

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

Open generic methods (method-level type parameters, e.g. `T GetComponent<T>()`) have two closing paths with the same semantics but different scenarios:

| Path | Use when | typeArg rules |
|------|----------|---------------|
| **`zlua.inflate`** (§9.1) | Close method generics by **closed** declaring type + method name/signature; cache closure on hot paths | **Full §3 typeArg** |
| **GTAP** (§9.2) | Pass `System.Type` prefixes at the call site (via metatable short names) | **`System.Type` userdata only** |

> **`zlua.make_generic_method` / `zlua.register_method` are not provided:** the same CLR method maps to different bridges under ByVal / ByObj (and static/instance); “take a closure, specialize, then hang a name” easily loses `isByVal` context. Metatables are **frozen** after Bind; the method table must not be rewritten at runtime.

Return-value facades of closed methods follow the **declared types of the closed signature**. To hang the facade on the runtime actual type, see [marshal/02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/) `ActualTypeUserData`.

**Scope:** `inflate` / GTAP close **only** the method’s own generic formals. If the declaring type is still open (e.g. `List\`1`), first use `zlua.make_generic_type` to obtain a closed type, then `inflate` method generics on it.

### 9.1 `zlua.inflate`

```lua
zlua.inflate(type, methodNameOrSignature, typeArg1, ..., typeArgN) → closure
```

On the given **closed** type, look up an **open generic method** by **name or full-signature key**, monomorphize with typeArgs, and return a **direct closure** (may be cached locally).

| Parameter | Notes |
|-----------|-------|
| `type` | Declaring type of the open generic method: **must be closed** (not `IsGenericTypeDefinition`, no unbound generic parameters). **Type table** or a §3 typeArg that resolves to a type (prefer type table / `System.Type`) |
| `methodNameOrSignature` | **String**: short method name (e.g. `"GetComponent"`) or [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §3.7 **full-signature key** (open generic formals use parameter names, e.g. `"Describe(T)"`; **no** CLR `` `n `` suffix) |
| `typeArg1…typeArgN` | §3 typeArg; **`N ≥ 1`** and **`N` =** count of generic formals on the target open method |

| Behavior | Rules |
|----------|-------|
| Lookup | Search **static map + ByObj instance map** on that type (inheritance-flattened binding). Short name with multiple candidates not uniqued by arity → error (use full-signature key) |
| Instance convention | Returned instance-method closure uses **ByObj** calling convention: must be `f(self, …)` with `self` as class / boxed struct userdata; **does not** produce a separate ByVal-side closure via `inflate` alone (struct ByVal open generics use **GTAP** on that side’s metatable) |
| intern | Key includes at least **`(closedMethod, isStatic, isByVal)`** (closed `MethodInfo` + static/instance + ByVal/ByObj). Same key **intern**s to one registry closure; **shared** key space with GTAP implicit inflate |
| Failure | Declaring type not closed / invalid type / missing name / not open generic / arity mismatch / ambiguity / `MakeGenericMethod` constraint failure → **`luaL_error`** with a clear reason |

**Native:** `__zlua_inflate`

```lua
-- Unity: cache GetComponent<Rigidbody> (declaring type may be GameObject; after inheritance flatten, Component’s method is found)
local GetRb = zlua.inflate(GameObject, "GetComponent",
    CSharp['UnityEngine.CoreModule']['UnityEngine.Rigidbody'])
local rb = GetRb(go)

-- typeArg may be type table / string / System.Type (§3)
local GetBox = zlua.inflate(GameObject, "GetComponent", zlua.typeof(BoxCollider))
local GetTr = zlua.inflate(GameObject, "GetComponent", "UnityEngine.Transform")

-- Generic class: close declaring type first, then inflate method generics
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'], zlua.types.int32)
-- local f = zlua.inflate(ListInt, "ConvertAll", ...)
```

### 9.2 Open-generic call prefix (GTAP)

When invoking an **open generic** direct (or a dispatch that includes open-generic candidates) on a type/instance metatable, place **N** type prefixes **before** ordinary arguments to inflate implicitly, then match the remaining args against the closed signature.

| Rule | Notes |
|------|-------|
| Prefix | After `self` (if any), **N** consecutive args must be **`System.Type` ByObj userdata** (`zlua.typeof(...)`); **N** = method generic formal count |
| Remaining | Ordinary args of the closed method (may be zero, e.g. `GetComponent<T>()`) |
| **Not** accepted | Type tables, type-name strings, `zlua.types.*` as GTAP prefixes (use `typeof` first, or `inflate`) |
| Overload priority | If an **open generic** candidate matches “prefix N × `System.Type` + remaining args applicable to the closed signature”, it **wins over** ordinary non-generic overloads (including `GetComponent(Type)`) |
| `isByVal` | Taken from the **metatable side that triggered the call** (ByObj IMT or ByVal IMT), then interned together with the closed `MethodInfo` |
| intern | Implicit inflate **shares the same intern** as explicit `inflate` (key includes `isStatic` / `isByVal`) |
| Failure | Insufficient/wrong prefix / constraint failure → overload failure or a clear error (consistent across platforms) |

See [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §3.8.

```lua
local Rigidbody = CSharp['UnityEngine.CoreModule']['UnityEngine.Rigidbody']
local rb = go:GetComponent(zlua.typeof(Rigidbody))   -- GTAP → GetComponent<Rigidbody>()
-- go:GetComponent(Rigidbody)                        -- ✗ type table is not a GTAP prefix
-- go:GetComponent("UnityEngine.Rigidbody")          -- string overload (if any), not GTAP
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

### 11.2 Exact overload and short names

- **Full-signature keys** (e.g. `Run(System.Int32)`) are lazily resolved and cached on `__index` miss (see [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §3.7); you may call `obj['Run(System.Int32)'](obj, …)`
- For short-name colon calls, use Bind-time **`[LuaAlias]`** / XML aliases (same doc §5)
- **No** runtime `register_method`; short names are **frozen** after Bind

```lua
local run_i32 = demo['Run(System.Int32)']
run_i32(demo, 5)
-- Or after Bind-time [LuaAlias("run_i32")]: demo:run_i32(5)
```

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
| `__zlua_inflate` | `zlua.inflate` | Close method generics by closed declaring type + name/signature + typeArgs |
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

-- Full-signature key / [LuaAlias] short name (see 04-METHOD-OVERLOAD)
demo['Run(System.Int32)'](demo, 10)
local run = demo['Run(System.Int32)']
run(demo, 99)

-- Façade
local child = zlua.cast(demo, CSharp.AC.Child)

-- Generic methods: inflate / GTAP (see §9)
-- local GetRb = zlua.inflate(GameObject, "GetComponent", Rigidbody)
-- local rb = go:GetComponent(zlua.typeof(Rigidbody))
```

---

## 14. `zlualib.lua` skeleton (matches repo)

```lua
zlua = zlua or {}

function zlua.typeof(typeTable) return __zlua_typeof(typeTable) end
function zlua.get_type_from_name(typeFullName) return __zlua_get_type_from_name(typeFullName) end
function zlua.make_generic_type(genericType, ...) return __zlua_make_generic_type(genericType, ...) end
function zlua.inflate(type, methodNameOrSignature, ...) return __zlua_inflate(type, methodNameOrSignature, ...) end
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

zlua.types = { /* see §4.2 */ }
```
