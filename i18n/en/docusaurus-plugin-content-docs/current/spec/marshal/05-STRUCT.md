---
sidebar_position: 11
title: "Struct Marshal"
---

# Struct Marshal

> **Normative:** Passing, construction, and write-back rules for C# structs (value types) with Lua.
> **OpaqueValue / byref (C#→Lua):** [04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/).
> **Lua→C# byref true ref:** [03-BYREF.md](/docs/spec/marshal/03-BYREF/).
> **Table / UnpackedValues:** [02-MARSHAL-AS.md §5–§6](/docs/spec/marshal/02-MARSHAL-AS/).
> **Implementation (GC, Registry, etc.):** → [../../impl/marshal/](/docs/impl/marshal/).

## 1. Design goals

| Goal | Notes |
|------|-------|
| Zero-copy (default Handle) | When the struct already lives on the bridge stack frame, C#→Lua only records the address and Pushes a lightuserdata handle; no extra box |
| Safety | Lua does **not** hold a raw struct address; handle is only an opaque token; expired access **errors** |
| Uniformity | struct and class both use `CSharp.*`, `obj:Method()`; difference is carrying shape |
| Explicit choice | `[LuaMarshalAs]`: `UserData`, `Table`, `UnpackedValues`, `OpaqueValue`, etc. |

**Terms:**

- **Blittable struct:** `memcpy`-able; no managed reference fields.
- **Non-blittable struct:** Contains `string`, class, or other reference fields; userdata path must let GC see instance memory.

## 2. Default Marshal (summary)

Without `[LuaMarshalAs]`, same as [01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/):

| Direction | Default shape | Notes |
|-----------|---------------|-------|
| **C# → Lua** (by-val) | **ByValUserData** or **OpaqueValue** | Long-lived / explicit StructUserData path Pushes **ByValUserData**; sync-chain by-val may also be **OpaqueValue** handle |
| **C# → Lua** (`ref`/`in`/`out`) | **OpaqueValue** | See [04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/) |
| **Lua → C#** | **StructUserData** or **`Type(...)`** product | Default does **not** accept table / multi-stack args; needs `[LuaMarshalAs(Table \| UnpackedValues)]` |

## 3. Three Lua-visible shapes

```text
┌─────────────────────────────────────────────────────────────┐
│  C# struct carrying shapes on Lua side                      │
├─────────────────┬───────────────────┬───────────────────────┤
│  OpaqueValue    │  ByValUserData    │  ByObjUserData        │
│  (Handle)       │  (StructUserData) │  (boxed)              │
├─────────────────┼───────────────────┼───────────────────────┤
│  lightuserdata  │  full userdata    │  full userdata        │
│  no metatable   │  ByVal instance MT│  ByObj instance MT    │
│  sync-only      │  long-lived OK    │  boxed object path    │
│  get/set_opaque │  : / . members    │  : / . members        │
└─────────────────┴───────────────────┴───────────────────────┘
```

| Shape | Typical source | Member access | Lifetime |
|-------|----------------|---------------|----------|
| **OpaqueValue** | C#→Lua by-val (sync) or **`ref`/`in`/`out`** default | **No** `:`/`.`; need `get_opaquevalue` / `set_opaquevalue` or `to_user_data` | Valid only for this C#→Lua call |
| **ByValUserData** (StructUserData) | C#→Lua Push copy, `Type(...)`, `to_user_data` | **ByVal instance metatable** | Lua GC; non-blittable needs Registry |
| **ByObjUserData** | C# box path, `zlua.box` (struct boxing) | **ByObj instance metatable** | Same family as class object path |

**Opaque ↔ StructUserData:** `zlua.to_user_data(opaque)` **copies** to StructUserData; they are independent; mutating userdata does **not** affect the original opaque (if still valid).

## 4. Dual instance metatables: ByVal and ByObj

In CLR, a value type may be **boxed then passed as object** to Lua, or passed **by value**. Thus **the same struct type has two instance metatables** on the Lua side:

| Path | userdata type | Payload | Instance metatable |
|------|---------------|---------|--------------------|
| **ByObj** | `ObjectUserData` | Managed object pointer (boxed instance) | **ByObj instance metatable** |
| **ByVal** | `ByValUserData` | Value type **actual data** (payload) | **ByVal instance metatable** (type table `__instance_mt`) |

There is still one type table `T`; `T.__instance_mt` describes **ByVal** semantics. The ByObj path attaches the **ByObj instance metatable**.

### 4.1 Instance method `this` resolution

For an instance method defined on type `DefType`:

| Path | `DefType` is **current struct** | `DefType` is a **class base** |
|------|--------------------------------|-------------------------------|
| **ByObj** | `this` = object pointer + skip object header → **unboxed payload** | `this` = **boxed object pointer** |
| **ByVal** | `this` = **payload start address** | Must **Box** first, then use **object pointer** as `this` |

**Forbid** mixing: ByVal userdata with ByObj metatable (or vice versa) → validation failure or `luaL_error`.

### 4.2 C# → Lua Push path selection

| Condition | Push result |
|-----------|-------------|
| box / `object` parameter, etc. | **ByObjUserData** + ByObj MT |
| Explicit StructUserData / blittable copy | **ByValUserData** + ByVal MT |
| Sync-chain by-val (default Handle) | **OpaqueValue** lightuserdata |
| `[LuaMarshalAs(OpaqueValue)]` on by-val struct | **OpaqueValue** |

## 5. Lua → C#: accepted argument shapes

| Shape | Notes |
|-------|-------|
| **OpaqueValue** (lightuserdata) | Only if just Push'd by C#→Lua and still in valid scope; Pop validates + binds; **cannot** R/W fields on Lua side |
| **StructUserData** (ByValUserData) | by-val: **copy** payload on Pop; `ref`/`out`/`in`: bind payload address, **true ref** (§6) |
| **`Type(...)` construction product** | StructUserData payload; to `ref T` is **true ref** |
| **`UnpackedValues`** | `[LuaMarshalAs(UnpackedValues)]` + `Members`: contiguous multi-stack args |
| **`Table`** | `[LuaMarshalAs(Table)]` + `Members`: single table |

**No Lua-side API creates lightuserdata** except OpaqueValue produced by C#→Lua.

### 5.1 Default rejects table / multi-arg

Without `[LuaMarshalAs]`, you **cannot** assemble a struct into C# via `{ X=1, Y=2 }` or `foo(x, y)`; use StructUserData, `Type(...)`, or explicit Table/UnpackedValues.

## 6. Write-back semantics and `ref` / `out` / `in`

Overview and full branches: [03-BYREF.md](/docs/spec/marshal/03-BYREF/). Value-type highlights:

| Lua argument | `ref`/`out`/`in` A (A is value type) |
|--------------|--------------------------------------|
| **ByValUserData** with type **== A** | Pass **payload address** (can write back to userdata) |
| **ByValUserData** with **A = `Nullable<T>`**, userdata type **== T** | Copy into stack `Nullable<T>` **temporary**, pass temp address (**no** write-back to original userdata) |
| **OpaqueValue** (type-compatible) | Pass handle address |
| **Other** (including shapes Pop-able by-val) | Copy into stack temp, pass temp address (**no** write-back to Lua) |

```lua
local p = Point2D(1, 2)
CS.Demo.Offset(p, 10, 20)   -- true payload write-back
assert.equal(p.x, 11)
```

## 7. `Table` / `UnpackedValues` (struct / Nullable)

Rules follow [02-MARSHAL-AS.md §5–§6](/docs/spec/marshal/02-MARSHAL-AS/); struct specifics:

| `LuaMarshalType` | Lua → C# | C# → Lua |
|------------------|----------|----------|
| **`UnpackedValues`** | Contiguous Pop of N stack values, write by `Members` **order** (**non-Nullable struct only**) | Push N values by list **order** |
| **`Table`** | Pop one table, write listed members by **key name**; **`Nullable<struct>`** also accepts `nil`→no value | Push one table; Nullable no value → `nil` |

- Requires **`Members`** (relative to underlying struct); errors: [02-MARSHAL-AS.md §4](/docs/spec/marshal/02-MARSHAL-AS/).
- Table, Lua→C#: **optional keys** use member name **`?` suffix** (e.g. `"Tag?"`); missing key skips assignment.
- Stack-slot occupancy and calling convention: [02-MARSHAL-AS.md §5.6](/docs/spec/marshal/02-MARSHAL-AS/).

**Type-level annotation example:**

```csharp
[LuaMarshalAs(LuaMarshalType.Table, Members = new[] { "X", "Y" })]
public struct Vector2
{
    public float X;
    public float Y;
}
```

**Resolution priority** (same as [02-MARSHAL-AS.md §8](/docs/spec/marshal/02-MARSHAL-AS/)): parameter/return > field/property > type-level > default; same target **Attribute > XML**.

## 8. Enum vs struct

Enums **default** C#↔Lua to integer/number and do **not** use struct userdata (see [08-ENUM.md](/docs/spec/marshal/08-ENUM/).

| Capability | struct | enum |
|------------|--------|------|
| Type table `SMT.__call` | **Yes** (`Point2D(...)`) | **No** |
| ByVal StructUserData | **Yes** | No `SMT.__call`; `ref` uses copy or C#-pushed StructUserData |
| boxed instance | `zlua.box` → ByObjUserData | `zlua.box` → ByObjUserData |
| Default parameter | StructUserData / integer etc. | **integer/number** or boxed |

```lua
local Color = CSharp.AC['MyGame.Color']
local v = Color.Red                    -- integer/number constant
local boxed = zlua.box(Color, Color.Green)  -- ByObjUserData
SetColor(Color.Red)                    -- default param OK
SetColor(boxed)                        -- default param OK
```

**`ref Color`:** bare integer takes the **copy** branch; for observable write-back need C#→Lua StructUserData, or change to a struct parameter. Boxed scenarios use **`zlua.box`**, **not** the StructUserData ref model.

## 9. `zlua.box` / `zlua.unbox` / `zlua.cast`

| API | struct semantics |
|-----|------------------|
| **`zlua.box(typeArg, value)`** | **Box** value type as **ByObjUserData**; `value` may be ByVal userdata, scalar, or construction args |
| **`zlua.unbox(boxedValue)`** | Unbox **ByObjUserData** to **ByVal StructUserData** (or equivalent accessible instance) |
| **`zlua.cast(obj, targetType)`** | Reference-type façade switch; struct cases: [06-CLASS.md](/docs/spec/marshal/06-CLASS/) and type system |

**`unbox` does not accept** ByVal userdata (already unboxed) → error.

## 10. Lifetime

```text
[C# calls Lua, sync chain]
  Push OpaqueValue(handle) → h
  lua_pcall(...)                        -- Lua may only get/set_opaque or to_user_data(h)
  C# returns                            -- h invalid

Lua saves h until next call → error on use

Need long-lived → zlua.to_user_data(h) or C#→Lua StructUserData path
```

| Shape | Invalidation |
|-------|--------------|
| **OpaqueValue** | C#→Lua call returns; or scope EndScope bumps generation |
| **StructUserData** | Lua GC collects userdata (`__gc` releases Registry entry) |

## 11. Non-blittable struct requirements (spec layer)

ByValUserData path for non-blittable structs must:

1. **Fully copy** the struct instance into userdata (including reference fields).
2. GC must scan **managed references inside struct memory** in userdata (implementation may use Registry + push root callbacks; Mono may use GCHandle).
3. userdata **`__gc`** and Registry release must be **symmetric**.

Blittable structs only `memcpy` into userdata payload; no extra GC registration.

## 12. Linkage with metatables / type tables

- value-type type table: `__struct = true` (see [../02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/).
- **ByVal:** `ByValUserData` + **ByVal instance metatable** (`__instance_mt`).
- **ByObj:** `ObjectUserData` + **ByObj instance metatable**.
- **Opaque:** **no** instance metatable; no `:` / `.`.
- **Forbid** accessing static members via instance.

## 13. Mono / Il2Cpp consistency

| Item | Requirement |
|------|-------------|
| Three shapes (Opaque / ByVal / ByObj) | Lua scripts **do not** distinguish platforms |
| Handle expiry | Both `luaL_error` |
| `to_user_data` | **Copy** semantics match |
| `Table` / `UnpackedValues` / `?` suffix | Same `[LuaMarshalAs]` config on both |
| ref/out/in StructUserData true ref | Semantics match; Mono may pin/box but behavior must align |

## 14. Related docs

| Topic | Doc |
|-------|-----|
| Default matrix | [01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/) |
| `[LuaMarshalAs]` | [02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/) |
| byref | [03-BYREF.md](/docs/spec/marshal/03-BYREF/) |
| OpaqueValue | [04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/) |
| Enum | [08-ENUM.md](/docs/spec/marshal/08-ENUM/) |
| `zlua.*` API | [../05-LIB.md](/docs/spec/05-LIB/) |
| Type tables / `__call` | [../02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) |
