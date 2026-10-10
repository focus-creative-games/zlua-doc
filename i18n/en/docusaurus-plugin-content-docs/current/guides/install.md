---
sidebar_position: 1
title: Install and Lua versions
description: Add ZLua via UPM, pick a Lua version in Settings, and finish local Install.
---

# Install and Lua versions

The Guides start here: install the package, pick a Lua version, then continue to [Initialize and minimal interop](/docs/guides/hello-interop/). For UPM details and Demo path mapping, see [Getting started · Installation](/docs/getting-started/installation/).

## Three things to finish

1. Add `com.code-philosophy.zlua` to the project
2. Menu **`ZLua/Settings...`** — choose **Lua Version Id** (default **`lua-5.5.0`**)
3. Menu **`ZLua/Install...`** — generate the local `libil2cpp` + Lua + `zlua` tree

:::warning
The package does **not** ship a full `libil2cpp` / Lua source tree. Builds fail without Install; **`ZLua/Generate/All` also requires the local tree.**
:::

When using **HybridCLR** as a second package: install `com.code-philosophy.hybridclr` (v9.0.0+) and `com.code-philosophy.zlua` (1.0.0+), then run **`HybridCLR/Installer` first** and **`ZLua/Install` second**. See [HybridCLR integration](/docs/guides/hybridclr/).

## 1. Add the package

Edit `Packages/manifest.json`:

```json
{
  "dependencies": {
    "com.code-philosophy.zlua": "https://github.com/focus-creative-games/zlua.git"
  }
}
```

You can also pin a version tag, e.g. `#v0.0.1-alpha.2`. For a first try, clone [zlua-demo](https://github.com/focus-creative-games/zlua-demo) directly.

## 2. Pick a Lua version (`ZLua/Settings...`)

Open Project Settings → **ZLua** (writes `ProjectSettings/ZLua.asset`).

| Field | Notes |
|------|------|
| **Enable** | Whether ZLua is enabled |
| **Lua Version Id** | Lua / LuaJIT version id; empty defaults to **`lua-5.5.0`** |
| **MarshalAs Xml Paths** | Optional; MarshalAs XML for **non–hot-update** precompiled assemblies (hot-update assemblies use Attributes only) — see [LuaMarshalAs](/docs/guides/lua-marshal-as/) |
| **Lua Alias Xml Paths** | Optional; method rename XML for **non–hot-update** assemblies (`ZLuaAlias`; hot-update uses `[LuaAlias]` only) — see [LuaAlias](/docs/guides/lua-alias/) |
| **Lua Extension Xml Paths** | Optional; Extension mapping XML for **non–hot-update** types (`ZLuaExtensions`; hot-update uses `[LuaExtension]` only) — see [Extension methods](/docs/guides/extension-methods/) |

**`luaVersionId` formats:**

| Kind | Format | Examples |
|------|------|------|
| PUC-Rio | `lua-X.Y.Z` | `lua-5.1.5`, `lua-5.2.4`, `lua-5.3.6`, `lua-5.4.8`, `lua-5.5.0` |
| LuaJIT | `luajit-M.N` | `luajit-2.1` (clone sources yourself; **Il2Cpp is Android / iOS only**) |

After changing versions you must **Install** again; if Editor DLLs / scripting defines change with the series, **restart the Editor** per Console prompts. Platform/version matrix: [Compatibility](/docs/getting-started/compatibility/); multi-version details: [Multi-version management](/docs/spec/11-MULTI-VERSION/). Third-party C modules (socket / cjson, etc.) must be rebuilt for the **same series** — see [Third-party native modules](/docs/guides/native-modules/).

## 3. Local Install (`ZLua/Install...`)

Install mainly:

1. Copies the Editor’s `libil2cpp` into the project and patches it
2. Downloads (or reuses cache) the selected Lua sources into local **`libil2cpp/lua`**
3. Copies package `ZLua~/zlua-runtime` to **`libil2cpp/zlua`**
4. Writes scripting defines, `ZLuaConf.inc`, etc., and validates

PUC-Rio caches usually live under `Library/ZLua/LuaSrcCache/` (e.g. `lua-5.5.0/`).

## 4. Script directories (set up now; next page uses them)

Match the Demo layout:

- **Editor:** project root `LuaScripts/*.lua`
- **Player:** `StreamingAssets/LuaScripts/*.lua.txt` (Sync before build)

Directory tree, Sync script, and asmdef notes: [Installation](/docs/getting-started/installation/).

## Verify

1. Settings version is correct; Install log succeeds
2. Project compiles; next page uses `Initialize` + minimal interop to confirm Play has output

## FAQ

| Symptom | Fix |
|------|------|
| Package fetch fails | Check Git / network; or use a local `file:` path |
| Prompted that Install is missing | Run `ZLua/Install...`; re-run after Unity / Lua version changes |
| Lua download fails | Check `luaVersionId` and network; see [Multi-version management](/docs/spec/11-MULTI-VERSION/) |
| Broken after switching series | **Restart the Editor** per logs |

## Learning path

| | |
|---|---|
| **Previous** | [Quick start](/docs/getting-started/quick-start/) |
| **Next** | [HybridCLR integration](/docs/guides/hybridclr/) |

## Related

- [HybridCLR integration](/docs/guides/hybridclr/) — dual-package workflow and Installer order
- [Getting started · Installation](/docs/getting-started/installation/) — UPM, Bootstrap template, full directory tree
- [Compatibility](/docs/getting-started/compatibility/)
- [LuaJIT build](/docs/spec/build/02-LUAJIT/)
- [Multi-version management](/docs/spec/11-MULTI-VERSION/)
