---
sidebar_position: 14
title: "Settings"
---

# 14 — Settings

> Field contract for Project Settings → **ZLua**. Asset: `ProjectSettings/ZLua.asset`.
> Menu **`ZLua/Settings...`** opens the same page. Usage: [Settings (guide)](/docs/guides/settings/).

---

## 1. Storage

| Item | Rule |
|------|------|
| Type | `ZLua.Settings` (`ScriptableSingleton`) |
| Path | `ProjectSettings/ZLua.asset` |
| Missing fields | Fields not yet serialized in the asset use C# field initializers (`bool` is `false`, references are `null`) |
| When it takes effect | Editor writes immediately. Il2Cpp bindings that depend on XML are baked at **`ZLua/Generate/All`**; re-Generate after changing XML paths or the Unity optimizations switch |

---

## 2. Fields

| Field | Type | Default | Meaning |
|------|------|------|------|
| `enable` | `bool` | `true` | Whether ZLua is enabled. Whether the current build target is enabled: `Settings.EnableForCurrentBuildTarget` |
| `luaVersionId` | `string` | `lua-5.5.0` | PUC-Rio: `lua-X.Y.Z`; LuaJIT: `luajit-M.N`; Luau ([`luau` branch](https://github.com/focus-creative-games/zlua/tree/luau)): `luau-M.N` (e.g. `luau-0.743`). Empty string means **`lua-5.5.0`**. Details: [11-MULTI-VERSION.md](/docs/spec/11-MULTI-VERSION/) |
| `marshalAsXmlPaths` | `string[]` | empty | MarshalAs XML files or directories (relative to the project root or absolute). Root element `ZLuaMarshalAs`. See [marshal/02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/) |
| `luaAliasXmlPaths` | `string[]` | empty | LuaAlias XML files or directories. Root element `ZLuaAlias`. See [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §5.4 |
| `luaExtensionXmlPaths` | `string[]` | empty | LuaExtension XML files or directories. Root element `ZLuaExtensions`. See [13-EXTENSION-METHODS.md](/docs/spec/13-EXTENSION-METHODS/) |
| `enableUnityOptimizations` | `bool` | `true` | Master switch for Unity optimizations. When off, the package’s Unity optimization XML is **not** loaded. Current contents: [15-UNITY-OPTIMIZATIONS.md](/docs/spec/15-UNITY-OPTIMIZATIONS/). Later Unity optimizations hang on **this same switch**, not per-API switches |
| `enableDebugger` | `bool` | `false` | **Editor Mono only**: inject EmmyLua `emmy_core` after `Initialize`. See [build/04-EMMYLUA-DEBUGGER.md](/docs/spec/build/04-EMMYLUA-DEBUGGER/) |
| `debuggerPort` | `int` | `9966` | EmmyLua `tcpListen` port |
| `debuggerWaitIDE` | `bool` | `false` | When `true`, `dbg.waitIDE()` blocks the Unity main thread until the IDE attaches |

The three XML path lists are **only** for non–hot-update assemblies. Hot-update assemblies use the matching Attribute and are not written into these XML files.

---

## 3. Load order

Editor Mono and Il2Cpp Generate read the path lists above. When `enableUnityOptimizations == true`, package files are inserted **before** the user lists (see §15). The same `(assembly, type, method, signature)` appearing twice in Alias or MarshalAs → **load fails**.
