---
sidebar_position: 7
title: "Multi-version management"
---

# 11 — Multi-version management (Unity / Lua / install)

> The package does **not** ship a full `libil2cpp` tree; Install overlays **patch + zlua-runtime + chosen Lua** onto the current Unity stock sources.
> This document is the implementation spec for UPM package layout, `LocalInstaller`, Lua version switching, native DLL naming, and Il2Cpp **`ZLuaConf.inc` / Compatible headers** (§12).
> Lua-visible semantics remain governed by other specs in this directory; this document does not change interop semantics.

---

## 1. Goals and non-goals

### 1.1 Goals

| Goal | Notes |
|------|-------|
| **Upgradeable Unity** | Do not ship a full `libil2cpp` per Unity version |
| **Switchable Lua sources** | Settings pick a version; PUC-Rio downloads from lua.org into a local cache; LuaJIT is manually cloned |
| **Editor DLLs by series** | Logical name `lua5{minor}` (e.g. `lua53`); binaries are replaced by developers |
| **Auditable changes** | Modifications to upstream (Unity `libil2cpp`, PUC-Rio / LuaJIT) exist as **patch files** |
| **Visible failures** | On patch context mismatch or missing sources, Install **fails with an error**; silent skip is forbidden |

### 1.2 Non-goals (this phase)

| Item | Notes |
|------|-------|
| Hot-swap already-loaded native DLLs in the same Editor process | On Windows, loaded DLLs cannot be reliably overwritten; after changing series DLLs, **restart the Editor** |
| Ship Editor DLLs for every source patch version | Editor development does not require patch-level precision; replace `luaXX.dll` when needed |
| Generate and reference C# sources inside a read-only Package | UPM cache is read-only; `LUA_DLL` maps only by **API-family macros** (§8) |
| Deliver every historical Lua / Unity combination at once | First ship the primary combos (§10), then add patches / source dirs as needed |

---

## 2. In-package layout (`ZLua~`)

Authoritative package data root: `Packages/com.code-philosophy.zlua/ZLua~`.

```
ZLua~/
├── zlua-runtime/              # ZLua native; copied to libil2cpp/zlua at Install
│   ├── ZLuaCommon.h           # Assemble Compatible + define ZLUA_LUA_VERSION
│   ├── LuaCompatible.h        # Multi Lua / LuaJIT API shim (hand-written)
│   ├── Il2CppCompatible.h     # Multi Unity / Tuanjie il2cpp API shim (hand-written)
│   └── generated/
│       └── ZLuaConf.inc       # Written by Install/Generate (macros only; §12)
├── patches/
│   ├── libil2cpp/
│   │   ├── 2021.3/
│   │   │   └── 2021.3.0.patch     # Covers 2021.3.x (shared-range minimum version)
│   │   ├── 2022.3/
│   │   │   └── 2022.3.0.patch     # Covers 2022.3.x; add 2022.3.N.patch at breakpoints
│   │   ├── 6000.5/                # Unity 6000.5.x (preferred over 6000/ fallback)
│   │   │   └── 6000.5.6.patch
│   │   └── 6000/                  # Unity 6: try 6000.{minor}/ first, then fall back here
│   │       └── 6000.0.0.patch
│   └── lua/
│       ├── lua-5.1/
│       │   ├── 5.1.0.patch        # Covers 5.1.0–5.1.1; gettable FastMT + Win32 ANSI loadlib
│       │   └── 5.1.2.patch        # Covers 5.1.2–5.1.5
│       ├── lua-5.2/               # 5.2.0 / 5.2.1 / 5.2.2 / 5.2.4 floors (see in-package README)
│       ├── lua-5.3/               # See in-package README; includes 5.3.0…5.3.3 floors
│       └── lua-5.4/
│           ├── 5.4.0.patch        # Covers 5.4.0… until the next floor file
│           ├── 5.4.4.patch        # Shared ranges keep only the minimum version filename
│           └── 5.4.7.patch
├── lualib/
└── link.xml
```

Lua / LuaJIT upstream sources are **not** shipped in the package. Install writes them into the project-local cache:

```
Library/ZLua/LuaSrcCache/
├── downloads/                 # Optional: keep .tar.gz
├── lua-5.5.0/                 # Downloaded and extracted from lua.org
├── lua-5.4.8/
├── lua-5.2.4/
├── lua-5.1.5/
└── luajit-2-1/                # Developer clones manually (no auto-download)
```

Cache directory name `LuaSrcCache` is fine; a hierarchical `Library/ZLua/cache/lua` is equivalent if preferred (implementation follows `CommonDirs.LuaSrcCacheDir`).

### 2.1 Directory / version-id naming

