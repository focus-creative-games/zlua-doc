---
sidebar_position: 14
title: "Enum Marshal"
---

# Enum Marshal

> **Normative:** Default Marshal rules for C# `enum` between Lua and C#.
> **Related:** Type-table constant fields → [`../02-TYPE-SYSTEM.md`](/docs/spec/02-TYPE-SYSTEM/) §Enum; boxed form → [`../05-LIB.md`](/docs/spec/05-LIB/) `box`/`unbox`; `ref` enum → [`03-BYREF.md`](/docs/spec/marshal/03-BYREF/); `[LuaMarshalAs]` → [`02-MARSHAL-AS.md`](/docs/spec/marshal/02-MARSHAL-AS/).

**Platform principle:** Mono and Il2Cpp share the same **Lua-visible semantics**; enums default to **integer / number** Marshal and do **not** push userdata.

## 1. Design points

Enums are **value types** in C# with a single underlying integer field. On the Lua side:

| Scenario | Shape |
|----------|-------|
| **Default argument** | **integer** (preferred on Lua 5.4+) or **number** |
| **Boxed instance** | **ByObjUserData**; **only** via explicit [`zlua.box`](/docs/spec/05-LIB/) |
| **Type-table constants** | **integer / number** fields (**not** userdata) |

Enum type tables have **no** `SMT.__call`; you **cannot** construct ByVal userdata via `EnumType(...)` as with structs.

## 2. Default rules (C# ↔ Lua)

Without `[LuaMarshalAs]`:

| Direction | Default shape | Notes |
|-----------|---------------|-------|
| **C# → Lua** | **integer** (preferred) or **number** | Push enum **underlying integer**; do **not** push userdata |
| **Lua → C#** | **integer** / **number** | Accept integral Lua values; convert by target enum **underlying type** via `Enum.ToObject` / equivalent |
| **Lua → C#** (alternate) | **ByObjUserData** (boxed enum) | Unbox underlying integer from boxed object |

**Not accepted** (unless `[LuaMarshalAs]` says otherwise): default Marshal as **string** (enum name), **boolean**, or ordinary **table**.

## 3. Underlying type and range

Codegen / reflection must read the enum **underlying type** (`System.Int32`, `System.Byte`, etc.):

| Underlying type | Push preference | Pop accepts |
|-----------------|-----------------|-------------|
| `sbyte` … `ulong` | integer / number | integer / number (must be integral) |
| Non-integral underlying (rare) | number | number |

On Pop, validate the Lua integral value fits the underlying type range; out of range → `luaL_error`.

Integer primitive rules (integer vs number): [`01-OVERVIEW.md`](/docs/spec/marshal/01-OVERVIEW/) §3.

## 4. Relation to type-table constant fields

At bind time, enum **public static literals** are written into type table `E`:

```lua
local Color = CSharp.AC['MyGame.Color']
assert(Color.Red == 0)    -- integer / number, not userdata
```

Access path: `CSharp.AC['MyGame.Color'].Red`.

These are equivalent as **enum parameters** under default marshal:

```lua
local e = Color.Red
foo(e)
foo(Color.Red)
foo(1)   -- bare integer; must convert to that enum
```

Details: [`../02-TYPE-SYSTEM.md`](/docs/spec/02-TYPE-SYSTEM/) §Enum types.

## 5. Boxed form (non-default, `zlua.box`)

When a script needs a **boxed enum instance** (`object` parameter, `Array.SetValue`, long-lived ByObj, etc.):

```lua
local Color = CSharp.AC['MyGame.Color']
local boxed = zlua.box(Color, Color.Red)
-- or
local boxed2 = zlua.box(Color, 2)
```

| Item | Notes |
|------|-------|
| First arg | Enum type table, `zlua.typeof(E)`, or equivalent typeArg |
| Second arg | integer / number (integral); or same-enum constant field value |
| Return | **ByObjUserData** (boxed object; **not** struct ByVal payload) |
| Unbox | `zlua.unbox(boxed)` → underlying **integer** |

As an **enum parameter** into C#, both ByObjUserData and integer/number are **accepted** (§2).

**`zlua.box` product for `ref Color`:** ByObjUserData follows the [`03-BYREF.md`](/docs/spec/marshal/03-BYREF/) **reference/temp-slot** path (not ByValUserData payload pass-through).

## 6. `ref` / `out` / `in` enum parameters

See [`03-BYREF.md`](/docs/spec/marshal/03-BYREF/):

| Lua argument | Behavior |
|--------------|----------|
| **OpaqueValue** (type-compatible) | Pass handle address |
| **ByValUserData** (if present and type == enum) | Pass payload address |
| **integer / number** | Copy into stack temp, pass temp address; bare Lua value **unchanged** |
| **`zlua.box` product** (ByObj) | Write pointer into temp slot, pass temp address |

C#→Lua: `ref enum` defaults to **OpaqueValue**; see [`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/).

## 7. `[LuaMarshalAs]` extensions

| Annotation | enum by-val |
|------------|-------------|
| **`Default`** | §2 rules |
| **`UserData`** | **Illegal** (by-val enum cannot force userdata); fall back to Default; Editor error log |
| **`OpaqueValue`** | by-val **legal** (C#→Lua; usually unnecessary); for `ref`/`out`/`in`, C#→Lua already defaults to OpaqueValue |
| **`Table` / `UnpackedValues`** | **Illegal** (only struct / class / interface) |

Boxed form still requires **`zlua.box`**; **no** enum `SMT.__call`.

Illegal annotation behavior: [`02-MARSHAL-AS.md`](/docs/spec/marshal/02-MARSHAL-AS/) §Illegal annotations.

## 8. Differences vs struct / class (summary)

| Item | enum | struct | class |
|------|------|--------|-------|
| Default across boundary | integer/number | ByValUserData / StructUserData | ClassUserData |
| Type table `__call` | **No** | `.ctor` | `.ctor` |
| boxed / instance construction | Only `zlua.box` | `Type(...)` / `_default` | `Type(...)` |
| Type-table constants | integer/number | Usually none | Static members |
| `ref` write-back | Opaque / matching ByValUserData | ByValUserData / Opaque; others → temp | See [`06-CLASS.md`](/docs/spec/marshal/06-CLASS/) |

## 9. Mono / Il2Cpp consistency

| Item | Requirement |
|------|-------------|
| Default Push / Pop | integer/number ↔ underlying integer |
| Type-table constants | integer/number |
| boxed | **`zlua.box`** → ByObjUserData |
| Range checks | Consistent |
| Error messages | Same or equivalent |

## 10. Related docs

| Doc | Contents |
|-----|----------|
| [`01-OVERVIEW.md`](/docs/spec/marshal/01-OVERVIEW/) | Default matrix, integer/number |
| [`03-BYREF.md`](/docs/spec/marshal/03-BYREF/) | `ref` / `out` / `in` |
| [`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/) | C#→Lua byref |
| [`05-STRUCT.md`](/docs/spec/marshal/05-STRUCT/) | ByVal / ByObj vs box |
| [`../02-TYPE-SYSTEM.md`](/docs/spec/02-TYPE-SYSTEM/) | Enum type-table structure |
| [`../05-LIB.md`](/docs/spec/05-LIB/) | `box`, `unbox` |
