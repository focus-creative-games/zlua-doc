---
sidebar_position: 12
title: Method overloads
description: Default dispatch, full-signature keys, LuaAlias, and register_method short names.
---

# Method overloads

Lua has no static types, so same-name multiple signatures cannot be chosen at compile time. ZLua provides: default dispatch, **full-signature keys** (automatic at Bind), `[LuaAlias]`, and `register_method` short names. See: [Demo.Run](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Demo.cs), [app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua).

Day-to-day `demo:Run(10)` is enough in [Lua calling C#](/docs/guides/lua-calling-csharp/); read this page for ambiguity or hot paths. Authoritative details: [Overload Spec](/docs/spec/04-METHOD-OVERLOAD/).

## How to choose

| Approach | Syntax | When |
|------|------|--------|
| Default dispatch | `demo:Run(10)` | Arguments uniquely match |
| **Full-signature key** (automatic) | `demo['Run(System.Int32)'](demo, 5)` | Exact pick; **no** `register_method` needed |
| `[LuaAlias]` | `demo:run_i32(5)` | You can edit C#; short name on hot paths |
| `register_method` | After register: `demo:run_i32(5)` | Cannot edit C#; still want short name + **colon** |

## Default dispatch

```lua
demo:Run(10)        -- Run(int)
demo:Run("hello")   -- Run(string)
```

Zero dispatch when there is only one public overload; with multiple, match by arguments.

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

## Full-signature keys (auto-registered on name conflicts)

When the same method name has multiple overloads (e.g. `Run(int)` / `Run(string)`), besides the `Run` dispatch, Bind also hangs a **direct** key for each candidate:

`MethodName(parameter Type.FullName, …)` (**no** return type):

| Key | Meaning |
|----|------|
| `Run` | Runtime dispatch |
| `Run(System.Int32)` | Fixed `Run(int)` |
| `Run(System.String)` | Fixed `Run(string)` |

```lua
-- 精确调用，不必 register_method
demo['Run(System.Int32)'](demo, 5)
demo['Run(System.String)'](demo, "hi")
```

Keys contain parentheses, so you **cannot** write `demo:Run(System.Int32)(...)`; use bracket keys + dot + explicit `self`.

## `[LuaAlias]`

```csharp
[LuaAlias("run_i32")]
public void Run(int value) { }

public void Run(string value) { }
```

```lua
demo:run_i32(10)    -- 短名 + 冒号，O(1)；Run(int) 已换名，不再挂 "Run"
demo:Run("hi")      -- 未换名的 Run(string)
```

An alias is a **rename** (replaces the default Lua key), not an append. XML (`luaAliasXmlPaths` / `ZLuaAlias`) and more examples: [LuaAlias](/docs/guides/lua-alias/). C# extensions on the instance table: [Extension methods](/docs/guides/extension-methods/).

## `register_method`: short name + colon

Full-signature keys already allow exact calls, but the syntax is verbose. `register_method` hangs a **direct closure** onto an unused short name; then you can use colon:

```lua
local run_i32 = demo['Run(System.Int32)']
zlua.register_method("run_i32", run_i32)

-- 好处：短名进入 method 表，之后直接
demo:run_i32(5)
```

Two-argument form (per [05-LIB](/docs/spec/05-LIB/)): `zlua.register_method(aliasName, directClosure)`.
If `aliasName` already exists (including `Run`, full-signature keys, other aliases) → error; no overwrite.

You can also take a closure from a `[LuaAlias]` key and hang another custom name.

## Common mistakes

| Symptom | Fix |
|------|------|
| Wrong overload / `ambiguous` | Full-signature key, `[LuaAlias]`, or `register_method` short name; watch default-parameter tie-break |
| `argument mismatch` (with defaults) | Required formals not supplied; cannot skip middle parameters |
| Want `demo['(System.Int32)']` | **Forbidden**; must include the method name: `Run(System.Int32)` |
| `register_method` says already taken | Pick an unused alias; do not overwrite `Run` / existing full-signature keys |

## Learning path

| | |
|---|---|
| **Previous** | [0GC Marshal](/docs/guides/zero-gc-marshal/) |
| **Next** | [LuaAlias](/docs/guides/lua-alias/) |

## Related

- [LuaAlias guide](/docs/guides/lua-alias/) — Attribute + XML deep dive
- [Method overload Spec](/docs/spec/04-METHOD-OVERLOAD/) §3.7, §5, §6
- [Common zlua library](/docs/guides/zlua-lib/)
