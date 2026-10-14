---
sidebar_position: 4
title: Generic methods (getting started)
description: Ordinary methods on closed generic types vs methods with their own type parameters, then GetComponent as an example.
---

# Generic methods (getting started)

As in C#, start by telling these two cases apart:

| Case | Example | In Lua |
|------|------|------------|
| **Closed generic type**, call an ordinary method on it | `List<int>.Add` | `make_generic_type` first, then call like any instance method |
| Method **itself** has type parameters | `NameOf<T>()` / `GetComponent<T>()` | Close the method’s `T` with `inflate` or GTAP |

Full type closing and more rules: [Generics](/docs/guides/generics/).

## 1. Ordinary methods on a generic type

Once the declaring type’s `T` is closed on the type side, members are not “open generic methods” — **no** `inflate` / GTAP:

```lua
-- Close once at module load / init and cache
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32
)

local list = ListInt()
list:Add(10)    -- ordinary instance method
list:Add(20)
print(list.Count)
```

Same idea for `Dictionary<string, int>`: close the type, then `dict:Add("hp", 100)`.

:::tip
`make_generic_type` is interned, but do **not** call it with the same arguments inside a hot loop; keep closed type tables such as `ListInt` in an upvalue / module field.
:::

## 2. Methods with their own type parameters

When the method signature still has its own `<T>` (whether or not the declaring type is generic), the short name stays **open** until you close it.

Assume C#:

```csharp
public class Sample
{
    public static string NameOf<T>() => typeof(T).Name;

    public T Echo<T>(T value) => value;
}
```

### `zlua.inflate` (prefer on hot paths)

```lua
local Sample = CSharp.AC.Sample   -- resolve the type table for your assembly / namespace

-- Static: close once, cache the closure
local NameOfInt = zlua.inflate(Sample, "NameOf", zlua.types.int32)
print(NameOfInt())                -- "Int32"

-- Instance: inflate first, then call
local sample = Sample()
local EchoStr = zlua.inflate(Sample, "Echo", zlua.types.string)
print(EchoStr(sample, "hi"))      -- "hi"
```

typeArg may also be a type table, `zlua.typeof(...)`, a type-name string, etc. (see [05-LIB §9](/docs/spec/05-LIB/)).

:::warning
**Do not inflate in a loop.** On hot paths also avoid type-name strings as typeArg (name resolution is heavier); prefer type tables / `zlua.types.*`.

```lua
-- ✗ inflate on every call / every frame
for i = 1, n do
    zlua.inflate(Sample, "Echo", zlua.types.string)(sample, "hi")
end
```

Cache `EchoStr` outside the loop and only call `EchoStr(sample, …)` inside.
:::

### GTAP (convenient for occasional calls)

Prefix **N** `System.Type` values (`zlua.typeof`) before the call; do **not** pass a type table directly:

```lua
print(Sample.NameOf(zlua.typeof(zlua.types.int32)))

local sample = Sample()
print(sample:Echo(zlua.typeof(zlua.types.string), "hi"))
```

:::warning
**Avoid GTAP on hot paths.** Every call takes the open-method prefix path, often with `typeof`. Fine for init and tools; for **Update / combat** use a cached `inflate` closure above.

```lua
-- ✗ Hot loop
for i = 1, n do
    sample:Echo(zlua.typeof(zlua.types.string), "hi")
end

-- ✓
local EchoStr = zlua.inflate(Sample, "Echo", zlua.types.string)
for i = 1, n do
    EchoStr(sample, "hi")
end
```
:::

| Path | Notes |
|------|------|
| `inflate` | Close first, then call; **preferred on hot paths** (cache the closure) |
| GTAP | Short name + `typeof` prefixes; occasional use only, not hot loops |

## 3. Example: `GameObject.GetComponent`

The most common open generic method in Unity: `GameObject.GetComponent<T>()` (ordinary declaring class; the **method** carries `T`).

```lua
local UE = CSharp['UnityEngine.CoreModule']
local GameObject = UE['UnityEngine.GameObject']
local Rigidbody = UE['UnityEngine.Rigidbody']
-- local go = ...  -- some GameObject instance
```

### inflate (recommended)

```lua
-- Close once at startup / module load
local GetRb = zlua.inflate(GameObject, "GetComponent", Rigidbody)

local rb = GetRb(go)   -- like C# go.GetComponent<Rigidbody>()
```

:::tip
When fetching the same component type repeatedly, **inflate once** and only call `GetRb(go)` on the hot path.
:::

### GTAP

```lua
local rb = go:GetComponent(zlua.typeof(Rigidbody))
```

- Do **not** write `go:GetComponent(Rigidbody)` (a type table is not a valid GTAP prefix)
- If non-generic overloads such as `GetComponent(Type)` exist, GTAP still prefers the open-generic candidate

:::warning
**Do not GTAP every frame in Update.** If you must use GTAP, at least cache `local rbType = zlua.typeof(Rigidbody)` instead of calling `typeof` in the loop; caching `GetRb` is still better.

```lua
-- ✗
function Update()
    local rb = go:GetComponent(zlua.typeof(Rigidbody))
end

-- ✓
local GetRb = zlua.inflate(GameObject, "GetComponent", Rigidbody)
function Update()
    local rb = GetRb(go)
end
```
:::

### Do not confuse with non-generic overloads

| Call | Meaning |
|------|------|
| `go:GetComponent(zlua.typeof(Rigidbody))` | GTAP → `GetComponent<Rigidbody>()` |
| `go:GetComponent(Rigidbody)` | **Wrong** (type table as a normal argument) |
| `go:GetComponent("UnityEngine.Rigidbody")` | Hits a string overload if present — **not** generic close |

### Return view

After close, the declared return is often `Component`. To expose the actual component type on return, see [Return view type](/docs/guides/actual-type-userdata/), or use script-side `zlua.cast`.

## Next

Inflate after closing an open declaring type, more typeArg rules, and error tables: [Generics](/docs/guides/generics/).
