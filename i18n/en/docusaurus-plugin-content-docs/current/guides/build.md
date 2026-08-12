---
sidebar_position: 3
title: Build workflow
description: Generate, Lua Sync, and a release checklist for Il2Cpp Player.
---

# Build workflow

Editor (Mono) Play does not need per-type C# Wrap; before shipping an **Il2Cpp Player** you must finish Generate and Lua sync. Semantics follow [Editor vs Player](/docs/guides/editor-vs-player/).

## Pre-release checklist

| Step | What to do |
|------|--------|
| 1 | [Install](/docs/guides/install/) is done (local `libil2cpp` / Lua / zlua tree exists) |
| 2 | Menu **`ZLua/Generate/All`** (generates C++ stubs, **not** C# Wrap) |
| 3 | Sync `LuaScripts` to `StreamingAssets/LuaScripts/*.lua.txt` |
| 4 | Build Settings → **Il2Cpp** → target platform |
| 5 | Device / package smoke: Initialize, interop, do not use deprecated Event APIs |

## Generate

- Menu: **`ZLua/Generate/All`**
- Depends on: local Install tree already present
- Effect: generates Il2Cpp bridge stubs; re-run after changing public APIs or switching Lua series
- Day-to-day Editor iteration does **not** require Generate every time

## Sync Lua to StreamingAssets

The Player-side loader reads `StreamingAssets`, not the project-root `LuaScripts`.

1. Copy Demo’s [SyncLuaScriptsToStreamingAssets.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Editor/SyncLuaScriptsToStreamingAssets.cs) into `Assets/Editor/`
2. It runs automatically before build via `IPreprocessBuildWithReport`; or use menu **Tools → Sync LuaScripts To StreamingAssets**
3. Convention: `app` → `StreamingAssets/LuaScripts/app.lua.txt` (`.txt` avoids import conflicts)

Submodule paths may use dots: `battle.ai` → `LuaScripts/battle/ai.lua` (loader uses `module.Replace('.', '/')`). Details: [C# calling Lua · Module loading](/docs/guides/csharp-calling-lua/#module-loading).

## Editor vs Player (differences only)

| | Editor (Mono) | Player (Il2Cpp) |
|--|---------------|-----------------|
| Lua-visible semantics | **Same** as Player | **Same** as Editor |
| Implementation | Expression Emit, etc. | C++ stub + native |
| Generate | Not required | **Required** |
| Script paths | `LuaScripts/*.lua` | `StreamingAssets/.../*.lua.txt` |

Use **Player** for performance comparisons.

## Common failures

| Symptom | Fix |
|------|------|
| Prompted that Install is missing | [Install](/docs/guides/install/) first |
| No Lua output on Player / module not found | Sync missing or wrong path/extension |
| Editor OK, Player crashes | Generate missing; or deprecated Event sugar still in use |
| Broken after Unity / Lua version change | Re-run Install → Generate |

## Learning path

| | |
|---|---|
| **Previous** | [Init & minimal interop](/docs/guides/hello-interop/) |
| **Next** | [EmmyLua debugger](/docs/guides/debugger/) |

## Related

- [EmmyLua debugger](/docs/guides/debugger/) — breakpoint debugging in the Editor
- [Editor vs Player](/docs/guides/editor-vs-player/)
- [Project status](/docs/getting-started/project-status/)
- [Troubleshooting](/docs/guides/troubleshooting/)
- [Compatibility](/docs/getting-started/compatibility/)
