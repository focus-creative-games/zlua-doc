---
sidebar_position: 4
title: "EmmyLua debugger"
---

# Build — Editor Mono: EmmyLua debugger

> Defines how ZLua **Editor (`ZLua.Mono`)** integrates **EmmyLua `emmy_core`** so IDEs such as VS Code / JetBrains can breakpoint-debug running Lua.
> **Upstream repo:** [EmmyLua/EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger) (build options and usage follow that repo’s README / docs).
> Does **not** change Lua-visible interop semantics; does **not** cover Il2Cpp Player.
> Exception boundary: [03-MONO-LUAJIT-CALLBACK-GATE.md](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/); host entry: [01-HOST-API.md](/docs/spec/01-HOST-API/); multi-version: [11-MULTI-VERSION.md](/docs/spec/11-MULTI-VERSION/).

---

## 1. Goals and non-goals

### 1.1 Goals

| Item | Convention |
|------|------------|
| Host | Unity **Editor** + `ZLua.Mono`, single `lua_State` |
| Debug library | **EmmyLua `emmy_core`** ([EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger)); directories split by **Lua series + OS/Arch** |
| IDE | EmmyLua protocol clients (VS Code EmmyLua extension, Rider, etc.) |
| Connection | Lua-side **`tcpListen`**; IDE **Attach** to the agreed port |
| Switch | Explicitly enabled in Project Settings (`ZLua.Settings`); **off by default** |
| Shipped coverage | **Windows** / **macOS**: `lua51`–`lua55` and **`luajit`**; **Linux**: currently **`lua55` only** (`linux-x64`) |

### 1.2 Non-goals

| Item | Stance |
|------|--------|
| Il2Cpp Player / on-device debugging | **Out of scope for this spec** (separate doc if done later) |
| WebGL | **Unsupported** (no usable TCP attach model) |
| Homegrown DAP adapter | **Not done**; protocol and UI belong to EmmyLua IDE extensions |
| C#↔Lua mixed call-stack beautification | **Not done** (only the Lua stack is shown by Emmy) |
| Business scripts hand-writing `require('emmy_core')` | **Not required**; host injects uniformly (advanced users may still call manually) |
| Prebuilding every series for Linux | **Not done** (except `lua55`); other series must self-build per upstream docs (see §3.2) |

---

## 2. Architecture

```text
IDE (EmmyLua)
    ↕ Emmy debug protocol / TCP
emmy_core (Lua C module, loaded via require)
    ↕ debug.sethook / debug APIs
ZLua’s single lua_State (Editor Mono)
```

| Layer | Responsibility |
|-------|----------------|
| **Settings** | `enableDebugger`, port, whether `waitIDE` |
| **`LuaMonoAppDomain.Initialize`** | After init completes, if enabled call `LuaEnv.StartDebugger` |
| **`LuaEnv.StartDebugger`** | Append `package.cpath` → `require('emmy_core')` → `tcpListen` → optional `waitIDE` |
| **`Plugins/emmylua/**`** | **On-disk native module files only**; **must not** be auto-loaded by Unity PluginImporter |

---

## 3. In-package layout, self-build, and PluginImporter

### 3.1 Series directory naming (mandatory)

Top-level directory names match Editor native library logical names (see [11-MULTI-VERSION.md](/docs/spec/11-MULTI-VERSION/)):

| Engine | Directory rule | Example |
|--------|----------------|---------|
| **PUC-Rio (official Lua)** | `lua{major}{minor}` | Lua 5.5.x → **`lua55`**; 5.4.x → **`lua54`**; 5.3.x → **`lua53`** |
| **LuaJIT** | **`luajit`** (no 2.0 / 2.1 split) | Any `luajit-2.x` → **`luajit/`** |

One `emmy_core` is shared per **major series** (e.g. all `lua-5.3.*` share `lua53/`; **all LuaJIT 2.x share `luajit/`**). You do **not** need separate builds per patch / JIT minor version.

Platform subdirectory (second level):

