---
sidebar_position: 12.3
title: params parameters
description: Expanding C# params T[] from Lua, whole-array userdata, and common pitfalls.
---

# params parameters

Trailing C# **`params T[]`** uses **expand-first** rules on Lua→C# (aligned with C# `params`), unlike ordinary `T[]` formals. Authoritative details: [02-MARSHAL-AS §7](/docs/spec/marshal/02-MARSHAL-AS/), [Overload Spec](/docs/spec/04-METHOD-OVERLOAD/) §3.3.

Short intro: [Method calls](/docs/getting-started/method-calls/).

## vs ordinary `T[]`

| | Ordinary `T[]` formal | `params T[]` |
|--|----------------|--------------|
| Expand multi-slot `Foo(1, 2, 3)` | **Unsupported** | **Supported** (element type `T`) |
| Omit | Depends on optional / nullable | → **`T[0]`** (empty array, not `null`) |
| Whole `T[]` userdata | Supported | Supported (exactly one arg assignable to `T[]`) |
| Lua table as whole array | Supported (array-shaped table) | **Unsupported** |
| Lone `nil` as whole `null` array | Allowed (→ null ref) | **Unsupported** (`nil` may only be one expanded element) |

**No** dedicated `LuaMarshalType` (historical `ParamsTable` removed).

## Basic usage

```csharp
static void Sum(params int[] values) { /* … */ }
static void Prefix(int head, params int[] tail) { /* … */ }
static void CountNulls(params string[] values) { /* … */ }
```

```lua
-- Expand
Demo.Sum(1, 2, 3)
Demo.Sum()                 -- → int[0]
Demo.Prefix(0, 1, 2)       -- head=0, tail={1,2}

-- Whole: existing T[] userdata (e.g. zlua.new_szarray_*)
Demo.Sum(arr)

-- nil is an element, not a null array
Demo.CountNulls(nil)              -- string[]{ null }
Demo.CountNulls("a", nil, "b")
```

## Do not write

```lua
-- ✗ table cannot be the whole params array
-- Demo.Sum({ 1, 2, 3 })

-- ✗ lone nil cannot be a null int[]
-- Demo.Sum(nil)

-- If you only have a Lua table: build T[] userdata, then pass it whole
local arr = zlua.new_szarray_by_element_type(zlua.types.int32, 3)
arr[0], arr[1], arr[2] = 1, 2, 3
Demo.Sum(arr)
```

Array construction: [Arrays](/docs/guides/arrays/).

## With overloads

A `params` candidate accepts arg counts in **`[minLuaArity, +∞)`**. After conversion scores tie: **whole userdata** beats **expand**; then **non-params** candidates beat **params** ones (C# fixed-arity preference). See [Method overloads](/docs/guides/overloads/).

## Unsupported scope

| Scenario | Status |
|------|------|
| `params` on ordinary methods / constructors | ✅ |
| **GetFunction**-obtained delegate calls | ❌ |
| **delegate bridge** (C# calling Lua) `params` | ❌ |

See [09-FUNCTION](/docs/spec/marshal/09-FUNCTION/).

## Common mistakes

| Symptom | Fix |
|------|------|
| `Sum({1,2,3})` mismatch | table cannot be whole params; expand or build `T[]` userdata first |
| `Sum(nil)` (`params int[]`) | `int` elements reject nil; omit args: `Sum()` → `int[0]` |
| Expected multi-slot collect but a fixed overload won | Fixed arity wins; use a full-signature key or remove the clash |
| params on GetFunction / callbacks | Unsupported; use an explicit `T[]` formal |

## Learning path

| | |
|---|---|
| **Previous** | [Method overloads](/docs/guides/overloads/) |
| **Next** | [LuaAlias](/docs/guides/lua-alias/) |

## Related

- [Method calls (getting started)](/docs/getting-started/method-calls/)
- [Arrays](/docs/guides/arrays/)
- [Method overloads](/docs/guides/overloads/)
- [02-MARSHAL-AS §7](/docs/spec/marshal/02-MARSHAL-AS/)
- [04-METHOD-OVERLOAD](/docs/spec/04-METHOD-OVERLOAD/)
