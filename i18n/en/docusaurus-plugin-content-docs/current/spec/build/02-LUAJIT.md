---
sidebar_position: 2
title: "LuaJIT build"
---

# Build — LuaJIT

> This document defines how ZLua integrates **LuaJIT** on **Editor (Mono)** and **Il2Cpp Player**.
> For official Lua (PUC-Rio), see [01-OFFICIAL-LUA.md](/docs/spec/build/01-OFFICIAL-LUA/).
> For the Mono × JIT `lua_error` gate, see [03-MONO-LUAJIT-CALLBACK-GATE.md](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/).
> For package layout, Install, and Define overview, see [11-MULTI-VERSION.md](/docs/spec/11-MULTI-VERSION/).
> This document does not change Lua-visible interop semantics. If it conflicts with older wording that “copies the full LuaJIT `src/` into `libil2cpp/lua`”, **this document wins**.

---

## 1. Comparison with PUC-Rio (summary)

| | **LuaJIT (this doc)** | **PUC-Rio** ([01-OFFICIAL-LUA.md](/docs/spec/build/01-OFFICIAL-LUA/)) |
|--|-----------------------|---------------------------------------------------------------------|
| Settings id | `luajit-{major}.{minor}` (e.g. `luajit-2.1`) | `lua-X.Y.Z` |
| Source cache | **Manual clone** under `LuaSrcCache/` (no auto-download; directory name is implementation-defined, commonly `luajit-2.1`) | May auto-download |
| Editor | Dynamic library (e.g. `luajit21.dll`) + **callback gate** | Series `lua5x.dll` + **callback gate** |
| Il2Cpp | **Public headers only**; **static `.a` provided by the developer in Plugins** | Full compilable `src/` |
| FastMT | **Forced `0`** | Enabled for ≥5.3.2 |
| WebGL | ❌ **Unsupported** | ✅ |
| Other desktop Il2Cpp platforms | ❌ **Unsupported** (Android / iOS only) | ✅ |

**Principles:**

- **Editor** loads Plugins dynamic libraries via `DllImport`.
- On **Il2Cpp**, `zlua-runtime` calls `lua_*` directly; the JIT path provides symbols via **static library linking**.
- Unity **does not guarantee** reliably linking Windows import `.lib` files into `GameAssembly`; therefore the Il2Cpp delivery surface converges on **iOS / Android static `.a`**.

---

## 2. Why you cannot copy the whole tree into libil2cpp as with PUC

LuaJIT builds in **two stages**:

```text
Host: minilua → DynASM(vm_*.dasc) → buildvm
      → generates lj_*def.h, lj_vm.obj|lj_vm.S, luajit.h, etc.
Target: compile lj_*.c / lib_*.c (or ljamalg.c) and link with lj_vm
```

| Obstacle | Notes |
|----------|-------|
| Generated artifacts | Clean clones / official `msvcbuild` cleanup often **delete** generated headers; Il2Cpp cannot compile from upstream `.c` alone |
| `lj_vm` | OS/CPU-generated obj/assembly, not portable `.c` |
| `dynasm/`, `host/` | Host tools; must not be Player compile units |
| Naive glob | Would compile `host/*.c`, `luajit.c` (`main`), or amalg and split sources together → failure |
| WebGL | **No** WASM backend; unusable |

Therefore: **do not** treat “un-pregenerated full LuaJIT `src/`” as the same Il2Cpp input as PUC.
“Host-pregenerate, then copy a compilable subset” is technically possible but the maintenance matrix is large; the **current product convention** is below: headers + static library.

---

## 3. Editor (Mono)

| Item | Convention |
|------|------------|
| Define | `ZLUA_USE_LUAJIT` (and implementation defines such as `ZLUA_LUAJIT_2_0` / `ZLUA_LUAJIT_2_1`) |
| Dynamic library | Developer-supplied; logical name is implementation-defined (e.g. `luajit21` → `Plugins/x64/luajit21.dll`) |
| Sources | Not required in the Editor; use the **same upstream version and configure macros** as Il2Cpp headers / `.a` |
| `lua_error` | **Must not** be called directly from a managed reverse-P/Invoke frame. Must go through the **native callback gate** (same as PUC Editor) → [03-MONO-LUAJIT-CALLBACK-GATE.md](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/) |

---

## 4. Il2Cpp Install: headers only

When LuaJIT is selected, Install places **only public headers** into `Local.../libil2cpp/lua` (at least those required to compile the implementation), for example:

