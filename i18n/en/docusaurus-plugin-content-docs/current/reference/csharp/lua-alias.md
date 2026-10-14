---
sidebar_position: 4
title: LuaAlias
description: "[LuaAlias] method overload alias attribute."
---

# LuaAlias

Provides a **Lua-side rename key** for C# method overloads, binding O(1) to a single overload and bypassing runtime dispatch. When an alias exists, the C# default method name is **not** registered.

```csharp
using ZLua;

public class Demo
{
    [LuaAlias("run_i32")]
    public void Run(int value) { x = value; }

    public void Run(string value) { x = value?.Length ?? 0; }
}
```

```lua
local demo = CSharp.AC.Demo()
demo:run_i32(10)   -- hits Run(int) directly
demo:Run("hi")     -- still goes through Run dispatch
```

## Attribute Definition

```csharp
[AttributeUsage(AttributeTargets.Method, AllowMultiple = false, Inherited = false)]
public sealed class LuaAliasAttribute : Attribute
{
    public string Alias { get; }
    public LuaAliasAttribute(string alias);
}
```

| Item | Description |
|------|-------------|
| Target | **Method** only |
| Multiplicity | At most one alias per method |
| Inheritance | **Not** inherited by subclass overrides |

## Key-Space Rules

At Bind time, `[LuaAlias]` **replaces** that method's default Lua key; it **allows** collision with other methods' default names or aliases (collisions join the same overload group and use dispatch). If the alias has **only one** candidate, it is direct — preferred on hot paths.

Full rules: [overload spec §5](/docs/spec/04-METHOD-OVERLOAD/). When multiple same-name candidates exist, full-signature keys are also hung automatically (§3.7).

```csharp
[LuaAlias("run_i32")]   // usually single candidate → direct
public void Run(int value) { }

public void Run(string value) { }  // default name still joins the "Run" group
```

## XML Config (When Source Cannot Change)

> **Only** for **non–hot-update** (precompiled / AOT) assemblies. Hot-update assemblies (including HybridCLR) must use in-code `[LuaAlias]`; XML is **not** supported for them.

Configured **separately** from `[LuaMarshalAs]`: Settings use the independent field **`luaAliasXmlPaths`**, root element **`ZLuaAlias`**.

```xml
<?xml version="1.0" encoding="utf-8"?>
<ZLuaAlias version="1">
  <Assembly name="Assembly-CSharp">
    <Type fullName="Demo">
      <Method name="Run" signature="(System.Int32)" alias="run_i32"/>
    </Type>
  </Assembly>
</ZLuaAlias>
```

| Field | Description |
|-------|-------------|
| `Assembly/@name` | Assembly short name |
| `Type/@fullName` | Full type name |
| `Method/@name` | C# method name |
| `Method/@signature` | Parameters only, e.g. `(System.Int32)` |
| `Method/@alias` | Final Lua key (required; **replaces** default name) |

Priority: **Attribute > XML**. With an alias, `MethodInfo.Name` is **not** hung. Authoritative text: [overload spec §5.4](/docs/spec/04-METHOD-OVERLOAD/).

## Static / Instance

| Method kind | Where alias is written | Lua call |
|-------------|------------------------|----------|
| Instance | Instance `methodTable` | `obj:alias(...)` |
| Static | Type-table `methodTable` | `TypeTable.alias(...)` |

## Relation to full-signature keys

| Approach | Timing | When to use |
|----------|--------|-------------|
| Full-signature key `Run(System.Int32)` | Lazy-resolved on `__index` miss and cached | Precise pick; no C# change; no runtime hang API |
| `[LuaAlias]` / XML | On type `EnsureBinding` | Bind-time short name; hot-path preferred colon calls |
| Local cache of direct | Script stores the closure | Hot-path reuse; **no** runtime short-name hang API |

`[LuaAlias]` / XML is a **rename** on methodTable (replaces the default key); full-signature keys pick which overload.

## Mono / Il2Cpp Support

| Runtime | Support |
|---------|:-------:|
| Mono (Editor) | ✅ |
| Il2Cpp (Player) | ✅ |

## Related

- [LuaAlias guide](/docs/guides/lua-alias/)
- [Method overload guide](/docs/guides/overloads/)
- [Method overload spec](/docs/spec/04-METHOD-OVERLOAD/) §5
- [LuaAlias source](https://github.com/focus-creative-games/zlua/blob/main/Runtime/Common/LuaAliasAttribute.cs)
