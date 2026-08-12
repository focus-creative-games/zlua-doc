---
sidebar_position: 12.5
title: LuaAlias
description: "[LuaAlias] renaming and XML (luaAliasXmlPaths / ZLuaAlias)."
---

# LuaAlias

Give a C# method a **final Lua-side key name** (**rename**, not “default name plus an extra alias”). When an alias exists, that method is **no longer** registered under `MethodInfo.Name`. A single candidate is **direct** (O(1)), suitable for hot paths.

Authoritative: [Overload Spec §5](/docs/spec/04-METHOD-OVERLOAD/). Compare with other overload strategies in [Method overloads](/docs/guides/overloads/).

## When to use

| Scenario | Approach |
|------|------|
| You can edit C#; hot path wants a short name + colon | **`[LuaAlias]`** |
| Cannot change source (precompiled DLL) | Settings **`luaAliasXmlPaths`** + `ZLuaAlias` XML |
| Cannot change C#; temporary runtime name | `zlua.register_method` (see [Overloads](/docs/guides/overloads/)) |
| Exact pick; syntax does not matter | Full-signature key `demo['Run(System.Int32)'](demo, 5)` |

## `[LuaAlias]` attribute

```csharp
using ZLua;

public class Demo
{
    [LuaAlias("run_i32")]
    public void Run(int value) { }

    public void Run(string value) { }
}
```

```lua
local demo = CSharp.AC.Demo()
demo:run_i32(10)    -- 命中 Run(int)；该方法不再挂名为 "Run"
demo:Run("hi")      -- 仅剩 Run(string) 等未换名的重载 → 此处为 direct 或 dispatch
```

| Item | Notes |
|----|------|
| Target | **Method** only |
| Per method | At most one alias (`AllowMultiple = false`) |
| Inheritance | Does **not** inherit to subclass overrides |
| Semantics | **Replaces** the default Lua name; does not append |

### Name collisions (allowed)

An alias may match another method’s default name or another alias → they join the same overload group and calls use **dispatch**:

```csharp
public void Foo(int x) { }

[LuaAlias("Foo")]           // Bar 换名为 Foo，并入 "Foo" 组；不再挂 "Bar"
public void Bar(string s) { }

[LuaAlias("print")]
public void LogA(int x) { }

[LuaAlias("print")]         // 两个 print → dispatch
public void LogB(string s) { }
```

```lua
d:Foo("hi")     -- 组内选 Bar(string)
d:print(1)      -- 组内选 LogA(int)
-- d:Bar("x")   -- 不可用
```

Static methods live on the type table: `Demo.add_i32(...)`; instance methods use colon: `obj:run_i32(...)`.

## XML configuration

Separate from `[LuaMarshalAs]`:

| | Alias | MarshalAs |
|--|-------|-----------|
| Settings field | **`luaAliasXmlPaths`** | `marshalAsXmlPaths` |
| Root element | **`ZLuaAlias`** | `ZLuaMarshalAs` |
| Files | **Separate files** | Separate files |

```xml
<?xml version="1.0" encoding="utf-8"?>
<ZLuaAlias version="1">
  <Assembly name="Assembly-CSharp">
    <Type fullName="Demo">
      <Method name="Run" signature="(System.Int32)" alias="run_i32"/>
    </Type>
    <Type fullName="MyGame.UI.Panel">
      <Method name="Show" signature="()" alias="show_panel"/>
    </Type>
  </Assembly>
</ZLuaAlias>
```

| Attribute | Notes |
|------|------|
| `Assembly/@name` | Assembly short name (e.g. `Assembly-CSharp`) |
| `Type/@fullName` | CLR full name; nested `Outer+Inner` |
| `Method/@name` | C# method name |
| `Method/@signature` | **Parameters only**: `()` / `(System.Int32)`; byref add `&`; **no** return type |
| `Method/@alias` | **Required**; the method’s sole final Lua name |

This file **only** allows `Assembly` → `Type` → `Method` with `@alias`. Do not write `MarshalAs` / `Param` / `Return`, etc.

### Precedence and platforms

- Same method: **Attribute > XML** (Attribute present → ignore XML for that slot)
- **Mono**: reads `luaAliasXmlPaths` at runtime
- **Il2Cpp**: Generate writes static tables; **Player does not read XML** (re-Generate after XML changes)
- Multiple `@alias` for the same `(assembly, type, method, signature)` → **fail**

In Project Settings → **ZLua**, put XML paths in **`luaAliasXmlPaths`** (alongside the MarshalAs path list).

## vs full-signature keys / `register_method`

| Approach | Notes |
|------|------|
| Full-signature key | Automatic at Bind; default name unchanged; `demo['Run(System.Int32)'](demo, 5)` |
| `[LuaAlias]` / XML | **Rename** at Bind; preferred short colon names on hot paths |
| `register_method` | At runtime, hang an existing direct onto a **vacant** short name; does not merge overloads |

## Common mistakes

| Symptom | Cause |
|------|------|
| `demo:Run(10)` misses an aliased overload | Already renamed; use the alias or another un-renamed overload |
| `demo:Bar` is nil | `Bar` was renamed by `[LuaAlias("Foo")]` |
| XML ignored (Player) | Did not re-**Generate**; or path was put under `marshalAsXmlPaths` |
| Same root element as MarshalAs | Needs a separate `ZLuaAlias` file |

## Learning path

| | |
|---|---|
| **Previous** | [Method overloads](/docs/guides/overloads/) |
| **Next** | [Extension methods](/docs/guides/extension-methods/) |

## Related

- [Method overloads](/docs/guides/overloads/)
- [Overload Spec §5](/docs/spec/04-METHOD-OVERLOAD/)
- [LuaAlias reference](/docs/reference/csharp/lua-alias/)
- [Extension methods](/docs/guides/extension-methods/) (another XML scheme: `ZLuaExtensions`)
- [LuaMarshalAs](/docs/guides/lua-marshal-as/) (another XML scheme; do not mix)
