---
sidebar_position: 2
title: Installation
description: Install ZLua via UPM, configure the Lua version, and finish local Install.
---

# Installation

This page uses the official sample project [zlua-demo](https://github.com/focus-creative-games/zlua-demo) as the canonical reference; paths point at its `main` branch.

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
| Unity | See [Compatibility](/docs/getting-started/compatibility/) (2021.3 / 2022.3 / Unity 6 including 6000.5 / Tuanjie, etc.) |
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
| **Lua Version Id** | Lua / LuaJIT version id; **default `lua-5.5.0`** (empty → this default) |
| **MarshalAs Xml Paths** | Optional; MarshalAs XML paths — see [LuaMarshalAs](/docs/spec/marshal/02-MARSHAL-AS/) |
| **Unity Optimizations** | On by default. Field notes: [Settings](/docs/guides/settings/); current effect: [Unity optimizations](/docs/getting-started/unity-optimizations/) |

**`luaVersionId` formats** (aligned with [Multi-version](/docs/spec/11-MULTI-VERSION/)):

| Kind | Format | Examples |
|------|------|------|
| PUC-Rio | `lua-X.Y.Z` | `lua-5.1.5`, `lua-5.2.4`, `lua-5.3.6`, `lua-5.4.8`, `lua-5.5.0` |
| LuaJIT | `luajit-M.N` | `luajit-2.1` (clone sources into the cache yourself; **Il2Cpp only Android / iOS** — see [LuaJIT build](/docs/spec/build/02-LUAJIT/)) |

After changing version, run **Install** again; if Editor native DLLs / scripting defines change with the series, **restart the Editor** as Console prompts.

### 3. Local install (`ZLua/Install...`)

Menu **`ZLua/Install...`** runs `LocalInstaller` and builds a compilable Il2Cpp + Lua + ZLua tree in the project. **Main steps:**

1. **Copy `libil2cpp` (and related Il2Cpp data) from the Editor install into the project**, and apply in-package `libil2cpp` patches
2. **Download (or reuse cache) the selected Lua sources** into local **`libil2cpp/lua`**
3. **Copy package `ZLua~/zlua-runtime` to local `libil2cpp/zlua`**
4. Write scripting defines, `ZLuaConf.inc`, etc., and run integrity checks

PUC-Rio source cache is typically under `Library/ZLua/LuaSrcCache/` (e.g. `lua-5.5.0/`). Path conventions: [Multi-version](/docs/spec/11-MULTI-VERSION/).

:::warning Install is required
Without Install, builds fail (prompting `ZLua/Install...`). **`ZLua/Generate/All` also requires the local tree to exist.**
:::

### 4. Layout (Lua scripts)

Recommended layout (same as Demo):

```
YourProject/
├── Assets/
│   ├── Bootstrap.cs              # Init entry
│   └── Editor/
│       └── SyncLuaScriptsToStreamingAssets.cs   # Sync scripts before Player build
├── LuaScripts/                   # Editor Lua sources (*.lua)
│   └── app.lua
├── Packages/
│   └── manifest.json
├── ProjectSettings/
│   └── ZLua.asset                # Settings (includes luaVersionId)
└── StreamingAssets/              # Generated at build
    └── LuaScripts/
        └── app.lua.txt           # Loaded by Player
```

**Why two script paths?**

- **Editor**: Demo loads from project-root `LuaScripts/*.lua` for easy edit/debug (see [Bootstrap.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs)).
- **Player**: Loads from `StreamingAssets/LuaScripts/*.lua.txt`; the `.txt` suffix avoids Unity TextAsset import conflicts.

### 5. Sync Lua to StreamingAssets (required for Player)

Copy Demo’s [SyncLuaScriptsToStreamingAssets.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Editor/SyncLuaScriptsToStreamingAssets.cs) into `Assets/Editor/`.

- Runs automatically via `IPreprocessBuildWithReport` before Player builds
- Menu **Tools → Sync LuaScripts To StreamingAssets** for manual sync

### 6. Bootstrap init

Minimal entry (from [Bootstrap.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs)):

```csharp
using System.IO;
using System.Text;
using UnityEngine;
using ZLua;

public class Bootstrap : MonoBehaviour
{
    private static string LoadLuaModule(string module)
    {
#if UNITY_EDITOR
        string path = Path.Combine(Application.dataPath, "..", "LuaScripts", module + ".lua");
#else
        string path = Path.Combine(
            Application.streamingAssetsPath, "LuaScripts", module + ".lua.txt");
#endif
        return File.Exists(path) ? File.ReadAllText(path, Encoding.UTF8) : null;
    }

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    private static void InitZLuaOnStartup()
    {
        LuaAppDomain.Initialize(LoadLuaModule);
    }
}
```

`LoadLuaModule` signature: `Func<string, object>`; argument is the **module name** (no path or extension); return Lua source string, or `null` if missing.

### 7. Verify install

1. Confirm **Settings** (correct version) and **Install** (Console shows Install succeeded)
2. Create [Demo.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Demo.cs) and [app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua)
3. In Bootstrap, call `app.main` via `GetFunction` and Play (`GetFunction` must be after `Initialize`, e.g. in `Awake`)
4. Console should print `lua main start` and follow-up test logs

---

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

- [5-minute Quick start](/docs/getting-started/quick-start/)
- [Guides · Install & Lua versions](/docs/guides/install/) (progressive main path)
- [Hello interop](/docs/guides/hello-interop/)
- [Multi-version](/docs/spec/11-MULTI-VERSION/)
- [Supported versions & platforms](/docs/getting-started/compatibility/)