| Kind | Rule | Example |
|------|------|---------|
| Settings / PUC-Rio id | `lua-{major}.{minor}.{patch}` | `lua-5.5.0` |
| PUC-Rio download URL | `https://lua.org/ftp/lua-{ver}.tar.gz` | `https://lua.org/ftp/lua-5.5.0.tar.gz` |
| PUC-Rio cache dir | Same as id | `LuaSrcCache/lua-5.5.0/` |
| Settings / LuaJIT id | `luajit-{major}.{minor}` | `luajit-2.1` |
| LuaJIT cache dir | `luajit-{major}-{minor}` (developer clone) | `LuaSrcCache/luajit-2-1/` |
| Settings / Luau id | `luau-{major}.{minor}` (official [`luau` branch](https://github.com/focus-creative-games/zlua/tree/luau)) | `luau-0.743` |
| Luau cache dir | Same as id; Install shallow-clones the matching tag from [luau-lang/luau](https://github.com/luau-lang/luau) | `LuaSrcCache/luau-0.743/` |
| Lua patch dir | `patches/lua/lua-{major}.{minor}/` | `patches/lua/lua-5.4/` |
| Lua patch file | Only `{major}.{minor}.{patch}.patch` (**no** `default.patch`); shared ranges keep only the minimum version filename | `5.4.0.patch` / `5.4.4.patch` / `5.4.7.patch` |
| Unity patch dir | `patches/libil2cpp/{major}.{minor}/`; Unity 6 may also fall back to `patches/libil2cpp/{major}/` | `2022.3/`, `6000/` |
| Unity patch file | Only `{major}.{minor}.{patch}.patch` (**no** `default.patch`); shared ranges keep only the minimum version filename | `2022.3.0.patch` / `6000.0.0.patch` |

**Lua / Unity patch selection (floor, same rule):** within the chosen series directory, take the **largest** `{X.Y.Z}.patch` whose version is **≤** the current product version; a file whose name matches the current version (or the version with letter suffixes stripped) is a fast hit of that rule. Apply failure → Install fails (do not silently pick another file).
**Authoring / maintenance:** if several patch versions can share one patch body, **keep only the minimum version number file for that shared range**. **`default.patch` is forbidden** (both Lua and libil2cpp).
**Unity series directories:** try `{major}.{minor}/` first (e.g. `2022.3/`, `6000.3/`), then for Unity 6 (`major >= 6000`) fall back to `{major}/` (e.g. `6000/`); **after the directory is chosen**, apply floor file selection inside it.

**Forbidden** to place a full `libil2cpp-{unity}` tree or a full upstream Lua source tree under `ZLua~` as an install source.

### 2.2 Dev-time source of truth

| Content | Edit during development | Land in package |
|---------|-------------------------|-----------------|
| `zlua` C++ | `build-win64/.../libil2cpp/zlua` | Sync to `ZLua~/zlua-runtime` |
| Lua upstream | Install downloads to `Library/ZLua/LuaSrcCache` (not in package) | Only `patches/lua` |
| Changes to Unity `libil2cpp` | `patches/libil2cpp` | Do **not** commit a full libil2cpp tree |

---

## 3. Install pipeline (`LocalInstaller`)

Install output root: `Library/ZLua/LocalIl2CppData-{platform}/` (paths per `CommonDirs`).

### 3.1 Order (required)

1. Resolve Settings `luaVersionId` (empty → default `lua-5.5.0`; see §6.2)
2. **Ensure Lua sources in `Library/ZLua/LuaSrcCache`**: reuse if cached; PUC-Rio missing → download from lua.org; LuaJIT missing → fail and prompt for manual clone; Luau ([`luau` branch](https://github.com/focus-creative-games/zlua/tree/luau)) missing → shallow-clone the matching tag
3. Copy official Editor `il2cpp` (including **stock** `libil2cpp`) into the Local directory
4. Resolve and apply **libil2cpp patches** (§4)
5. **Copy/overwrite** `ZLua~/zlua-runtime` onto `Local.../libil2cpp/zlua`
6. Install the chosen Lua from cache into `Local.../libil2cpp/lua`: **PUC-Rio** copy (and patch per §5) into a buildable `src/`; **LuaJIT** installs public headers only (see [build/02-LUAJIT.md](/docs/spec/build/02-LUAJIT/)); **Luau** installs public headers and links Win64 static libraries (§5.2); ensure `ZLUA_FAST_METATABLE` matches §5.4 / §12.5
7. Write project **Scripting Define Symbols** (§7)
8. Write **`ZLuaConf.inc`** (§12; authoritative output under Local `libil2cpp/zlua/generated/`)
9. If the package lacks the matching series Editor plugin DLL, **warn** (do not block Install); developers replace DLLs themselves (§8)
10. Write **install fingerprint** (§9)
11. Clear Il2Cpp / Bee caches; on series / Define changes, prompt to **restart the Editor**

### 3.2 Differences from old behavior

| Old | New |
|-----|-----|
| **Whole-directory replace** with packaged full `libil2cpp-*` | stock + patch + `zlua-runtime` |
| Lua sources shipped in package | **Not shipped**; `LuaSrcCache` + network download / manual clone |
| Full Unity trees embedded in package | Only `zlua-runtime` + `patches` |

---

## 4. libil2cpp patch selection

Changes to Unity stock `libil2cpp` should stay small (order of tens of hook lines) and always live as patch files.

### 4.1 Selection algorithm

Suppose current Unity is `2022.3.62f1` (compare as `2022.3.62` triplet, ignoring letter suffixes like `f1` / `t11`):

1. Try series directories in order: `{major}.{minor}/`, then if `major >= 6000` fall back to `{major}/` (e.g. `6000.3/` → `6000/`)
2. In the **first existing** series directory:
   - If an exact file exists (full version string / stripped `2022.3.62`, etc.) → **use it** (floor fast path)
   - Else among all `{major}.{minor}.{patch}.patch` files, take the **largest** whose version is **≤** `2022.3.62` (e.g. only `2022.3.0.patch` → use it)
3. No usable patch in any candidate directory → **Install fails**
4. Do **not** use `default.patch` anymore

After a file is chosen, apply failure → Install fails (must not silently switch to another file).

**Maintenance convention (same as Lua §5.3):** for consecutive Editor patch versions that can share one body, commit only the range’s **minimum** version-number file; when upstream context changes so the old floor no longer applies, add a new floor patch at that breakpoint.

### 4.1.1 Maintained series and deltas

| Directory | Baseline Editor (authoring reference) | Coverage | In-package floor file |
|-----------|----------------------------------------|----------|------------------------|
| `2021.3/` | 2021.3.45f2 | 2021.3.x | `2021.3.0.patch` (no `AnUnresolvedCallStubWasNotFound*`; provides **no-op** `return false`) |
| `2022.3/` | 2022.3.62f3 | 2022.3.x | `2022.3.0.patch` (real unresolved stub detection + `LuaAppDomain::Initialize`) |
| `6000.5/` | 6000.5.6f1 | **6000.5.x** | `6000.5.6.patch` (API deltas vs 6000.0, e.g. `GenericMethod.h`; runtime shims via `Il2CppCompatible.h`) |
| `6000/` | 6000.0.71f1 | **6000.0.x / 6000.3.x** (and fallback when no exact `6000.{minor}/`) | `6000.0.0.patch` (floor hit; prefer exact `6000.{minor}/` if present) |

### 4.2 Apply and validation

- Prefer unified diff; Install may `--check` / dry-run first
- After apply, do minimal validation (e.g. agreed hook symbols or anchor file content appear)
- Context drift (Unity patch-level edits around hooks) → fail; add a floor patch for that breakpoint (`{major}.{minor}.{patch}.patch`) or update the shared file

### 4.3 Boundary with `zlua-runtime`

| Ownership | Content |
|-----------|---------|
| `patches/libil2cpp` | Inserts / small edits to Unity’s existing `.cpp/.h` (init, compile lists, etc.) |
| `zlua-runtime` | ZLua’s own source tree; do **not** “stuff” large implementations by editing Unity files |

If `zlua-runtime` depends on internal APIs that vary with Unity / Lua, solve it with **§12 Compatible + conf** conditional compilation inside runtime — **do not** re-ship a full libil2cpp for that reason.

---

## 5. Lua sources and patches

### 5.1 Obtaining sources (not in the UPM package)

| Engine | Behavior |
|--------|----------|
| **PUC-Rio** | Reuse if `LuaSrcCache/{id}` already has a complete `src/`; else download `https://www.lua.org/ftp/{id}.tar.gz` and extract there |
| **LuaJIT** | Does **not** auto-download; developers clone sources into `LuaSrcCache/` (directory name per implementation, e.g. `luajit-2.1`). Il2Cpp does **not** copy the whole tree into `libil2cpp/lua`; see [build/02-LUAJIT.md](/docs/spec/build/02-LUAJIT/) |
| **Luau** ([`luau` branch](https://github.com/focus-creative-games/zlua/tree/luau)) | If the cache is missing, `git clone --depth 1 --branch {M.N}` from [luau-lang/luau](https://github.com/luau-lang/luau). Requires `git` on the machine |

For **series that support VM patches** (§5.2), ZLua’s VM changes live in-package under **`patches/lua`**; Install applies them to a clean tree in the cache.

### 5.2 Whether to apply Lua VM patches

| Settings / engine | Install applies `patches/lua`? | Written to `libil2cpp/lua` | `luaPatchKey` (fingerprint) |
|-------------------|--------------------------------|----------------------------|------------------------------|
| **PUC-Rio 5.1.x** | **Yes** (§5.3 floor; dir `patches/lua/lua-5.1/`) | Full buildable `src/` (entry files removed) | Actual `{X.Y.Z}.patch` filename chosen |
| **PUC-Rio 5.2.x** | **Yes** (§5.3 floor; dir `patches/lua/lua-5.2/`) | Full buildable `src/` (entry files removed) | Actual `{X.Y.Z}.patch` filename chosen |
| **PUC-Rio 5.3+** (including `lua-5.3.0` …) | **Yes** (§5.3 floor) | Full buildable `src/` (entry files removed) | Actual `{X.Y.Z}.patch` filename chosen |
| **LuaJIT** | **No** | **Public headers only**; static libs from developer Plugins ([build docs](/docs/spec/build/02-LUAJIT/)) | `none` |
| **Luau** ([`luau` branch](https://github.com/focus-creative-games/zlua/tree/luau)) | **No** | **Public headers only** (`lua.h` / `luaconf.h` / `lualib.h` / `luacode.h`). Install builds Win64 static libraries with CMake + Visual Studio 2022 and links them via `generated/LuauLink.inc`. `ZLUA_FAST_METATABLE` is 0. Scripting define: `ZLUA_USE_LUAU` | `none` |

Notes:

- **PUC-Rio 5.1+** (including 5.2.x) **must** apply the floor patch under the matching series directory; missing file or apply failure → Install fails.
- **LuaJIT** must **not** look up or apply series patches.
- On combinations without FastMT / without a VM patch, Install **must** ensure `ZLUA_FAST_METATABLE 0` (PUC writes local `luaconf.h`; LuaJIT writes into the installed headers’ `luaconf.h`; see §5.4).
- Fingerprint `luaPatchKey` is `none` when there is no patch (§9).
- Why LuaJIT cannot compile from a full in-tree source, and Il2Cpp platform surface (Android/iOS `.a`, WebGL disabled), follow **[build/02-LUAJIT.md](/docs/spec/build/02-LUAJIT/)**.

### 5.3 Patch selection algorithm (only series that “need patch” per §5.2)

Suppose Settings is `lua-5.4.8`, series directory `patches/lua/lua-5.4/`:

1. Ensure cache sources are available (§5.1)
2. List all `{major}.{minor}.{patch}.patch` in the series directory (ignore other filenames; leftover historical `default.patch` must not be chosen)
3. Among files with version **≤** `5.4.8`, pick the **largest** (e.g. `5.4.0` / `5.4.4` / `5.4.7` → `5.4.7.patch`; if `5.4.8.patch` exists, hit it directly)
4. No qualifying file, or apply fails → **Install fails** (no auto-downgrade to another series, and no fallback to a “greater” version patch)
5. Copy patched `src/` into `Local.../libil2cpp/lua`
6. Then validate / force `ZLUA_FAST_METATABLE` per §5.4

**Maintenance convention:** for consecutive patch versions that can share one body, commit only the range’s **minimum** version-number file; when upstream context changes so the old floor no longer applies, add a new floor patch at that breakpoint (still named with the new range’s minimum).

Do not bake IDE helper files (e.g. `.clangd`) into patches.

### 5.4 `ZLUA_FAST_METATABLE` (FastMT) support matrix

`ZLUA_FAST_METATABLE` is decided **only** by post-Install `libil2cpp/lua/luaconf.h` (§12.1); Il2Cpp runtime and Lua VM **must** compile with the same macro value.

| Engine / patch version | FastMT | Install / patch requirements |
|------------------------|--------|------------------------------|
| **PUC-Rio 5.1.0–5.1.5** | **May enable** (floors: `5.1.0` / `5.1.2`; hooks `luaV_gettable` / `luaV_settable`, **raw get first**) | **Must** apply `patches/lua/lua-5.1/` floor patch (includes `zlua_fastmt.*`, Table cache fields, Win32 ANSI `loadlib`) |
| **PUC-Rio 5.2.0–5.2.4** | **May enable** (floors: `5.2.0` / `5.2.1` / `5.2.2` / `5.2.4`; same gettable hooks + raw-first) | **Must** apply `patches/lua/lua-5.2/` floor patch (also opens `luai_num*` / `luai_hashnum` under Il2Cpp lump) |
| **PUC-Rio 5.3.0 / 5.3.1** | **May enable** (floor patch sets `1`; hooks `luaV_gettable` / `luaV_settable`, **raw get first**) | Apply series VM patch |
| **PUC-Rio ≥ 5.3.2** (including 5.3.3…5.3.6, 5.4.x, 5.5.x) | **May enable** (default `1` via corresponding floor patch; hooks `luaV_finishget` / `finishset`) | Apply series VM patch |
| **LuaJIT** | **Unsupported** (must be `0`) | Do **not** apply VM patch; Install headers only and inject `ZLUA_FAST_METATABLE 0`; `ZLuaCommon.h` may `#error` on `ZLUA_USE_LUAJIT && ZLUA_FAST_METATABLE` |

**Rationale summary:**

- **≥ 5.3.2**: FastMT hooks are **`luaV_finishget` / `finishset`**.
- **5.1.x / 5.2.x / 5.3.0 / 5.3.1**: no `finishget` / `finishset`; FastMT hooks **`luaV_gettable` / `luaV_settable`**. Implementations **must** `luaH_get` (raw) **first**, and only on miss take the sealed FastMT path (otherwise type-table fields such as `FullName` would be intercepted).
- **LuaJIT**: no PUC-Rio FastMT series patch; always legacy / Dispatch, macro fixed at `0`.

Manually overriding unsupported combos with `-DZLUA_FAST_METATABLE=1` → **undefined behavior**; Installer should write back `0` for unsupported combos.

### 5.5 Editor DLL vs Player

| Path | PUC-Rio | LuaJIT |
|------|---------|--------|
| **Il2Cpp Player** | Exact patch-version **sources** from cache into `libil2cpp/lua`; plus `patches/lua` when §5.2 requires | **Headers only** into `libil2cpp/lua`; **Android/iOS static `.a` provided by developer in Plugins** (see [build/02-LUAJIT.md](/docs/spec/build/02-LUAJIT/)) |
| **Editor (Mono)** | `Plugins/lua/<series>/` (e.g. `lua53/{lua53.dll,lua53.dylib}`); Mono does **not** implement FastMT | `Plugins/lua/luajit20/`, `luajit21/`; also needs [`zlua_mono_gate`](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/) (same dirs); Mono does **not** implement FastMT |

Editor and Player need not match patch number / build options bit-for-bit, but **API family and key macros** should align. Missing Editor native libs → Install **warns only**, does not block. Restart Editor after switching series.

**Shipped with this package’s Editor (current maintenance):**

| Series | Windows | macOS |
|--------|---------|-------|
| `lua51` … `lua55` | `.dll` | `.dylib` (universal preferred) |
| `luajit21` | `.dll` | `.dylib` |
| `luajit20` | `.dll` | `.dylib` (**x86_64 only**; upstream 2.0 has no arm64) |
| `zlua_mono_gate` | `Plugins/lua/zlua_mono_gate.dll` | `Plugins/lua/libzlua_mono_gate.dylib` (universal) |

Shipped EmmyLua debug libs: [build/04-EMMYLUA-DEBUGGER.md](/docs/spec/build/04-EMMYLUA-DEBUGGER/) (**`emmylua/luajit/` does not distinguish 2.0/2.1**).

**LuaJIT + Il2Cpp:** release surface is **Android / iOS only** (developer-provided static `.a`); Il2Cpp Player on Win / macOS / Linux / WebGL etc. is **unsupported**. Details: [build/02-LUAJIT.md](/docs/spec/build/02-LUAJIT/).

---

## 6. Settings: choosing a Lua version

| Field | Meaning |
|-------|---------|
| `luaVersionId` | e.g. `lua-5.4.8` / `luajit-2.1`; empty → §6.2 |

### 6.1 Obligations after change

Re-run Install after switching; prompt Editor restart when Define / series DLL changes. Il2Cpp packaging should block when not Installed or fingerprint mismatches.

### 6.2 Default version

- Field default / empty: fixed **`lua-5.5.0`**
- Install writes that default back if empty
- Download failure (e.g. official FTP has no such version) → Install fails and prompts to check the version id; must **not** silently switch to another major version

---

## 7. Scripting Define Symbols

Written by the Installer (or the same logic triggered by Settings save) into the **project** Defines — do **not** generate C# files inside a read-only Package.

### 7.1 Macro naming (must use `ZLUA_` prefix)

| Macro | When defined | Use |
|-------|--------------|-----|
| `ZLUA_USE_LUAJIT` | LuaJIT selected | Engine differences; with `ZLUA_LUAJIT_2_0` / `ZLUA_LUAJIT_2_1` chooses `luajit20` / `luajit21` |
| `ZLUA_LUAJIT_2_1` | `luajit-2.1` | Editor logical name `luajit21` |
| `ZLUA_LUAJIT_2_0` | `luajit-2.0` | Editor logical name `luajit20` |
| `ZLUA_LUA_5_5` | PUC-Rio 5.5.x (any patch) | **API family** + Editor DLL logical name `lua55` |
| `ZLUA_LUA_5_4` | PUC-Rio 5.4.x (any patch) | **API family** + Editor DLL logical name `lua54` |
| `ZLUA_LUA_5_3` | PUC-Rio 5.3.x (any patch) | **API family** + Editor DLL logical name `lua53` |
| `ZLUA_LUA_5_2` | PUC-Rio 5.2.x (any patch) | **API family** + Editor DLL logical name `lua52` |
| `ZLUA_LUA_5_1` | PUC-Rio 5.1.x (non-JIT) | **API family** + Editor DLL logical name `lua51` |

Notes:

- **No** need for exact patch macros like `ZLUA_LUA_5_4_7`: source patch version only affects the Install-copied tree and fingerprint, not `LUA_DLL` mapping.
- API-family macros carry the old discussion’s “`LUA_FEAT_5_4_X`” meaning, named `ZLUA_LUA_5_4` — **do not** use a confusing `_X` suffix.
- LuaJIT: define `ZLUA_USE_LUAJIT`, plus `ZLUA_LUAJIT_2_0` or `ZLUA_LUAJIT_2_1` by minor (aligned with `LuaDllName` / Plugins dirs).

### 7.2 Mutual exclusion

Only one “engine + API family / JIT minor” set at a time. Installer removes old `ZLUA_LUA_*` / `ZLUA_USE_LUAJIT` / `ZLUA_LUAJIT_2_*` before writing the new set for the current `luaVersionId`.

---

## 8. Native DLL naming and `LuaDllName` (by series)

### 8.1 Packaging policy

| Item | Rule |
|------|------|
| **Layout** | `Plugins/lua/<series>/` (PUC / LuaJIT) + `zlua_mono_gate*` in the same dirs (see [03](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/)) |
| **Ship granularity** | Optionally ship series libs; **developers may replace per series they use** |
| **Logical name (PUC)** | `lua` + `major` + `minor` → `lua51`…`lua55` (no patch digit) |
| **Logical name (LuaJIT)** | `luajit20` / `luajit21` (matches Settings `luajit-2.0` / `luajit-2.1`; **not** a vague `luajit`) |
| **Install** | **Warn** if missing; do not fail |

| Settings source id (examples) | API family / JIT macros | Editor logical name | Windows | macOS |
|-------------------------------|-------------------------|---------------------|---------|-------|
| `lua-5.1.5` | `ZLUA_LUA_5_1` | `lua51` | `lua51.dll` | `lua51.dylib` |
| `lua-5.2.4` | `ZLUA_LUA_5_2` | `lua52` | `lua52.dll` | `lua52.dylib` |
| `lua-5.3.6` / `lua-5.3.0` | `ZLUA_LUA_5_3` | `lua53` | `lua53.dll` | `lua53.dylib` |
| `lua-5.4.7` / `lua-5.4.1` | `ZLUA_LUA_5_4` | `lua54` | `lua54.dll` | `lua54.dylib` |
| `lua-5.5.0` | `ZLUA_LUA_5_5` | `lua55` | `lua55.dll` | `lua55.dylib` |
| `luajit-2.0` | `ZLUA_USE_LUAJIT` + `ZLUA_LUAJIT_2_0` | `luajit20` | `luajit20.dll` | `luajit20.dylib` (**x86_64 only**) |
| `luajit-2.1` | `ZLUA_USE_LUAJIT` + `ZLUA_LUAJIT_2_1` | `luajit21` | `luajit21.dll` | `luajit21.dylib` |

Switching source patch within a series (e.g. `5.4.1`→`5.4.7`) does **not** change `LUA_DLL` or Plugins filenames — only the embedded Il2Cpp source tree.
To use another build in the Editor, replace the matching files under `Plugins/lua/<series>/` (note Windows load locks; restart Editor).

EmmyLua debug module directory **`emmylua/luajit/`** differs from the Editor logical names above: 2.0/2.1 **share** one `emmy_core` (see [04](/docs/spec/build/04-EMMYLUA-DEBUGGER/)).

### 8.2 `LuaDllName.cs`

Standalone file (suggested path):

`Packages/com.code-philosophy.zlua/Runtime/Mono/Lvm/LuaDllName.cs`

Role: define `LUA_DLL` by **API family / JIT** only. `LuaDll.cs` only references that constant.

```csharp
namespace ZLua
{
    public static class LuaDllName
    {
#if UNITY_IPHONE && !UNITY_EDITOR
        public const string LUA_DLL = "__Internal";
#elif ZLUA_LUAJIT_2_1
        public const string LUA_DLL = "luajit21";
#elif ZLUA_LUAJIT_2_0
        public const string LUA_DLL = "luajit20";
#elif ZLUA_USE_LUAJIT
        public const string LUA_DLL = "luajit21";
#elif ZLUA_LUA_5_5
        public const string LUA_DLL = "lua55";
#elif ZLUA_LUA_5_4
        public const string LUA_DLL = "lua54";
#elif ZLUA_LUA_5_3
        public const string LUA_DLL = "lua53";
#elif ZLUA_LUA_5_2
        public const string LUA_DLL = "lua52";
#elif ZLUA_LUA_5_1
        public const string LUA_DLL = "lua51";
#else
        // Default matches Settings default lua-5.5.0 → series lua55.
        public const string LUA_DLL = "lua55";
#endif
    }
}
```

When adding a **series**: add series DLL, `LuaDllName` branch, API-family macro, and Installer mapping.
When adding a **source patch within a series**: only add `lua-versions` (and needed patches); **no** need to change `LuaDllName` or add Plugins filenames.

### 8.3 API trimming in `LuaDll.cs`

Enable/disable declarations by **API family / JIT** macros (may split files). Source patch differences do not enter `#if`.

### 8.4 Windows load locks

- After switching series (`lua53`↔`lua54`) or replacing an in-use same-named DLL, **restart the Editor**.
- Install must prompt restart when series or Defines change.

---

## 9. Fingerprint and reinstall

Fingerprint (JSON or equivalent key/value) must at least include:

| Field | Notes |
|-------|-------|
| `unityVersion` | `Application.unityVersion` at install time |
| `luaVersionId` | Actual source id used (including §6.2 default resolution) |
| `luaSeries` | e.g. `lua-5.3` / `lua-5.4` / `luajit` (for DLL comparison) |
| `libil2cppPatchKey` | Patch directory key actually chosen (exact or major) |
| `luaPatchKey` | Lua patch directory key actually chosen, or `none` |
| `packageContentStamp` | Package content change stamp (may evolve from existing max-mtime policy) |
| `defines` | Written `ZLUA_*` set (for diagnostics) |

Any of the following → `NeedReinstall` is true:

- Package content stamp changed
- Settings `luaVersionId` (or default resolution) mismatches fingerprint
- Current Unity version mismatches fingerprint
- Local tree missing

---

## 10. Phased support scope

| Phase | Scope |
|-------|-------|
| **P0** | Default `lua-5.5.0` + download cache + `lua-5.3` patch + Unity `2022.3` patch + `zlua-runtime` |
| **P1** | `lua-5.1.x` / `lua-5.2.x` (full patch-version FastMT + series patches) + `lua-5.4.x` / `lua-5.5.x` with matching series patches / DLLs |
| **P2** | LuaJIT (manual clone; Editor ✅; Il2Cpp **Android / iOS only**) |

---

## 11. Implementation checklist

- [ ] `ZLua~` has no full libil2cpp and no shipped Lua upstream sources
- [ ] PUC-Rio: download from `lua.org/ftp` on cache miss
- [ ] LuaJIT: only accept manual sources under `LuaSrcCache/luajit-{major}-{minor}`
- [ ] Default `luaVersionId` = `lua-5.5.0`
- [ ] Missing Plugins DLL warns only
- [ ] libil2cpp patch: floor (largest `{X.Y.Z}.patch` ≤ current), no `default.patch`; fail without downgrade
- [ ] lua patch: apply for PUC-Rio **5.1+** (including 5.2.x) (§5.2); only LuaJIT skips with `luaPatchKey=none`
- [ ] FastMT: all PUC-Rio 5.x may enable; only LuaJIT forces `ZLUA_FAST_METATABLE 0` (§5.4)
- [ ] Define / `LuaDllName` / fingerprint / restart prompts complete
- [ ] `LuaCompatible.h` / `Il2CppCompatible.h` / `ZLuaConf.inc` match §12
- [ ] Install writes Local `ZLuaConf.inc`; Generate/All validates or rewrites; stale silent use forbidden

---

## 12. Il2Cpp runtime compatibility layer (`ZLuaConf` / Compatible)

> This section constrains only the **Il2Cpp Player** native tree (`zlua-runtime`).
> **Editor Mono** continues to use §7 Scripting Defines + §8 `LuaDllName` and does **not** consume `ZLuaConf.inc`.

### 12.1 Design goals

Express version facts with three non-overlapping sources of truth:

| Source of truth | Expresses |
|-----------------|-----------|
| **Generated `ZLuaConf.inc`** | Engine family (JIT or not), Lua API family, Unity / Tuanjie version, reconciliation string |
| **Lua headers** (`LUA_VERSION_NUM`, etc.) | Official Lua numeric version; mapped to `ZLUA_LUA_VERSION` via `ZLuaCommon.h` |
| **`luaconf.h` (after Install + §5.4)** | **Sole** decider of `ZLUA_FAST_METATABLE` (conf / Compatible must **not** redefine); unsupported FastMT combos must be `0` |

### 12.2 File roles

| File | Nature | Role |
|------|--------|------|
| `zlua-runtime/generated/ZLuaConf.inc` | **Generated** | Macros only; no `#include`, no logic, do not hand-edit |
| `zlua-runtime/LuaCompatible.h` | Hand-written | Use conf if available → pick Lua headers (official `lua.hpp` / JIT `extern "C"`) → API shims (AbsIndex, IsInteger, NewUserData, PCall, etc.) |
| `zlua-runtime/Il2CppCompatible.h` | Hand-written | Tuanjie vs Unity il2cpp API diffs (e.g. `Calloc`); depends on engine macros in conf |
| `zlua-runtime/ZLuaCommon.h` | Hand-written | Assembles the above; `#define ZLUA_LUA_VERSION LUA_VERSION_NUM`; asserts / arch macros; **no longer** a dump of scattered compat details |
| `libil2cpp/lua/luaconf.h` | Upstream ± patch / Install force | Defines `ZLUA_FAST_METATABLE` (§5.4) |

**`ZLuaCommon.h` include order (convention):**

1. `generated/ZLuaConf.inc`
2. `LuaCompatible.h` (includes Lua headers and provides shims)
3. `Il2CppCompatible.h` (il2cpp headers + engine shims)
4. Then:

```c
#ifndef ZLUA_LUA_VERSION
#define ZLUA_LUA_VERSION LUA_VERSION_NUM
#endif

/* ZLUA_FAST_METATABLE must already be defined by luaconf.h */
#ifndef ZLUA_FAST_METATABLE
#error "ZLUA_FAST_METATABLE must be defined by lua/luaconf.h"
#endif
```

### 12.3 `ZLuaConf.inc` generated macros

| Macro | Values | Notes |
|-------|--------|-------|
| `ZLUA_USE_LUAJIT` | `0` \| `1` | Aligns with C# Scripting Define `ZLUA_USE_LUAJIT`; do **not** use old name `ZLUA_LUAJIT` |
| `ZLUA_LUA_API_FAMILY` | `501` / `502` / `503` / `504` / `505` … | API family: official from chosen series (5.1→501, 5.2→502, 5.3→503…); **LuaJIT convention `501`** (capability checks still prefer `ZLUA_USE_LUAJIT`) |
| `ZLUA_TUANJIE_ENGINE` | `0` \| `1` | `1` = Tuanjie engine, `0` = Unity |
| `ZLUA_UNITY_VERSION` | decimal integer | See §12.4; filled on both Unity and Tuanjie as the “Unity version line” encoding |
| `ZLUA_TUANJIE_VERSION` | `0` or decimal | **Fixed `0` on Unity**; on Tuanjie, Tuanjie engine version encoding (different from Unity) |
| `ZLUA_CONF_ID` | string literal | Logging / reconciliation, e.g. `"lua-5.3.8|unity-2021.3.45|tuanjie-0"` |

**Explicitly not generated:**

| Macro | Reason |
|-------|--------|
| `ZLUA_LUA_VERSION` | Mapped from `LUA_VERSION_NUM` in `ZLuaCommon.h`; not written into conf |
| `ZLUA_FAST_METATABLE` | Decided only by `luaconf.h`, keeping Table ABI aligned with the VM |

### 12.4 Numeric encoding rules

**No leading `0`** (C preprocessor treats as octal; digits `8`/`9` make it illegal).

| Macro | Encoding | Example |
|-------|----------|---------|
| `ZLUA_UNITY_VERSION` | `YYYY * 10000 + minor * 100 + patch` (minor/patch two digits each, usually &lt; 100) | `2021.3.45` → `20210345` |
| `ZLUA_TUANJIE_VERSION` | `major * 10000 + minor * 100 + patch` (same; `0` on Unity) | `1.9.3` → `10903` |
| `ZLUA_LUA_API_FAMILY` | `major * 100 + minor` (no patch) | `5.4` → `504`; JIT → `501` |

Comparison example: `#if ZLUA_UNITY_VERSION >= 20220300`.

Exact patch-version string reconciliation uses `ZLUA_CONF_ID` and Install fingerprint (§9) — **do not** use numeric macros as patch-level identity.

### 12.5 Capability-check priority

| Scenario | Writing |
|----------|---------|
| Is LuaJIT? | `#if ZLUA_USE_LUAJIT` |
| Official API family (5.3 vs 5.4…) | `#if !ZLUA_USE_LUAJIT && (LUA_VERSION_NUM >= 504)`, or `ZLUA_LUA_API_FAMILY >= 504` |
| Exact id reconciliation | `ZLUA_CONF_ID` / fingerprint |
| Tuanjie vs Unity API | `#if ZLUA_TUANJIE_ENGINE`, optionally with `ZLUA_UNITY_VERSION` / `ZLUA_TUANJIE_VERSION` |
| FastMT | `#if ZLUA_FAST_METATABLE` (from `luaconf.h` only); support surface in **§5.4** (all PUC-Rio 5.x may enable; only LuaJIT **must be 0**) |

Unsupported FastMT combos: Install **must** make `ZLUA_FAST_METATABLE` in `luaconf.h` be `0`. `ZLuaCommon.h` may `#error` on `ZLUA_USE_LUAJIT && ZLUA_FAST_METATABLE`.

### 12.6 Generation timing and authoritative path

| Step | Role |
|------|------|
| **`LocalInstaller` (authoritative)** | After every **successful** Install **must** write Local `libil2cpp/zlua/generated/ZLuaConf.inc`; content from Settings `luaVersionId`, `Application.unityVersion`, Tuanjie detection |
| **`ZLua/Generate/All` (validate)** | Rewrite or validate the same semantics; mismatch with Settings / fingerprint → **fail or force refresh**; silent use of stale conf forbidden |
| **Player build** | Recognizes **only** conf in the Local tree; in-package `ZLua~/zlua-runtime/generated` follows existing stub policy and is **not** the sole source of truth (UPM read-only may prevent writes) |

Editor side should centralize version encoding (suggested `EngineVersionUtil`, alongside `LuaVersionUtil`): Tuanjie detection, `ZLUA_UNITY_VERSION` / `ZLUA_TUANJIE_VERSION` / `ZLUA_CONF_ID` generation — avoid scattered parsers.

### 12.7 Examples

**Official Lua 5.3.8 + Unity 2021.3.45:**

```c
/* Generated by ZLua Install/Generate. Do not edit. */
#define ZLUA_USE_LUAJIT         0
#define ZLUA_LUA_API_FAMILY     503
#define ZLUA_TUANJIE_ENGINE     0
#define ZLUA_UNITY_VERSION      20210345
#define ZLUA_TUANJIE_VERSION    0
#define ZLUA_CONF_ID            "lua-5.3.8|unity-2021.3.45|tuanjie-0"
```

**LuaJIT 2.1 + Tuanjie (illustrative):**

```c
/* Generated by ZLua Install/Generate. Do not edit. */
#define ZLUA_USE_LUAJIT         1
#define ZLUA_LUA_API_FAMILY     501
#define ZLUA_TUANJIE_ENGINE     1
#define ZLUA_UNITY_VERSION      20220362
#define ZLUA_TUANJIE_VERSION    10903
#define ZLUA_CONF_ID            "luajit-2.1|unity-2022.3.62|tuanjie-1.9.3"
```

### 12.8 Mapping to Mono / C# Defines

| Il2Cpp (conf / headers) | Editor Mono |
|-------------------------|-------------|
| `ZLUA_USE_LUAJIT` (0/1) | `#define ZLUA_USE_LUAJIT` (present = enabled) |
| `ZLUA_LUA_API_FAMILY` | `ZLUA_LUA_5_1` / `ZLUA_LUA_5_3` / … (one mutually exclusive set) |
| `ZLUA_UNITY_*` / `ZLUA_TUANJIE_*` | No equivalent conf; Mono does not depend on them |
| `ZLUA_LUA_VERSION` ← `LUA_VERSION_NUM` | None; P/Invoke trimmed by §8.3 API family |
| `ZLUA_FAST_METATABLE` (luaconf) | N/A (no embedded Lua VM sources) |

---

## 13. Doc-map update notes

After this file is part of `spec/**`:

- Package layout, Install, multi-version, and **Il2Cpp conf/Compatible** are authoritative **here**
- Outdated wording in `00-OVERVIEW` such as “full in-package `libil2cpp-2022` tree” should be revised as implementation lands
- Implementation notes such as `impl/IL2CPP.md` must not override this document; on conflict, revise this document first or seek confirmation
