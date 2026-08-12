---
sidebar_position: 16
title: "Pointers and Unsupported Types"
---

# Pointers and Unsupported Types

> **Normative:** Marshal rules for unmanaged pointers, function pointers, and CLR forms that are unsupported or restricted by default in v1.
> **Related:** Default matrix → [`01-OVERVIEW.md`](/docs/spec/marshal/01-OVERVIEW/); `IntPtr` integer rules → [`01-OVERVIEW.md`](/docs/spec/marshal/01-OVERVIEW/); OpaqueValue contrast → [`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/); Delegate contrast → [`09-FUNCTION.md`](/docs/spec/marshal/09-FUNCTION/); `ref struct` → [`05-STRUCT.md`](/docs/spec/marshal/05-STRUCT/), [`../05-LIB.md`](/docs/spec/05-LIB/).

**Platform principle:** Mono and Il2Cpp share the same **Lua-visible semantics**.

## 1. Distinction from `IntPtr` / `UIntPtr`

In the overview, **`IntPtr` / `UIntPtr` / `nint` / `nuint`** use **integer numeric** Marshal (`ToInt64` / `new IntPtr`), **not** Pointer in this section.

| Type | Lua default shape | Script can treat as integer math |
|------|-------------------|----------------------------------|
| **`IntPtr` / `UIntPtr` / `nint` / `nuint`** | integer / number | **Yes** (by numeric value) |
| **`T*` / `void*` unmanaged pointers** | **Pointer** (lightuserdata) | **No** (pass-through only) |
| **Function pointer** `delegate*<…>` | **Pointer** (lightuserdata) | **No** (pass-through only) |

## 2. Unmanaged pointers (`T*`, `void*`, etc.)

**Scope:** CLR types with `Type.IsPointer == true` whose element is an **unmanaged** type, e.g. `int*`, `byte*`, `void*`, `MyStruct*` (`MyStruct` is an unmanaged struct).

**Does not include** `IntPtr` / `UIntPtr` (see §1).

### 2.1 Default Marshal

| Direction | Default shape | Notes |
|-----------|---------------|-------|
| **C# → Lua** | **Pointer** (**lightuserdata**) | Push pointer **address value** (`uintptr_t` / platform pointer width); **no** metatable |
| **Lua → C#** | **Pointer** (**lightuserdata**) | Pop must be Pointer shape; restore declared pointer type |

### 2.2 Lua-side capabilities (intentionally limited)

| Allowed | Forbidden |
|---------|-----------|
| Pass **as-is** as an argument to the next C# call (pass-through within a sync chain) | **Dereference**, read/write pointed-to memory |
| Distinguish from `nil` (non-null pointers are Pointer) | `:` / `.` member access, arithmetic, `#`, `pairs`, etc. |
| — | Store in globals / tables / upvalues then use **async** or **across pcall** (address may be invalid) |

**Rationale:** Lua cannot safely express C# unmanaged pointer lifetime and aliasing; only **opaque token pass-through** is supported for native / low-level API glue.

### 2.3 `[LuaMarshalAs]`

Unmanaged pointers allow `Default` and **`OpaqueValue`** (C#→Lua only). `UserData`, `Table`, etc. remain **illegal** (see [`02-MARSHAL-AS.md`](/docs/spec/marshal/02-MARSHAL-AS/). `OpaqueValue` differs from default Pointer lightuserdata: it uses the Opaque slot and `get_opaquevalue` / `set_opaquevalue` lifetime rules.

## 3. Function pointers

**Scope:** CLR types with `Type.IsFunctionPointer == true`, e.g. C# 9+ `delegate*<int, int>`, `delegate*<void>`.

### 3.1 Default Marshal

| Direction | Default shape | Notes |
|-----------|---------------|-------|
| **C# → Lua** | **Pointer** (**lightuserdata**) | Push function entry **address**; **no** metatable |
| **Lua → C#** | **Pointer** (**lightuserdata**) | Pop restores the corresponding function pointer type |

### 3.2 Lua-side capabilities

Same as §2 — **pass-through only**; Lua **cannot call** that address.

### 3.3 `[LuaMarshalAs]`

Same as §2.3: allow `Default` and **`OpaqueValue`** (C#→Lua only).

### 3.4 Contrast with `Delegate`

| Type | Lua default shape | Callable from Lua |
|------|-------------------|-------------------|
| **`Action` / `Func<…>` etc. Delegate** | DelegateUserData or Lua function | **Yes** (see [`09-FUNCTION.md`](/docs/spec/marshal/09-FUNCTION/)) |
| **`delegate*<…>` function pointer** | Pointer (lightuserdata) | **No** |

## 4. `System.TypedReference`

`TypedReference` is passed C# ↔ Lua **only** as **OpaqueValue**; **default is already OpaqueValue**, so `[LuaMarshalAs(OpaqueValue)]` is unnecessary. Other marshal shapes (UserData / Table / integer, etc.) are **unsupported**.

| Direction | Rules |
|-----------|-------|
| **C# → Lua** | **Default** Push **OpaqueValue** ([04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/); scripts read/write via `get_opaquevalue` / `set_opaquevalue` |
| **Lua → C#** | **Only** accept compatible **OpaqueValue** handles (bind address after type check); other Lua shapes → error |
| **Other `[LuaMarshalAs]`** | **Illegal** (fall back or reject at bind; see [`02-MARSHAL-AS.md`](/docs/spec/marshal/02-MARSHAL-AS/)) |

**Reason:** `TypedReference` binds a typed slot on the managed stack and cannot map stably to ordinary Lua values or userdata; OpaqueValue only exposes the slot address for the current call, matching its semantics.

## 5. Other unsupported or restricted types

These appear briefly in [`01-OVERVIEW.md`](/docs/spec/marshal/01-OVERVIEW/); collected here.

### 5.1 `decimal`

| Direction | Rules |
|-----------|-------|
| **Default** | **Not supported** |
| **`[OpaqueValue]` (C#→Lua)** | **Legal** |
| Pop/Push (Default) | Not in v1 default path |

### 5.2 `ref struct` (`Span<T>`, `ReadOnlySpan<T>`, etc.)

| Direction | Rules |
|-----------|-------|
| **by-val parameter** | **Cannot** use ordinary default marshal |
| Controlled paths | Only `ref` StructUserData / [`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/) OpaqueValue, etc. |

Details: [`05-STRUCT.md`](/docs/spec/marshal/05-STRUCT/), [`../05-LIB.md`](/docs/spec/05-LIB/).

### 5.3 `Nullable<T>`

| Direction | Rules |
|-----------|-------|
| Has value | Same marshal as `T` |
| **`null`** | **`nil`** |
| `T` is value type | Pop accepts `nil` |

See [`01-OVERVIEW.md`](/docs/spec/marshal/01-OVERVIEW/), [`../02-TYPE-SYSTEM.md`](/docs/spec/02-TYPE-SYSTEM/) §Nullable.

### 5.4 `dynamic`

Treated as **`object`** at compile time; no separate Lua shape.

### 5.5 Open generic parameters

E.g. `void M<T>(T x)` with `T` not instantiated: marshal decided by **call-site type arguments**; see [`../02-TYPE-SYSTEM.md`](/docs/spec/02-TYPE-SYSTEM/).

## 6. Signatures to reject at register / expose time

These are **illegal signatures** (not fine-grained marshal rules):

| Condition | Behavior |
|-----------|----------|
| **ref struct by-val** parameter combinations | **Reject** |
| Unresolvable **byref modifier** combinations | **Reject** |

**Allowed:** `ref`/`out`/`in` on **GetFunction-obtained delegate calls** and **delegate bridges** (C#→Lua: [`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/); Lua→C#: [`03-BYREF.md`](/docs/spec/marshal/03-BYREF/).

## 7. Pointer Pop details

| Item | Rules |
|------|-------|
| Accepted shape | **Only** Pointer lightuserdata |
| Does **not** accept | Implicit conversion from integer / number, full userdata, or OpaqueValue handle |
| **`null` pointer** | C#→Lua: Push Pointer or `nil` per implementation (must match across platforms); Lua→C#: whether `nil` maps to null pointer is implementation-documented |
| Errors | Type mismatch → `luaL_error` / equivalent exception |

## 8. Three lightuserdata kinds compared

| Kind | Use | metatable | Script R/W |
|------|-----|-----------|------------|
| **Pointer** (§2, §3) | Unmanaged / function pointer pass-through | **None** | **Cannot** dereference |
| **OpaqueValue** ([`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/)) | C# stack-frame parameter-slot handle | **None** | Via `get_opaquevalue` / `set_opaquevalue` |
| **(not lightuserdata)** ClassUserData etc. | Managed objects | **Has** IMT | `:` / `.` member access |

## 9. Mono / Il2Cpp consistency

| Item | Requirement |
|------|-------------|
| Pointer / function pointer Push | lightuserdata; address width = platform pointer |
| Pointer Pop | Only Pointer; no implicit convert with integer / full userdata |
| TypedReference | **Only** OpaqueValue (default); semantics match |
| `decimal` / `ref struct` by-val | Consistent unsupported or restricted behavior |
| Error messages | Same or equivalent |

## 10. Related docs

| Doc | Contents |
|-----|----------|
| [`01-OVERVIEW.md`](/docs/spec/marshal/01-OVERVIEW/) | Default matrix, `IntPtr` |
| [`02-MARSHAL-AS.md`](/docs/spec/marshal/02-MARSHAL-AS/) | Legal annotation set for pointer types |
| [`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/) | OpaqueValue vs Pointer |
| [`09-FUNCTION.md`](/docs/spec/marshal/09-FUNCTION/) | Delegate vs function pointer |
| [`05-STRUCT.md`](/docs/spec/marshal/05-STRUCT/) | `ref struct` |
| [`../02-TYPE-SYSTEM.md`](/docs/spec/02-TYPE-SYSTEM/) | Nullable, special type families |