| Editor | Subdir | File |
|--------|--------|------|
| Windows x64 | `win32-x64` | `emmy_core.dll` |
| macOS arm64 | `darwin-arm64` | `emmy_core.dylib` |
| macOS x64 | `darwin-x64` | `emmy_core.dylib` |
| Linux x64 | `linux-x64` | `emmy_core.so` |

Full path examples (current package shipping):

```text
Packages/com.code-philosophy.zlua/Plugins/emmylua/
├── lua51/{win32-x64,darwin-arm64,darwin-x64}/…
├── lua52/{win32-x64,darwin-arm64,darwin-x64}/…
├── lua53/{win32-x64,darwin-arm64,darwin-x64}/…
├── lua54/{win32-x64,darwin-arm64,darwin-x64}/…
├── lua55/{win32-x64,darwin-arm64,darwin-x64,linux-x64}/…
└── luajit/{win32-x64,darwin-arm64,darwin-x64}/…   # Emmy -DEMMY_LUA_VERSION=jit; shared by 2.0/2.1
```

At runtime, pick the directory from the **current Editor compile defines**: PUC → `lua{major}{minor}`; any LuaJIT → **`luajit`**. This is **not** probing ABI embedded in the DLL. The Editor host DLL may still be `luajit20.dll` / `luajit21.dll` (unrelated to the emmy directory name).

### 3.2 Package shipping coverage and self-build

| Series | Windows `win32-x64` | macOS `darwin-arm64` / `darwin-x64` | Linux `linux-x64` |
|--------|---------------------|-------------------------------------|-------------------|
| `lua51` … `lua55` | **Shipped** | **Shipped** | **`lua55` only shipped**; others self-build |
| `luajit` (shared by 2.0/2.1) | **Shipped** | **Shipped** | **Not shipped**; self-build |

Upstream: [EmmyLua/EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger) (local trees may also mirror `3rd/EmmyLuaDebugger`).

**Windows package build convention (maintainers):**

```bat
cmake -G "Visual Studio 17 2022" -A x64 ^
  -DCMAKE_USER_MAKE_RULES_OVERRIDE=<repo>/cmake/flags_override.cmake ^
  -DEMMY_LUA_VERSION=<51|52|53|54|55|jit> ^
  -DEMMY_CORE_VERSION=zlua ..
cmake --build . --config Release --target emmy_core
```

Copy `emmy_core/Release/emmy_core.dll` to `Plugins/emmylua/<series>/win32-x64/`, and author Unity `.meta` for the DLL / directories with PluginImporter **`enabled: 0` on all platforms** (including Editor).
Place `jit` artifacts under the single directory **`luajit/win32-x64/`** (Emmy does **not** distinguish JIT 2.0 / 2.1; **do not** build a separate “luajit21” `emmy_core`).

**macOS package build convention (maintainers):** On a Mac, build `EMMY_LUA_VERSION=51…55|jit` separately for `arm64` / `x86_64` per upstream docs; place outputs under `darwin-arm64` / `darwin-x64`; PluginImporter fully disabled as above. Source mode may use `-DEMMY_USE_LUA_SOURCE=ON`. In Lua 5.1 source mode, if `LUA_NUMTAGS` is missing, Emmy must be adapted (the shipped `lua51` darwin binaries already handle this).

**Linux, or when swapping Emmy versions:** Read upstream README “Build Options”, self-build for the target OS/Arch, place under the §3.1 paths; PluginImporter fully disabled. Windows shipped binaries may match official CI (by default **without** `EMMY_USE_LUA_SOURCE`, resolving host Lua APIs dynamically at runtime); macOS shipped builds are often source-mode.

ZLua Install does **not** auto-compile EmmyLuaDebugger.

### 3.3 Missing directories

Before injecting the script, `StartDebugger` checks that `Plugins/emmylua/<series>/` and the current OS/Arch subdirectory exist:

- **Missing** → `Debug.LogError` with the expected path (may note that non-`lua55` Linux needs a self-build), **skip the debugger, do not throw** (do not abort `Initialize`)
- **Present** → then `require('emmy_core')`; `require`/listen failures also log only and do not throw to the host

