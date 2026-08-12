---
sidebar_position: 1
title: "Official Lua (PUC-Rio) build"
---

# Build — Official Lua (PUC-Rio 5.1.x–5.5.x)

> This document defines how ZLua integrates **PUC-Rio Lua** on **Editor (Mono)** and **Il2Cpp Player**.
> For LuaJIT, see [02-LUAJIT.md](/docs/spec/build/02-LUAJIT/).
> For package layout, Install pipeline, defines, and `ZLuaConf.inc`, see [11-MULTI-VERSION.md](/docs/spec/11-MULTI-VERSION/).
> This document does not change Lua-visible interop semantics.

---

## 1. Comparison with LuaJIT (summary)

| | **PUC-Rio (this doc)** | **LuaJIT** ([02-LUAJIT.md](/docs/spec/build/02-LUAJIT/)) |
|--|------------------------|----------------------------------------------------------|
| Settings id | `lua-{major}.{minor}.{patch}` (e.g. `lua-5.5.0`) | `luajit-{major}.{minor}` |
| Source cache | `LuaSrcCache/{id}/` (may auto-download) | Manual clone |
| Editor | `Plugins` series dynamic libraries (e.g. `lua53.dll`) + **callback gate** | `luajit21.dll` etc. + **callback gate** |
| Il2Cpp | **Full compilable `src/`** into `libil2cpp/lua` (multi-platform) | **Headers only** + developer-supplied `.a`; **Android / iOS only** |
| FastMT | Enabled for ≥5.3.2; otherwise see matrix | Forced `0` |
| WebGL / desktop Il2Cpp | ✅ (WebGL etc.) | ❌ |

**Principles (shared by both engines):**

- **Editor** loads Plugins dynamic libraries via `DllImport`.
- On **Il2Cpp**, `zlua-runtime` calls `lua_*` directly; the PUC path provides symbols by compiling sources into `libil2cpp`.

---

## 2. Why sources can go straight into `libil2cpp/lua`

PUC-Rio is a portable pure-C library: no host codegen and no architecture-specific VM object files. After Install copies `src/`, Unity/Il2Cpp recursively compiles `libil2cpp/**/*.c` (excluding interpreter entry sources).

---

## 3. Install behavior (summary)

1. Resolve `luaVersionId`; if the cache is missing, download from `https://www.lua.org/ftp/`.
2. For **5.3+** (including 5.3.0/5.3.1), apply `ZLua~/patches/lua/...` by floor (FastMT / VM, etc.); **do not** apply VM patches for **5.1 / 5.2**.
3. Copy the processed `src/` to `Local.../libil2cpp/lua`.
4. Remove standalone entries: `lua.c`, `luac.c`, `print.c` (if present).
5. Write / force `ZLUA_FAST_METATABLE` per the matrix; for 5.1/5.2, adapt `luaconf` for Il2Cpp lump as needed.
6. Write Scripting Defines (`ZLUA_LUA_5_1` … `ZLUA_LUA_5_5`) and `ZLuaConf.inc`.

For details and the patch floor algorithm, see [11-MULTI-VERSION.md](/docs/spec/11-MULTI-VERSION/) §3 and §5.

---

## 4. Editor dynamic libraries

| API-family macro | Logical name | Windows example |
|------------------|--------------|-----------------|
| `ZLUA_LUA_5_1` | `lua51` | `Plugins/x64/lua51.dll` |
| `ZLUA_LUA_5_2` | `lua52` | `lua52.dll` |
| `ZLUA_LUA_5_3` | `lua53` | `lua53.dll` |
| `ZLUA_LUA_5_4` | `lua54` | `lua54.dll` |
| `ZLUA_LUA_5_5` | `lua55` | `lua55.dll` |

If a DLL is missing, Install **warns but does not fail**. After switching series, you must **restart the Editor**.
Editor and Player patch versions need not match exactly, but the API family must match the current Define.

The Editor **must** use the native callback gate ([03-MONO-LUAJIT-CALLBACK-GATE.md](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/)); same protocol as LuaJIT.

---

## 5. Il2Cpp platform surface

Once sources are in-tree, any Unity Il2Cpp target (including **Android / iOS / WebGL / desktop**, etc.) builds through the normal Unity flow; there is no extra “bring your own `.a`” requirement.

---

## 6. Checklist (example: `lua-5.4.8`)

- [ ] Settings `luaVersionId` is correct; run Install
- [ ] `Local.../libil2cpp/lua` contains full library sources and no `lua.c`/`luac.c`
- [ ] Matching `lua54.dll` (or OS equivalent) is under `Plugins`; restart Editor
- [ ] Define is `ZLUA_LUA_5_4` (no `ZLUA_USE_LUAJIT`)
- [ ] When FastMT is required, confirm patch version ≥ 5.3.2 and patches applied

---

## 7. Division of labor with other docs

| Document | Content |
|----------|---------|
| [11-MULTI-VERSION.md](/docs/spec/11-MULTI-VERSION/) | UPM layout, Install order, patch floor, Defines, DLL logical names, `ZLuaConf.inc` |
| **This doc** | PUC-Rio Editor DLL and Il2Cpp **sources-in-tree** build shape |
| [02-LUAJIT.md](/docs/spec/build/02-LUAJIT/) | LuaJIT headers + static library model |
