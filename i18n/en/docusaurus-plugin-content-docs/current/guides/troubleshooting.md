---
sidebar_position: 90
title: Troubleshooting
description: Diagnose common ZLua issues and fixes (appendix).
---

# Troubleshooting

Appendix. During development you can iterate quickly in the **Editor (Mono)**; for Player issues first confirm **`ZLua/Generate/All`** and [Compatibility](/docs/getting-started/compatibility/). Start the mainline from [Install](/docs/guides/install/).

Canonical project: [zlua-demo](https://github.com/focus-creative-games/zlua-demo)

---

## Install and startup

### No Lua output at all after Play

| Check | Notes |
|--------|------|
| `LuaAppDomain.Initialize` | Must use `[RuntimeInitializeOnLoadMethod(BeforeSceneLoad)]` or earlier |
| Console filters | Confirm `Log` is not hidden |

### `module 'xxx' not found`

| Check | Editor | Player |
|--------|--------|--------|
| File path | `{ProjectRoot}/LuaScripts/xxx.lua` | `StreamingAssets/LuaScripts/xxx.lua.txt` |
| Sync | Optional | Sync script is **required** |

---

## Type and member access

### Assembly / type not found

- No longer silently returns `nil`: errors look like `zlua: assembly not found: …` / `zlua: type not found: …`
- Check assembly name / alias (`CSharp['AC'] = CSharp['Assembly-CSharp']`)
- Namespaced types need `CSharp.AC['Ns.Type']`

### `zlua: member not found: Type.key`

- Spelling, whether `public`, whether statics were accessed on an instance (or vice versa)
- Whether extension methods are configured on that type (see [Extension](/docs/guides/extension-methods/))
- To probe whether a key exists: use **`rawget`** or `pcall`; **do not** rely on `__index` returning `nil`

### Event `.get` / `.set` is nil

Deprecated. Use `add_OnX` / `remove_OnX`. See [Event](/docs/guides/lua-calling-csharp/).

---

## EmmyLua debugging

Breakpoints miss, cannot connect, Play freezes: see [EmmyLua debugger](/docs/guides/debugger/) (`sourcePaths`, port, `waitIDE`).

---

## C# calling Lua

### `GetFunction` ineffective

- Has `LuaAppDomain.Initialize` run?
- Do module / method match Lua `return { ... }` keys?
- Does the Lua module `return { method = ... }`?
- Just after `Reset`: old delegates are invalid — re-`GetFunction`

### Second `Initialize` throws

When a main `lua_State` already exists, use `LuaAppDomain.Reset(loader)`; you **cannot** call `Initialize` again to “swap loader only”. See [LuaAppDomain](/docs/reference/csharp/lua-app-domain/).

---

## Editor OK, Player fails

| Check | Notes |
|------|------|
| Generate | Il2Cpp must Generate C++ stubs |
| StreamingAssets | Was Lua Synced? |
| Deprecated APIs | Do not use Event `.get` |

---

## Learning path

| | |
|---|---|
| **Previous** | [Migration](/docs/guides/migration/) |
| **Next** | [Editor vs Player](/docs/guides/editor-vs-player/) |

## Related

- [FAQ](/docs/community/faq/)
- [EmmyLua debugger](/docs/guides/debugger/)
- [Editor vs Player](/docs/guides/editor-vs-player/)