### 3.4 PluginImporter (mandatory)

| Platform | `enabled` |
|----------|-----------|
| Editor | **0** |
| Win / Win64 / OSX / Linux / WebGL / others | **0** |

**Rationale:** `emmy_core` is a **Lua C module** (loaded via `package.cpath` + `require` / `luaopen_*`), not a Unity native plugin. If Editor is enabled, Unity `LoadLibrary`s first, then Lua `require` loads again → conflicts or undefined behavior.

Stricter optional layout: move out of `Plugins/` (e.g. `Editor/EmmyLua/`) so it is not scanned as a plugin; if kept under `Plugins/emmylua`, **meta must disable all platforms** to satisfy this rule.

---

## 4. Settings

Add to `ZLua.Settings` (`ProjectSettings/ZLua.asset`) (field names are implementation-defined; semantics as follows):

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `enableDebugger` | `bool` | **`false`** | When true, call `StartDebugger` at the end of `Initialize` |
| `debuggerPort` | `int` | **`9966`** | `tcpListen` port |
| `debuggerWaitIDE` | `bool` | **`false`** | When true, call `dbg.waitIDE()` (see §7) |

The UI (SettingsProvider) must state:

- Applies to **Editor Mono** only
- When `waitIDE == true`, it **blocks the Unity main thread** with **no timeout** (see §7)
- Must match the `emmy_core` directory for the current series (see §6); IDE must configure `sourcePaths` (see §10)

---

## 5. Startup flow

### 5.1 Timing

In `LuaMonoAppDomain.Initialize`, start the debugger only **after all** of the following complete:

1. Create / reuse `LuaEnv` (including `luaL_openlibs`)
2. `SetModuleLoader`
3. Existing init such as `LoadBuiltinGlobals`, MarshalAs XML (if any), `AssemblyRegistry`, `ZLuaLib`, `EnsureBuiltinZLuaLib`, `DelegateBridges.Warmup`

So breakpoints can cover `CSharp`, `zlua`, and business `require` modules.

**Early-return path** (`_luaEnv != null`, only refreshes the loader): **must not** `waitIDE` again; `StartDebugger` must be **idempotent** (if already listening, skip or only ensure listen — see implementation).

### 5.2 `LuaEnv.StartDebugger` (normative behavior)