- `lua.h`, `lauxlib.h`, `lualib.h`, `luaconf.h`, `luajit.h`

**Must not** install: `lj_*.c`, `lib_*.c`, `ljamalg.c`, `host/**`, `luajit.c`, ungenerated intermediates, etc.

Also force `ZLUA_FAST_METATABLE 0` (may be written into the installed `luaconf.h`).

`zlua-runtime` includes these headers via `LuaCompatible.h` (`ZLUA_USE_LUAJIT` branch); link symbols come from the §5 static library.

---

## 5. Il2Cpp Player: developer-provided static library

**Supported shipping surface (LuaJIT + Il2Cpp): Android, iOS.**

| Platform | Developer obligation |
|----------|----------------------|
| **iOS** | Cross-compile a static library yourself, place it under Plugins (e.g. `Plugins/iOS/libluajit.a`), and enable iOS in PluginImporter |
| **Android** | Build static libraries per ABI (e.g. `arm64-v8a`, `armeabi-v7a`), place them under the agreed paths (e.g. `Plugins/Android/libs/<abi>/libluajit.a`), and enable the matching CPUs |

Notes:

- Unity has documented support for **iOS / Android prebuilt static libraries (`.a`)**, which can link symbols into the final native artifact.
- **Do not** rely on “drop a dynamic `.so` + edit `build.gradle`” to resolve `lua_*` references from C++ inside `libil2cpp`: on Android, `libil2cpp.so` is usually linked in the **Bee/NDK stage**; Gradle typically **cannot** supply that link.
- Headers and `.a` must come from the **same LuaJIT version**, with matching configure macros (e.g. `LUAJIT_DISABLE_JIT` is common on iOS).
- Prefer pinning filenames in the package README / Plugins notes (e.g. `libluajit.a`).

---

## 6. Explicitly unsupported / not guaranteed

| Item | Stance |
|------|--------|
| **WebGL / Win / macOS / Linux Il2Cpp + LuaJIT** | **Unsupported**; Il2Cpp + LuaJIT is **Android / iOS only**. On other platforms, switch to PUC-Rio ([01-OFFICIAL-LUA.md](/docs/spec/build/01-OFFICIAL-LUA/)). When Settings is JIT, building an unsupported target should **fail with a clear message** |
| **Win / macOS / Linux Il2Cpp Player + dynamic library only** | **Unsupported** (same as above; dynamic libraries are not an Il2Cpp delivery path) |
| **Running DynASM/buildvm inside Il2Cpp** | **Not done** |

---

## 7. Recommended developer build hints (not the only commands)

1. Use the same LuaJIT source tree as the cache (e.g. `LuaSrcCache/luajit-2.1`).
2. Complete official host generation + static library linking for the target OS/ABI (see upstream `Makefile` / `src/host/README` and cross-compile notes).
3. iOS: disable JIT (`LUAJIT_DISABLE_JIT`) unless you have a clear, supported exception.
4. Place the produced `.a` at the §5 paths and confirm platform / CPU checkboxes in the Inspector.
5. Re-run Install (headers and Defines), then build an Il2Cpp package and verify no unresolved `lua_*` at link time.

---

## 8. Checklist (example: `luajit-2.1`)

- [ ] Sources cloned into `LuaSrcCache`; run Install
- [ ] `Local.../libil2cpp/lua` has **headers only** (no `lj_*.c`, etc.)
- [ ] Editor: `luajit21` (or agreed name) dynamic library in place; [callback gate](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/) native library present
- [ ] Defines: `ZLUA_USE_LUAJIT`; `ZLUA_FAST_METATABLE` is `0`
- [ ] Il2Cpp Android/iOS: matching-ABI **`libluajit.a` (or agreed name) under Plugins with platforms enabled**
- [ ] Do not use this configuration on WebGL

---

## 9. Division of labor with other docs

| Document | Content |
|----------|---------|
| [11-MULTI-VERSION.md](/docs/spec/11-MULTI-VERSION/) | UPM, Install, Defines, fingerprint |
| [01-OFFICIAL-LUA.md](/docs/spec/build/01-OFFICIAL-LUA/) | PUC-Rio sources-in-tree |
| **This doc** | LuaJIT headers + `.a`, platform limits |
| [03-MONO-LUAJIT-CALLBACK-GATE.md](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/) | Editor Mono × JIT `lua_error` safety boundary |
| [04-EMMYLUA-DEBUGGER.md](/docs/spec/build/04-EMMYLUA-DEBUGGER/) | Editor EmmyLua; under JIT, hook-suppressed performance is acceptable |
