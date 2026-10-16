---
sidebar_position: 11.2
title: Return view type
description: ByObj return view uses the runtime actual type (ActualTypeUserData); relation to zlua.cast and generic methods.
---

# Return view type

By default the return **view** is the **declared type**. With `LuaMarshalType.ActualTypeUserData`, the value is still **ByObj userdata**, but the **view = runtime actual type**, so Lua can see derived members. Authoritative details: [02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/), [06-CLASS](/docs/spec/marshal/06-CLASS/).

## Why `ActualTypeUserData`

Lua member access follows the userdata **view**, not a guess of the runtime type. On default Push the view is the **declared return type** of the method/property — even if the heap instance is more specific, ZLua does **not** switch to the derived type automatically:

```csharp
Base Create() => new Child();  // Actual Child; Lua view stays Base
```

```lua
local o = factory:Create()
o:BaseOnly()     -- OK: on Base view
-- o.childField  -- fail: Child-only members are not on the view
```

**Defaulting to the declared view is intentional**, to avoid:

| Risk | Notes |
|------|------|
| Unstable “type” across calls | Scripts cannot assume a fixed API surface for the return |
| Entangling special Marshal | e.g. declared `object` must not silently become a Lua string when the instance is `string` |
| Member-table bloat / instability | IMT bound to the declared type stays predictable and cacheable |

Therefore mark return-side `ActualTypeUserData` only when the **API is intentionally wide** (base / interface / `Component` / `object`) but scripts **almost always** need derived members — so the view becomes `obj.GetType()` and you skip a routine `zlua.cast`.

Typical cases:

| Scenario | Declared return | Often actual | Pain without the attribute |
|------|----------|----------|--------------|
| Factory / polymorphic create | `Base` / interface | Concrete `Child` | Must `cast` every time for derived members |
| Unity `GetComponent` | `Component` / interface | `Button`, etc. | Stuck on the declared type, or script-side `zlua.cast`. Or use the master switch [Unity optimizations](/docs/guides/unity-optimizations/) |
| Wide `object` / boxed return | `object` | Concrete class | View is always `System.Object` |

**Not needed** when the declared type already exposes the members you call, or downcast is rare (`zlua.cast` is enough).

## Default vs ActualType

| | Default Push | `ActualTypeUserData` |
|--|--|--|
| Shape | ByObj | Still ByObj |
| View | **Declared type** | **Actual type** |
| Typical | `CreateChild()` → Base | `CreateChildActual()` → Child |

```csharp
Base CreateChild() => new Child();

[return: LuaMarshalAs(LuaMarshalType.ActualTypeUserData)]
Base CreateChildActual() => new Child();
```

```lua
local o = ObjectFactory.CreateChild()         -- view Base
local c = zlua.cast(o, Child)                 -- script changes view
local a = ObjectFactory.CreateChildActual()   -- view already Child on return
```

## How to annotate

| Approach | Notes |
|------|------|
| Attribute | `[return: LuaMarshalAs(LuaMarshalType.ActualTypeUserData)]` |
| XML | `Return`=`ActualTypeUserData` (on the **declaring type**; inheritance works) |
| Hot-update assemblies | Attribute **only**; XML is **not** supported |

**Return values only.** On parameters / fields / properties / type-level → illegal (Mono Attribute: fall back to `Default` + log; Il2Cpp Generate / XML: may fail).

## Allowed types (summary)

Managed reference types that default to **ByObj**: `class` / `interface` / `object` / arrays, etc.

**Not** for ordinary `struct`, or `string` (default is not ByObj), etc. Full allow-list: [02-MARSHAL-AS §3](/docs/spec/marshal/02-MARSHAL-AS/).

## Complementary to `zlua.cast`

| | ActualTypeUserData | `zlua.cast` |
|--|--|--|
| Who changes the view | Automatically on C# return | Script does it |
| When | Fixed APIs that should “exit as the real type” | Occasional downcast |

## With generic methods

For `GetComponent`, after close the declared return may be `Component`; annotate ActualType on the open method’s return slot so the view is the **actual component type**. See [Generics](/docs/guides/generics/).

## Common misconceptions

| Myth | Reality |
|------|------|
| Turns `string` into a Lua string | No; actual `string` stays ByObj (view `System.String`) |
| Changes virtual dispatch rules | No; look up on **view**, then virtual-call on real `this` |
| Same as Opaque / Table | No; shape remains ByObj UserData |

## Learning path

| | |
|---|---|
| **Previous** | [LuaMarshalAs](/docs/guides/lua-marshal-as/) |
| **Next** | [0GC Marshal](/docs/guides/zero-gc-marshal/) |

## Related

- [LuaMarshalAs](/docs/guides/lua-marshal-as/)
- [Generics](/docs/guides/generics/)
- [02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/)
- [06-CLASS](/docs/spec/marshal/06-CLASS/)