Pseudocode (Lua fragment injected via C# `DoString`; path / port / wait substituted by C#):

```lua
package.cpath = package.cpath .. ";<absDir>/?.<ext>"
local dbg = require('emmy_core')
dbg.tcpListen('127.0.0.1', <port>)
-- only when debuggerWaitIDE == true:
dbg.waitIDE()
```

| Item | Convention |
|------|------------|
| Host | Use **`127.0.0.1`** (avoids `localhost` → IPv6 failures in some environments) |
| Path | **Absolute path**; prefer `/` as directory separator in the Lua string |
| Failure | `require` / listen failures must log a clear Editor error (including the Lua error object); **must not** swallow silently |
| Repeat append | Multiple calls must not grow `cpath` without bound; detect an injection marker or an existing directory entry |

### 5.3 Platform macros and `cpath` mapping

| Condition | Directory (relative to package root `Plugins/emmylua/`) | `<ext>` |
|-----------|----------------------------------------------------------|---------|
| `UNITY_EDITOR_WIN` | `win32-x64` | `dll` |
| `UNITY_EDITOR_OSX` + ARM64 | `darwin-arm64` | `dylib` |
| `UNITY_EDITOR_OSX` + x64 | `darwin-x64` | `dylib` |
| `UNITY_EDITOR_LINUX` | `linux-x64` | `so` |

Resolve package root via a known in-package relative path through `Path.GetFullPath` (or a `CommonDirs`-like helper) to an absolute directory; **do not** hard-code machine drive letters.

Arch detection is implementation-defined (e.g. `RuntimeInformation` / existing Unity Editor arch APIs) and must cover Apple Silicon.

---

## 6. ABI / Lua version matching

### 6.1 Fact: binaries do not self-report Lua version

Shipped community/official `emmy_core` has **no** reliable “read the file header to learn 5.3 vs JIT” contract. EmmyLuaDebugger selects ABI at **compile time** via CMake options, e.g.:

```bash
cmake .. -DEMMY_LUA_VERSION=53   # or 51/52/54/55/jit
```

(See [EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger); `EMMY_LUA_VERSION` drives macros and headers.)
Therefore ZLua **cannot** and **need not** heuristically probe a bare `emmy_core.dll` for ABI.

### 6.2 How ZLua “validates” (by series directory, not probing)

**Principle: declare the target series via directory layout; at runtime only check that the matching directory exists.**

| Approach | Notes | Recommended |
|----------|-------|-------------|
| **B. Per-series directories (this package)** | `Plugins/emmylua/{lua55\|…\|luajit}/<platform>/emmy_core.*`; PUC series name = Editor DLL logical name; JIT unified as **`luajit`** | **Yes** |
| **A. Single series + constant/manifest** | Degenerate fallback when not splitting directories | No (superseded by B) |
| **C. Only try `require`** | Wrong ABI/path often **native-crashes**; Lua `pcall` cannot catch it | **Forbidden** as the sole check |

Flow:

```text
series = current compile define → lua55 / luajit / …
dir = Plugins/emmylua/<series>/<platform>/
if dir missing
  → LogError (state series and expected path) and return; no throw, no require
else
  → append cpath and require('emmy_core')
```

Windows / macOS already ship `lua51`–`lua55` and `luajit` (see §3.2); Linux currently ships only **`lua55/`**; other series need a self-build.

### 6.3 Relation to ZLua multi-version

| `luaVersionId` → series directory | Self-build `EMMY_LUA_VERSION` |
|-----------------------------------|-------------------------------|
| `lua-5.1.*` → **`lua51`** | `51` |
| `lua-5.2.*` → **`lua52`** | `52` |
| `lua-5.3.*` → **`lua53`** | `53` |
| `lua-5.4.*` → **`lua54`** | `54` |
| `lua-5.5.*` → **`lua55`** | `55` (upstream default) |
| `luajit-2.0` / `luajit-2.1` → **`luajit`** | `jit` |

Directory rules again: **official Lua → `lua{major}{minor}`; LuaJIT → unified `luajit`** (**do not** split emmy dirs as `luajit20` / `luajit21`).

On Windows / macOS, each series should use the shipped `emmy_core` under its directory; on Linux or when a directory is missing, self-build per [EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger) into the table paths above. **Do not** move a binary from the wrong series directory into another to “make it work”.

LuaJIT 2.0 / 2.1 both use the upstream `jit` build of the **same** `emmy_core`, placed only under **`luajit/`**.

ZLua Install does **not** auto-compile Emmy.

### 6.4 LuaJIT and the gate

Debug-time hooks suppress JIT; the performance hit is acceptable. `emmy_core` is a native module and must still obey [03-MONO-LUAJIT-CALLBACK-GATE.md](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/) (**never** call `lua_error` directly from a managed reverse-P/Invoke frame).

---

## 7. `waitIDE` and the main thread

| `debuggerWaitIDE` | Behavior |
|-------------------|----------|
| `false` (default) | `tcpListen` only; IDE connects later; Editor is **not** blocked |
| `true` | `waitIDE()` waits synchronously on the **Unity main thread** for an IDE connection |

**Upstream has no timeout:** [EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger) documents `dbg.waitIDE()` as **not accepting a timeout**; if nothing connects it blocks forever. Therefore Settings leaves wait **off by default**.

Recommended workflow: keep `debuggerWaitIDE = false` → Unity Play (already listening) → IDE F5 to connect → then trigger business Lua. Enable wait only when you must “break before the first business line” and the IDE is already open.

---

## 8. Source path mapping (chunk ↔ disk)

Modules loaded via ZLua’s `moduleLoader` use chunk names:

```text
@<module/path>.lua
```

(`.` in the module name → `/`.) Physical files are decided by the host loader; for example in this repo’s test project:

| `require` | Chunk (visible to debugger) | Disk file |
|-----------|-----------------------------|-----------|
| `luatest/init` or `luatest.init` | `@luatest/init.lua` | `{project}/Tests/Lua/luatest/init.lua` |
| `cases.foo.bar` | `@cases/foo/bar.lua` | `{project}/Tests/Lua/cases/foo/bar.lua` |

The IDE must add the **Lua source root** (e.g. `Tests/Lua` above) to Emmy’s `sourcePaths`, or you get “connected but Could not load source / breakpoints do not hit”.

| Item | Convention |
|------|------------|
| Mapping rule | `sourcePaths` = source roots used by `moduleLoader` (may be multiple) |
| Workspace | Open the IDE at the **project root** (the layer with `Packages` / `Tests`), not only `Tests/Lua` |
| Builtin chunks | `globals.lua` / `zlualib.lua` etc. have no stable project path; breakpoints are **not guaranteed** |
| Runtime rewrite of `source` | **Not required** by this spec; if implemented, must not hurt existing `traceback` readability |

---

## 9. Relation to existing Editor constraints

| Mechanism | Debugger-side requirement |
|-----------|---------------------------|
| [Callback gate](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/) | Debug logic stays inside `emmy_core` / Lua; **do not** call `lua_error` directly from managed callbacks for debugging |
| `LuaPrintBuffer` | Debug output goes through Emmy channels; do not rely on stack-capturing `Debug.Log` inside callback frames |
| Single `lua_State` | One listen session is enough; do not introduce a second state |
| `LuaFramePump` | This phase **does not** require an Emmy pump (default is no `waitIDE`); if a non-blocking protocol is added later, coordinate with the frame pump |

---

## 10. IDE / EmmyLua extension setup (VS Code · Cursor)

Upstream protocol and extensions follow [EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger) and the VS Code / Cursor **EmmyLua** extension. ZLua side is `tcpListen`: **game listens first, IDE connects second**.

### 10.1 Prerequisites

1. Install / Settings so the Editor runs Lua of the **same series as `emmy_core`** (default `lua-5.5.0` → `lua55`; other series: §3.2 shipping matrix).
2. Project Settings → ZLua: `enableDebugger = true`, `debuggerPort` matching the IDE (default **9966**), **`debuggerWaitIDE = false`** (recommended).
3. Install the EmmyLua extension; open the **Unity project root** in the IDE.
4. Play / trigger `LuaAppDomain.Initialize`; Console shows `EmmyLua debugger listening on 127.0.0.1:…`.
5. Start the debug configuration below, set breakpoints in `.lua` under the source root, and trigger the matching `require`.

### 10.2 `.vscode/launch.json` (recommended template)

`type` uses the extension’s **EmmyLua New Debug** (commonly `emmylua_new`; if the list name differs, follow the extension).

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "emmylua_new",
      "request": "launch",
      "name": "ZLua EmmyLua (Unity Editor)",
      "host": "127.0.0.1",
      "port": 9966,
      "sourcePaths": [
        "${workspaceFolder}/Tests/Lua"
      ],
      "ext": [".lua"],
      "ideConnectDebugger": true
    }
  ]
}
```

| Field | Notes |
|-------|-------|
| `host` | Match ZLua injection: **`127.0.0.1`** (avoid `localhost` → IPv6) |
| `port` | Same as Settings `debuggerPort` |
| `sourcePaths` | **Required and must point at the real Lua root**; example is repo `Tests/Lua`. Business projects use their own `LuaScripts`, etc. |
| `ext` | Source suffixes; for `.lua` only use `[".lua"]`; include `.lua.txt` if used |
| `ideConnectDebugger` | `true`: IDE actively connects to a process already in `tcpListen` (matches ZLua injection) |
| `request` | Extensions commonly use `launch` (New Debug); semantics are still “connect to an already-listening host”, not “IDE starts lua.exe for you” |

**Multiple source roots:** append more entries in `sourcePaths`, e.g. `"${workspaceFolder}/LuaScripts"`, `"${workspaceFolder}/Packages/xxx/Lua"`.

### 10.3 `.emmyrc.json` (language service, optional)

For completion / diagnostics; **does not replace** `launch.json` `sourcePaths`. Project-root example:

```json
{
  "workspace": {
    "library": []
  },
  "diagnostics": {
    "disable": ["undefined-global"]
  }
}
```

When ZLua uses many globals such as `CSharp`, you may disable `undefined-global` to reduce noise.

### 10.4 Recommended sequence

```text
Unity: enableDebugger + (optional) confirm series is lua55
    → Play / Initialize → log listening
