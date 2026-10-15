---
sidebar_position: 3
title: Method calls
description: Shortest path for method overloads, generic methods, and params from Lua.
---

# Method calls

Besides ordinary colon / dot calls, three situations come up often when Lua calls C#:

| Topic | One line | Deeper |
|------|--------|------|
| **Method overloads** | Match by args by default; use a full-signature key or `[LuaAlias]` when ambiguous | [Method overloads](/docs/guides/overloads/) |
| **Generic methods** | Close method-level `<T>` with `inflate` / GTAP | [Generics](/docs/guides/generics/) |
| **`params`** | Expand multiple slots, or pass a whole `T[]` userdata; **no** table | [params parameters](/docs/guides/params/) |

Day-to-day static / instance calls: [Quick start](/docs/getting-started/quick-start/), [Lua calling C#](/docs/guides/lua-calling-csharp/).

---

## 1. Method overloads

Lua has no compile-time overload selection. Same-name signatures match by arguments by default; name one explicitly with a full-signature key or a Bind-time alias.

### Default (prefer this)

```lua
demo:Run(10)        -- Run(int)
demo:Run("hello")   -- Run(string)
```

Multiple candidates use **dispatch**; a single public candidate is **direct** (no dispatch).

### Exact pick

```lua
demo['Run(System.Int32)'](demo, 10)
```

Keys with parentheses need bracket indexing and an **explicit `self`**. The method name is CLR `MethodInfo.Name` (not a `[LuaAlias]` short name).

### Colon + short name

Annotate with `[LuaAlias("run_i32")]` (or Alias XML); after Bind you can call `demo:run_i32(10)`. There is **no** runtime API to hang short names. See [LuaAlias](/docs/guides/lua-alias/).

Default parameters, lazy full-signature caching, and troubleshooting: [Method overloads (guide)](/docs/guides/overloads/).

---

## 2. Generic methods

As in C#, start by telling these two cases apart:

| Case | Example | In Lua |
|------|------|------------|
| **Closed generic type**, call an ordinary method on it | `List<int>.Add` | `make_generic_type` first, then call like any instance method |
| Method **itself** has type parameters | `NameOf<T>()` / `GetComponent<T>()` | Close the method’s `T` with `inflate` or GTAP |

### 2.1 Ordinary methods on a generic type

Once the declaring type’s `T` is closed on the type side, members are not “open generic methods” — **no** `inflate` / GTAP:

```lua
-- Close once at module load / init and cache
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32
)

local list = ListInt()
list:Add(10)
list:Add(20)
```

:::tip
`make_generic_type` is interned, but do **not** call it with the same arguments inside a hot loop; keep tables such as `ListInt` in an upvalue / module field.
:::

### 2.2 Methods with their own type parameters

The short name stays **open** until you close it. Assume C#:

```csharp
public class Sample
{
    public static string NameOf<T>() => typeof(T).Name;
    public T Echo<T>(T value) => value;
}
```

**`zlua.inflate` (prefer on hot paths):**

```lua
local Sample = CSharp.AC.Sample

local NameOfInt = zlua.inflate(Sample, "NameOf", zlua.types.int32)
print(NameOfInt())

local sample = Sample()
local EchoStr = zlua.inflate(Sample, "Echo", zlua.types.string)
print(EchoStr(sample, "hi"))
```

:::warning
**Do not inflate in a loop.** On hot paths also avoid type-name strings as typeArg; prefer type tables / `zlua.types.*`.

```lua
-- ✗
for i = 1, n do
    zlua.inflate(Sample, "Echo", zlua.types.string)(sample, "hi")
end
```
:::

**GTAP (convenient for occasional calls):** prefixes must be `System.Type` (`zlua.typeof`); do not pass a type table directly.

```lua
print(Sample.NameOf(zlua.typeof(zlua.types.int32)))
print(sample:Echo(zlua.typeof(zlua.types.string), "hi"))
```

:::warning
**Avoid GTAP on hot paths.** Every call takes the open-method prefix path; for Update / combat, cache the closure from `inflate`.
:::

| Path | Notes |
|------|------|
| `inflate` | Close first, then call; **preferred on hot paths** |
| GTAP | Short name + `typeof` prefixes; occasional use |

### 2.3 Example: `GameObject.GetComponent`

```lua
local UE = CSharp['UnityEngine.CoreModule']
local GameObject = UE['UnityEngine.GameObject']
local Rigidbody = UE['UnityEngine.Rigidbody']

local GetRb = zlua.inflate(GameObject, "GetComponent", Rigidbody)
local rb = GetRb(go)

-- Occasional GTAP also works:
-- local rb = go:GetComponent(zlua.typeof(Rigidbody))
```

:::warning
**Do not GTAP / inflate every frame in Update.** Close once at startup; on the hot path only call `GetRb(go)`.
:::

| Call | Meaning |
|------|------|
| `go:GetComponent(zlua.typeof(Rigidbody))` | GTAP → `GetComponent<Rigidbody>()` |
| `go:GetComponent(Rigidbody)` | **Wrong** (type table as a normal argument) |
| `go:GetComponent("UnityEngine.Rigidbody")` | Hits a string overload if present — **not** generic close |

After close, the declared return is often `Component`; for an actual-type view see [Return view type](/docs/guides/actual-type-userdata/). More: [Generics](/docs/guides/generics/).

---

## 3. `params` parameters

Trailing C# `params T[]` may **expand** multiple Lua args, or take a **whole** `T[]` userdata. Unlike ordinary array formals: **no** Lua table / lone `nil` as the whole array.

```csharp
static void Sum(params int[] values) { }
static void Prefix(int head, params int[] tail) { }
```

```lua
Demo.Sum(1, 2, 3)      -- expand → int[]{1,2,3}
Demo.Sum()             -- → int[0]
Demo.Prefix(0, 1, 2)

-- Whole userdata
Demo.Sum(arr)          -- arr is int[] ByObjUserData

-- ✗ Demo.Sum({ 1, 2, 3 })   -- table not allowed
-- ✗ Demo.Sum(nil)           -- not a null array
```

When overloads coexist, fixed-arity candidates usually beat params expansion. Full rules: [params parameters](/docs/guides/params/).

---

## Next

| Topic | Guide |
|------|------|
| Overloads / defaults / full-signature keys | [Method overloads](/docs/guides/overloads/) |
| Closed types and generic methods | [Generics](/docs/guides/generics/) |
| params expand / whole array / unsupported scope | [params parameters](/docs/guides/params/) |
| Alias short names | [LuaAlias](/docs/guides/lua-alias/) |
