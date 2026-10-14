---
sidebar_position: 12
title: Method overloads
description: Default dispatch, lazy full-signature keys and caching, and LuaAlias short names.
---

# Method overloads

Lua has no static types, so same-name multiple signatures cannot be chosen at compile time. ZLua provides: default dispatch, **full-signature keys** (lazy resolution on `__index` miss, then cached), Bind-time **`[LuaAlias]` / XML** short names, and **local caching** of direct closures in scripts. See: [Demo.Run](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Demo.cs), [app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua).

Short intro: [Method overloads (getting started)](/docs/getting-started/method-overloads/). Day-to-day `demo:Run(10)` is enough in [Lua calling C#](/docs/guides/lua-calling-csharp/); read this page for ambiguity or hot paths. Authoritative details: [Overload Spec](/docs/spec/04-METHOD-OVERLOAD/).

Open generic methods (`GetComponent<T>`, etc.) are not an overload problem — see [Generics](/docs/guides/generics/).

## How to choose

| Approach | Syntax | When |
|------|------|--------|
| Default dispatch | `demo:Run(10)` | Arguments uniquely match |
| **Full-signature key** (lazy) | `demo['Run(System.Int32)'](demo, 5)` | Pick one overload exactly; first access resolves on miss and caches as direct |
| `[LuaAlias]` / XML | `demo:run_i32(5)` | You can edit C# or XML; hot path needs **colon + short name** |
| Local direct cache | `local run = demo['Run(System.Int32)']; run(demo, 5)` | Same fixed overload in a tight loop |

After Bind, there is **no** runtime API to attach new short names; colon + short name is Bind-time alias only.

## Default dispatch

```lua
demo:Run(10)        -- Run(int)
demo:Run("hello")   -- Run(string)
```

With a single public overload, the short name is **direct** (zero dispatch); with multiple, you get **dispatch** matched by arguments.

## Default parameters

C# **trailing** optional formals (`HasDefault`) are supported. Lua arg count may fall in `[minArity, maxArity]`; omitted trailing formals are filled with C# defaults at invoke (cached at Bind; hot path does not parse metadata blobs).

```csharp
public static int Foo(int x, int y = 5) => x + y;
public static string Bar(string s, int a = 1, int b = 2) => $"{s}:{a},{b}";
public static int G(int x) => x;
public static int G(int x, int y = 5) => x + y;
```

```lua
Demo.Foo(1)          -- y=5
Demo.Foo(1, 9)
Demo.Bar("hi")       -- a=1, b=2
Demo.Bar("hi", 7)    -- b=2
Demo.G(1)            -- pick G(int), not the “expand defaults” G(int,int)
Demo.G(1, 4)         -- G(int, int)
```

| Rule | Notes |
|------|-------|
| Trailing contiguous defaults only | Same as C#: cannot “skip” a required formal in the middle |
| Too few args | Cannot cover the first non-default formal → `argument mismatch` / no matching overload |
| Multi-overload tie-break | When conversion scores tie, the candidate that **uses fewer defaults** wins |
| Constructors | `Type(...)` / `SMT.__call` support the same rules |

Authoritative details: [Overload Spec](/docs/spec/04-METHOD-OVERLOAD/) §3.3.

## Full-signature keys (lazy resolution)

Bind does **not** pre-hang `MethodName(Type.FullName,…)` keys for every method. On metatable access, if the method table misses and the key is a string containing `(`, ZLua looks up by signature on the type and base-class chain, builds a **direct** closure, **caches** it, and returns it.

| Item | Notes |
|------|-------|
| Key format | `MethodName(parameter Type.FullName,…)`, **no** return type; name is CLR `MethodInfo.Name` (not a `[LuaAlias]` short name) |
| Scope | **Any** public instance/static method (including single-candidate; aliased methods still use CLR name in the key) |
| Excluded | Instance constructors and static `.cctor` — construction stays on type-table `__call` |
| vs short name | Does not change existing `Run` direct/dispatch; adds signature-key entries only |

With multiple overloads, short `Run` stays dispatch; full-signature keys bypass dispatch:

| Key | Meaning |
|----|------|
| `Run` | Runtime dispatch (when multiple candidates) |
| `Run(System.Int32)` | Fixed `Run(int)` (cached after first bracket-key access) |
| `Run(System.String)` | Fixed `Run(string)` |

```lua
demo['Run(System.Int32)'](demo, 5)
demo['Run(System.String)'](demo, "hi")
-- Single candidate works too: demo['GetValue()'](demo)

-- Hot path: after first miss the key is cached; keep a local
local run_i32 = demo['Run(System.Int32)']
run_i32(demo, 20)
```

Keys contain parentheses, so you **cannot** write `demo:Run(System.Int32)(...)`; use bracket keys + dot + explicit `self`. For **colon + short name**, configure `[LuaAlias]` in C# or XML (next section).

Use `zlua.signature(...)` to build the parameter parenthesis part; see [Overload Spec](/docs/spec/04-METHOD-OVERLOAD/) §4.1.

## `[LuaAlias]`

```csharp
[LuaAlias("run_i32")]
public void Run(int value) { }

public void Run(string value) { }
```

```lua
demo:run_i32(10)    -- short name + colon, direct; Run(int) renamed, default "Run" not registered for it
demo:Run("hi")      -- Run(string) not renamed → dispatch
```

An alias is a **rename** (replaces the default Lua key), not an append. XML (`luaAliasXmlPaths` / `ZLuaAlias`) and more examples: [LuaAlias](/docs/guides/lua-alias/). C# extensions on the instance table: [Extension methods](/docs/guides/extension-methods/).

## Common mistakes

| Symptom | Fix |
|------|------|
| Wrong overload / `ambiguous` | Full-signature key, `[LuaAlias]`, or cache a direct closure locally; watch default-parameter tie-break |
| `argument mismatch` (with defaults) | Required formals not supplied; cannot skip middle parameters |
| Want `demo['(System.Int32)']` | **Forbidden**; must include the method name: `Run(System.Int32)` |
| Full-signature key `member not found` | Check CLR method name and `Type.FullName` against metadata; constructors are not full-signature keys |
| Want runtime short-name registration | Not supported; use Bind-time `[LuaAlias]` / XML, or bracket keys + local cache |

## Learning path

| | |
|---|---|
| **Previous** | [0GC Marshal](/docs/guides/zero-gc-marshal/) |
| **Next** | [LuaAlias](/docs/guides/lua-alias/) |

## Related

- [Method overloads (getting started)](/docs/getting-started/method-overloads/)
- [LuaAlias guide](/docs/guides/lua-alias/) — Attribute + XML deep dive
- [Generics](/docs/guides/generics/) — open generic methods (not overloads)
- [Method overload Spec](/docs/spec/04-METHOD-OVERLOAD/) §3.7, §5, §6
- [Common zlua library](/docs/guides/zlua-lib/)