Cursor / VS Code: open project root → F5 (config above)
    → breakpoints in .lua under sourcePaths
    → trigger require / GetFunction into that module
```

### 10.5 Common issues

| Symptom | Check |
|---------|-------|
| Console: `EmmyLua debugger skipped` / missing dir | No `Plugins/emmylua/<series>/<platform>/` for current series; Win/macOS series should be shipped; Linux non-`lua55` self-build per §3.2 |
| `DllNotFoundException: lua55` (or other series) | Settings / define switched series but Editor native lib not ready: confirm `Plugins/lua/<series>/` has the matching `luaXX.dll` / `.dylib`, PluginImporter **Editor enabled**, and **Install / domain reload** after the version change |
| IDE cannot connect / times out | Has Unity already listened? Port match? Host `127.0.0.1`? Firewall? |
| Connected but grey breakpoints / Could not load source | **`sourcePaths` not pointing at the real Lua root** (missing `Tests/Lua`); or workspace is not project root |
| Editor freezes on Play | Accidental `debuggerWaitIDE`; turn off, or F5 before Play |
| Want a timeout for `waitIDE` | **Upstream unsupported**; keep wait off by default |
| No `emmylua_new` in the extension | Install/enable EmmyLua extension and reload the window; use the Debug type the extension actually provides |
| Cursor only, no VS Code | Same `.vscode/launch.json` and EmmyLua extension work |

---

## 11. Acceptance checklist

- [ ] PluginImporter for all `emmy_core` under `emmylua/**` is **disabled on every platform**
- [ ] Windows / macOS ship `lua51`–`lua55`, `luajit` (per platform subdirs); Linux ships `lua55/linux-x64`; others self-build per [EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger)
- [ ] Series directory naming: `lua{major}{minor}` / unified **`luajit`** (no 2.0/2.1 split)
- [ ] When `enableDebugger == false`: no listen, no `cpath` injection, no blocking
- [ ] When the current series directory is missing: `LogError` then Initialize **completes successfully** (no throw)
- [ ] Win / macOS (arm64+x64) / Linux Editor + matching series: after enable, `require('emmy_core')` succeeds and IDE can connect
- [ ] When `debuggerWaitIDE == false`, Initialize returns immediately; docs state `waitIDE` has **no timeout**
- [ ] `Initialize` early-return path does not repeat `waitIDE`
- [ ] `launch.json` `sourcePaths` aims at business/test Lua roots; business-module breakpoints hit
- [ ] With debugging on, existing Mono gate / `pcall` error paths still do not crash

---

## 12. Related documents

| Document | Relationship |
|----------|--------------|
| [EmmyLua/EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger) | Upstream build, `EMMY_LUA_VERSION`, usage (authoritative) |
| [01-HOST-API.md](/docs/spec/01-HOST-API/) | `Initialize` façade; debugger inserts after it |
| [10-LIFETIME.md](/docs/spec/10-LIFETIME/) | Single state, exception boundary |
| [11-MULTI-VERSION.md](/docs/spec/11-MULTI-VERSION/) | `luaVersionId` and Editor DLL logical names |
| [03-MONO-LUAJIT-CALLBACK-GATE.md](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/) | Editor callbacks and `lua_error` |
| [02-LUAJIT.md](/docs/spec/build/02-LUAJIT/) | Expected hook performance under JIT |
| In-package `Plugins/README.md` | Directory and self-build cheat sheet |
| [05-NATIVE-MODULES.md](/docs/spec/build/05-NATIVE-MODULES/) | General conventions for third-party C modules (socket/cjson); same cpath / disabled PluginImporter pattern |
