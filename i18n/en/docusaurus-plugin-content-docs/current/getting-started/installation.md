---
title: Installation
description: Install ZLua via UPM, configure the Lua version, and finish local Install.
---

# Installation

This page uses the official sample project [zlua-demo](https://github.com/focus-creative-games/zlua-demo) as the canonical reference; paths point at its `main` branch.

:::info Scope
This page describes the unified integration package in the specification. Older standalone packages and other branches need their matching version instructions. Do not mix Installer workflows. See [Multi-version specification](/docs/spec/11-MULTI-VERSION/).
:::

## Overview

ZLua ships as a Unity Package (UPM). **After adding the package you must still complete local Install** (the package does not carry a full `libil2cpp` / Lua source tree). Typical flow:

1. Add `com.code-philosophy.zlua` in `Packages/manifest.json`
2. Menu **`ZLua/Settings...`** — pick a Lua version (default **`lua-5.5.0`**)
3. Menu **`ZLua/Install...`** — finish local install
4. Configure the Lua script directory and `LoadLuaModule`; call `LuaAppDomain.Initialize` at startup
5. Before shipping Il2Cpp, run **`ZLua/Generate/All`** (C++ stubs, not C# Wrap)

:::info Runtime
**Mono (Editor) and Il2Cpp (Player) are both done**, with matching Lua-visible semantics. Multi-version details: [Multi-version](/docs/spec/11-MULTI-VERSION/), [Project status](/docs/getting-started/project-status/).
:::

## Prerequisites

| Item | Requirement |
|----|------|
| Unity | See the maintained LTS versions in [Compatibility](/docs/getting-started/compatibility/). |
| Scripting Backend | Editor: **Mono**; Player: **Il2Cpp** |
| Lua | Chosen in **Settings** (default **`lua-5.5.0`**); downloaded / installed into the local tree at Install |
| Network | Needed on first Install to download PUC-Rio sources; LuaJIT must be cloned yourself, and Il2Cpp shipping is Android / iOS only (see [Multi-version](/docs/spec/11-MULTI-VERSION/), [LuaJIT build](/docs/spec/build/02-LUAJIT/)) |
| Git | Required when installing UPM from a Git URL |

---

## Option 1: Clone the Demo (recommended first try)

```bash
git clone https://github.com/focus-creative-games/zlua-demo.git
```

Open the project with any Unity version listed under [Compatibility](/docs/getting-started/compatibility/), then still run **Settings → Install** below (if the Demo has not finished local install). Play `SampleScene`. Key files:

| File | Notes |
|------|------|
| [Packages/manifest.json](https://github.com/focus-creative-games/zlua-demo/blob/main/Packages/manifest.json) | UPM deps, including the ZLua Git URL |
| [Assets/Bootstrap.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs) | Init and `GetFunction` |
| [Assets/Demo.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Demo.cs) | C# types called from Lua |
| [LuaScripts/app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua) | Main Lua module |

---

## Option 2: Install ZLua in an existing project

### 1. Add the UPM dependency

Edit `Packages/manifest.json` and add under `dependencies`:

```json
{
  "dependencies": {
    "com.code-philosophy.zlua": "https://github.com/focus-creative-games/zlua.git"
  }
}
```

You can pin a branch / tag, for example:

```json
"com.code-philosophy.zlua": "https://github.com/focus-creative-games/zlua.git#v0.0.1-alpha.2"
```

After save, Unity Package Manager pulls automatically. Package id is `com.code-philosophy.zlua` (see [zlua/package.json](https://github.com/focus-creative-games/zlua/blob/main/package.json)).

### 2. Configure Lua version (`ZLua/Settings...`)

Menu **`ZLua/Settings...`** opens Project Settings → **ZLua** (asset at `ProjectSettings/ZLua.asset`).

| Field | Notes |
|------|------|
| **Enable** | Whether ZLua is enabled |
| **Lua Version Id** | Lua / LuaJIT / Luau version id; **default `lua-5.5.0`** (empty → this default) |
| **MarshalAs Xml Paths** | Optional; MarshalAs XML paths — see [LuaMarshalAs](/docs/spec/marshal/02-MARSHAL-AS/) |
| **Unity Optimizations** | On by default. Field notes: [Settings](/docs/guides/settings/); current effect: [Unity optimizations](/docs/guides/unity-optimizations/) |

**`luaVersionId` formats** (aligned with [Multi-version](/docs/spec/11-MULTI-VERSION/)):

| Kind | Format | Examples |
|------|------|------|
| PUC-Rio | `lua-X.Y.Z` | `lua-5.1.5`, `lua-5.2.4`, `lua-5.3.6`, `lua-5.4.8`, `lua-5.5.0` |
| LuaJIT | `luajit-M.N` | `luajit-2.1` (clone sources into the cache yourself; **Il2Cpp only Android / iOS** — see [LuaJIT build](/docs/spec/build/02-LUAJIT/)) |
| [Luau](https://luau.org/) | `luau-M.N` | `luau-0.743` (official [`luau` branch](https://github.com/focus-creative-games/zlua/tree/luau) only; Editor is Windows only. Install shallow-clones that tag from [luau-lang/luau](https://github.com/luau-lang/luau) and builds **Windows x64** static libraries. See [Compatibility](/docs/getting-started/compatibility/)) |

After changing version, run **Install** again; if Editor native DLLs / scripting defines change with the series, **restart the Editor** as Console prompts.

### 3. Local Install (`ZLua/Install...`)

The unified Installer creates the HybridCLR base (`il2cpp_plus` + `hybridclr/`), applies ZLua patches, copies `ZLua~/zlua-runtime`, and installs the selected Lua engine. It writes defines and `ZLuaConf.inc`, validates the result, and owns `UNITY_IL2CPP_PATH`. **Do not add the standalone `com.code-philosophy.hybridclr` UPM package.**

`ZLua/Generate/All` runs StripAOT once, then HybridCLR MethodBridge and ZLua CodeGenerator in sequence. For hot-update XML, load the assembly and register metadata before first type binding; see [InteropMetadata](/docs/reference/csharp/interop-metadata/).

PUC-Rio sources are cached in `Library/ZLua/LuaSrcCache/`. See the [Install specification](/docs/spec/11-MULTI-VERSION/).

### 4. Script layout

```text
YourProject/
├── Assets/
│   ├── Bootstrap.cs
│   ├── Editor/SyncLuaScriptsToStreamingAssets.cs
│   └── StreamingAssets/LuaScripts/app.lua.txt   # Generated before build
├── LuaScripts/app.lua                          # Editor source
├── Packages/manifest.json
└── ProjectSettings/ZLua.asset
```

### 5. Player script loading

Follow [First Player build](/docs/getting-started/build/) for script synchronization and the Player loader. The Editor reads project-root `LuaScripts`; Player loading depends on the target platform and project resource system.

### 6. Verify installation

Once Install succeeds and the project compiles, follow [Quick start](/docs/getting-started/quick-start/) for complete minimal files and expected Console output.

## Assembly Definition notes

- The ZLua Package ships asmdefs (`ZLua.Common`, `ZLua.Mono`, `ZLua.Il2Cpp`, etc.); you **do not** need to reference native plugins manually.
- Your game script assembly (e.g. `Assembly-CSharp`) references `ZLua` to use `LuaAppDomain`, `GetFunction`, etc.
- From Lua, access types under that assembly via `CSharp['Assembly-CSharp']` (or alias `CSharp.AC`).

## Common install issues

| Symptom | Cause | Fix |
|------|------|------|
| Package fetch fails | Network / Git missing | Check Git URL; or use a local path: `"file:../../zlua"` |
| Build says not Installed | Didn’t run `ZLua/Install...` or local tree stale | Run Install; re-run after Unity / Lua version changes |
| Install fails downloading Lua | Network or invalid version id | Check `luaVersionId`; see [Multi-version](/docs/spec/11-MULTI-VERSION/) cache rules |
| No Lua output after Play | `Initialize` not called or wrong module path | Confirm `BeforeSceneLoad` ran; ensure `LoadLuaModule` returns non-null |
| Player can’t find scripts | StreamingAssets not synced | Run Sync menu or rebuild |
| `Assembly-CSharp` type not found | Script not compiled or wrong namespace | Put Demo types in global namespace or fix Lua path |
| Oddities after changing Lua series | Editor DLL / defines not applied | **Restart Editor** per Install logs |

## Mono / Il2Cpp support

| Step | Mono (Editor) | Il2Cpp (Player) |
|------|:-------------:|:---------------:|
| UPM install | ✅ | ✅ |
| Settings + Install | ✅ | ✅ (local tree for Player builds) |
| `LuaAppDomain.Initialize` | ✅ | ✅ |
| `LuaAppDomain.Reset` | ✅ | ✅ |
| `GetFunction<T>` | ✅ | ✅ |
| Full Lua↔C# API | ✅ | ✅ (same semantics; different implementation paths) |

## Next steps

- [Quick start](/docs/getting-started/quick-start/)
- [AI Skills](/docs/guides/skills/) — point a coding agent at the package skills
- [Hello interop](/docs/getting-started/quick-start/)
- [Multi-version](/docs/spec/11-MULTI-VERSION/)
- [Supported versions & platforms](/docs/getting-started/compatibility/)
