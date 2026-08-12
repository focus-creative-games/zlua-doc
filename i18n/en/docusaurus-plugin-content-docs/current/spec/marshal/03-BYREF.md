---
sidebar_position: 9
title: "`ref` / `in` / `out` Marshal"
---

# `ref` / `in` / `out` Marshal

> **Normative:** Marshal semantics for byref parameters (element type **A**) in C# ↔ Lua bidirectional calls.
> **C#→Lua:** Default **OpaqueValue**; details in [04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/).
> **Lua→C#:** From §3 onward in this document.

## 1. Scope

| Path | `ref` / `out` / `in` |
|------|----------------------|
| **C# → Lua** (GetFunction-obtained delegate, delegate bridge) | **Supported**; default Push **OpaqueValue** |
| **Lua → C#** (ordinary method / ctor, delegate `Invoke` / `__call`) | **Supported**; rules in §3 |

**Unified rule (Lua→C#):** Lua does **not** distinguish `ref` / `out` / `in`; all use the same Pop rules. C# still keeps CLR semantics (e.g. `in` is read-only).

Below, C# parameters are written `ref A` / `in A` / `out A`, where **A** is the element type after stripping byref.

## 2. C# → Lua

When the parameter is `ref` / `in` / `out A`, the **default** Push is **OpaqueValue** (lightuserdata handle pointing at that parameter slot on the C# call stack).

- Scripts read/write via `zlua.get_opaquevalue` / `zlua.set_opaquevalue`.
- This path does **not** Push ByValUserData / ClassUserData.
- Full rules: [04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/).

## 3. Lua → C#: general principles

For `ref` / `in` / `out A`, the binding layer ultimately passes some **`A*`** (or equivalent managed byref) address into C#.

| Lua argument shape | Behavior summary | Can C# writes to `*slot` reflect on that Lua value? |
|--------------------|------------------|------------------------------------------------------|
| **OpaqueValue** (type-compatible) | Use the address pointed to by the handle | **Yes** (write back to original C# stack slot / bound address) |
| **ByValUserData** with type equal to **A** | Use userdata **payload address** | **Yes** (write back to userdata payload) |
| **Any other acceptable shape** | Marshal a value first, write into a **stack temporary for this call**, then pass **temporary address** | **No** (temp slot discarded after Invoke) |

Thus bare `number` / Lua `string` / most ByObjUserData passed to `ref A` do **not** error, but the original Lua value **does not** see C# write-backs (consistent with “no Lua lvalue”).

```lua
local x = 5
CS.Demo.Increment(x)   -- copied into temp int; C# mutates temp; x stays 5

local p = Point2D(1, 2)          -- ByValUserData, type == Point2D
CS.Demo.Offset(p, 10, 20)        -- pass payload address; after Invoke, p fields changed
```

## 4. Lua → C#: branch details

Decide by **Lua argument shape** and category of **A**. Type mismatch → `luaL_error` (e.g. OpaqueValue for `ref object` must **not** be passed to `ref int`).

### 4.1 OpaqueValue

1. Validate handle (generation / scope; see [04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/).
2. Validate handle's registered element type is **compatible** with **A** (exact match or implementation-defined assignability; **forbid** incompatible pairs such as `ref object` → `ref int`).
3. Hand the **address pointed to by the handle** to C# byref (**do not** copy into a temp slot).

### 4.2 A is a value type (struct / enum, etc., excluding the primitive path below)

| Lua argument | Behavior |
|--------------|----------|
| **ByValUserData** with userdata bound type **equal to A** | Pass **payload address** (can write back to userdata) |
| **ByValUserData** with type **≠ A**, but **A is `Nullable<T>`** and userdata type **equals T** | **Copy** T into a stack **`Nullable<T>` temporary**, pass that address (**do not** write back to original ByValUserData) |
| **Other** (including integer-represented enums, tables, etc., when by-val rules allow) | Obtain `A` via by-val rules → write stack temp → pass temp address |

### 4.3 A is a primitive (`bool` / `char` / integers / floats, etc.)

| Lua argument | Behavior |
|--------------|----------|
| Matching **primitive** Lua value (integer / number / boolean, etc., same rules as [01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/)) | **Copy** to stack temp, pass temp address |
| **OpaqueValue** (type-compatible) | See §4.1 |
| **ByValUserData** | Usually unused for primitives; if implementation has no primitive ByValUserData, treat as illegal or do not pass payload directly |

Primitives have **no** path that mutates a Lua `local`: even if C# modifies `ref int`, a bare number argument only affects the temp slot.

### 4.4 A is `string`

| Lua argument | Behavior |
|--------------|----------|
| **`string` ByObjUserData** | Write managed object pointer into stack temp, pass temp address |
| **Lua `string`** | Create managed `System.String`, write pointer into stack temp, pass temp address |
| **`nil`** | Temp slot is `null`; pass temp address (`out` same; see §5) |
| **OpaqueValue** (type-compatible) | See §4.1 |

Both non-Opaque paths use a **temp slot**: **C# reassigning `ref string` does not rewrite** the original Lua userdata / Lua string.

### 4.5 A is another reference type (class / interface / array / delegate / `object`, etc.)

| Lua argument | Behavior |
|--------------|----------|
| Shapes that Pop to a managed object (ByObjUserData, `nil`, and other by-val shapes allowed by the declared type) | Obtain managed pointer (or `null`) → write stack temp → pass temp address |
| **OpaqueValue** (type-compatible) | See §4.1 |

Likewise: **temp slot** ⇒ C# **`ref` rebinding** (`refParam = other`) does **not** reflect to Lua; **in-place mutable fields** remain visible via shared reference (see [06-CLASS.md](/docs/spec/marshal/06-CLASS/).

## 5. `out` and omitted / `nil`

| Case | Behavior |
|------|----------|
| Argument omitted or `nil`, and temp-slot path | Temp set to `default(A)` (reference types `null`); discarded after Invoke |
| Argument is **ByValUserData** (type == A) or compatible **OpaqueValue** | Bind existing address; `out` writes back to that address |

If a script needs to observe `out` / `ref` write-backs, pass:

- type-matching **ByValUserData** (value types), or
- a still-valid compatible **OpaqueValue** (common when calling back into C# from a C#→Lua callback).

## 6. Bridge flow (conceptual)

```text
PopRefArgument(luaIndex, A):
  if IsOpaqueValue(luaIndex):
      CheckCompatible(opaque.ElementType, A)   // e.g. forbid object → int
      return BindRef(opaque.Address)

  if A is valuetype:
      if IsByValUserData(luaIndex):
          U = userdata.Type
          if U == A:
              return BindRef(&payload)
          if A is Nullable<T> && U == T:
              temp = (Nullable<T>)CopyFromPayload()
              return BindRef(&temp)
      // fallthrough → by-val into temp

  if A is primitive:
      value = PopPrimitive(luaIndex, A)
      temp = value
      return BindRef(&temp)

  if A is string:
      obj = PopStringAsManagedObject(luaIndex)  // ByObj or Lua string→new String
      temp = obj
      return BindRef(&temp)

  // other reference types
  obj = PopReference(luaIndex, A)
  temp = obj
  return BindRef(&temp)
```

Il2Cpp: `temp` lives in the current `MethodBridge` / call frame; ByValUserData is `lua_newuserdata` payload.
Mono: implementation may differ (pin / box); **observable semantics** must match the tables above.

## 7. Bidirectional comparison

| Direction | Default shape | Write-back |
|-----------|---------------|------------|
| **C# → Lua** | OpaqueValue | `set_opaquevalue` or pass handle again into compatible `ref A` |
| **Lua → C#** | Opaque / matching ByValUserData → pass address; other → temp slot | Only the direct-address path can mutate “original” storage |

## 8. Examples

```lua
-- Temp slot: bare number
CS.Demo.Increment(5)

-- ByValUserData: true payload write-back
local p = Point2D(1, 2)
CS.Demo.Offset(p, 10, 20)
assert.equal(p.x, 11)

-- Nullable: ByValUserData(T) → copy into Nullable<T> temp (no write-back to original userdata)
-- CS.Demo.SetNullable(p)   -- void SetNullable(ref Nullable<Point2D> n)

-- string: Lua string / ByObj → temp slot (rebind not visible)
CS.Demo.Replace(refStrHolder)  -- depends on API; bare "hello" also goes to temp

-- Inside C#→Lua callback: pass Opaque back
function OnRefInt(h)
    zlua.set_opaquevalue(h, zlua.get_opaquevalue(h) + 1)
    CS.Demo.IncrementOpaque(h)   -- compatible ref int Opaque → pass address
end
```

## 9. Related docs

| Topic | Doc |
|-------|-----|
| OpaqueValue lifetime and get/set | [04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/) |
| ByValUserData / struct | [05-STRUCT.md](/docs/spec/marshal/05-STRUCT/) |
| Reference façade and rebind | [06-CLASS.md](/docs/spec/marshal/06-CLASS/) |
| Default by-val matrix | [01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/) |
| GetFunction / delegate bridge | [09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/), [../01-HOST-API.md](/docs/spec/01-HOST-API/) |
