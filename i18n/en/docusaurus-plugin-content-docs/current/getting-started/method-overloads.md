---
sidebar_position: 3
title: Method overloads (getting started)
description: Same-name signatures match by arguments by default; use a full-signature key or Bind-time alias to pick one.
---

# Method overloads (getting started)

When several signatures share a name, ZLua matches by arguments by default. Use a full-signature key or a Bind-time alias when you need an explicit pick.

## Why this page

Lua has no compile-time overload selection. For C# `Run(int)` and `Run(string)`, the script either relies on runtime matching or names one signature explicitly.

## Default (prefer this)

```lua
demo:Run(10)        -- Run(int)
demo:Run("hello")   -- Run(string)
```

Multiple candidates use **dispatch**; a single public candidate is **direct** (no dispatch).

## Exact pick

```lua
demo['Run(System.Int32)'](demo, 10)
```

Keys with parentheses need bracket indexing and an **explicit `self`**. The method name is CLR `MethodInfo.Name` (not a `[LuaAlias]` short name).

## Colon + short name

Annotate with `[LuaAlias("run_i32")]` (or Alias XML); after Bind you can call `demo:run_i32(10)`. There is **no** runtime API to hang short names. See [LuaAlias](/docs/guides/lua-alias/).

## Next

Default parameters, lazy full-signature caching, and troubleshooting: [Method overloads (guide)](/docs/guides/overloads/).
