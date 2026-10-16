---
sidebar_position: 1.2
title: Settings
description: Project Settings → ZLua fields, where they live, and when to re-run Generate.
---

# Settings

**`ZLua/Settings...`** opens **Project Settings → ZLua**. Values are stored in `ProjectSettings/ZLua.asset`. Field contract: [14-SETTINGS](/docs/spec/14-SETTINGS/).

## Fields

| UI | What it does |
|------|--------|
| **Enable** | When off, ZLua is not enabled for the current build target |
| **Lua Version Id** | An id such as `lua-5.5.0` or `luajit-2.1`. Changing it requires a new **Install** — see [Install and Lua versions](/docs/guides/install/) |
| **MarshalAs Xml Paths** | Marshal rules for assemblies you cannot edit. See [LuaMarshalAs](/docs/guides/lua-marshal-as/) |
| **Lua Alias Xml Paths** | Same idea, for method renames. See [LuaAlias](/docs/guides/lua-alias/) |
| **Lua Extension Xml Paths** | Same idea, for attaching extension methods to a target type. See [Extension methods](/docs/guides/extension-methods/) |
| **Unity Optimizations** | On by default. Enables Unity API optimizations shipped in the package; currently `GetComponent`. See [Unity optimizations](/docs/guides/unity-optimizations/) |
| **Enable Debugger** | Editor only. EmmyLua — see [Debugger](/docs/guides/debugger/) |
| **Debugger Port** | Default `9966` |
| **Debugger Wait IDE** | When checked, blocks the main thread until the IDE attaches |

Do **not** use the three XML path lists for hot-update assemblies; use Attributes there.

After changing MarshalAs / Alias / Extension paths, or toggling **Unity Optimizations**, the next Editor initialize loads the new lists. Before an Il2Cpp build, run **`ZLua/Generate/All`** again.
