---
sidebar_position: 3
title: "Mono callback gate"
---

# Build — Editor Mono: `lua_error` and native callback gate

> Addresses crashes on **Unity Editor (`ZLua.Mono`)** when `lua_error` / unsafe stack capture runs on a Lua→C# callback frame.
> **Applies to all Editor Lua series** (PUC-Rio 5.1–5.5 and LuaJIT). Il2Cpp Player does **not** use this gate.
> Engine builds: [01-OFFICIAL-LUA.md](/docs/spec/build/01-OFFICIAL-LUA/), [02-LUAJIT.md](/docs/spec/build/02-LUAJIT/); exception semantics: [10-LIFETIME.md](/docs/spec/10-LIFETIME/) §8.
> Does **not** modify Lua / LuaJIT upstream; does **not** change `pcall`-visible semantics.

---

## 1. Problem

### 1.1 Observed symptoms

| Symptom | Notes |
|---------|-------|
| LuaJIT Win64 + `lua_error` | SEH crosses Mono reverse-P/Invoke → SIGSEGV |
| PUC-Rio + `Debug.Log` (with stack) inside a callback | Capturing a stack while an active `lua_pcall` is live can SIGSEGV; hence deferred flush via `LuaPrintBuffer` |
| Tuanjie and similar: `throw` inside a callback | Managed exception first-pass while outer `lua_pcall` is still live can SIGSEGV |

Unified protocol: **managed code never calls `lua_error`; the native gate raises it** (complements deferred printing; neither replaces the other).

### 1.2 Root-cause summary

| Engine | `lua_error` | With Mono reverse P/Invoke |
|--------|-------------|----------------------------|
| **LuaJIT Win64** | **SEH** | Crosses managed frames → crash |
| PUC-Rio | `longjmp` | Relatively more tolerable, but still risky with stack capture / some Mono builds |

Constraint: **`lua_error` must not run while still on a Mono managed reverse-P/Invoke stack frame.**

### 1.3 Non-goals / rejected defaults

| Approach | Why not the default |
|----------|---------------------|
| Patch LuaJIT sources to change unwind style | High fork cost; hard to upgrade |
| Wrap every callback in Lua `__zlua_wrap_cs` + `error()` | Correct but hot-path table build / extra Lua frame is expensive |
| Change Il2Cpp to the same protocol | Il2Cpp already calls `lua_error` from a pure C++ top level with no Mono frame; **keep as-is** |

---

## 2. Solution: native callback gate

### 2.1 Idea

Move “actually call `lua_error`” into a **thin native C frame**, and only after the **managed callback has already returned**:

```text
lua_pcall / Lua
  → zlua_callback_gate          ← native; only place allowed to lua_error
       → managed LuaCSFunction  ← on failure: push error object + return SENTINEL; never lua_error
       ← return
  ← gate: if SENTINEL then lua_error(L); else return nrets unchanged
```

Semantics remain “option A”: **managed never calls `lua_error`**; equivalent to `error()` inside a Lua wrap, but the success path is essentially one C indirect call.

### 2.2 Sentinel protocol

| | Convention |
|--|------------|
| Success | managed returns normal `nrets` (≥ 0 and **≠** sentinel) |
| Failure | managed `lua_push*` of the error object to stack top, then `return ZLUA_CALLBACK_ERROR_SENTINEL` |
| Sentinel value | `0xFFFF5A11` (implementation constant; C and C# must match) |
| Gate | `n == SENTINEL` → `lua_error(L)`; otherwise `return n` |

### 2.3 Upvalue layout

The gate is registered as a **CClosure**; the callable Lua sees is the gate, not a bare managed function pointer.

| Upvalue | Meaning |
|---------|---------|
| **1** | managed `lua_CFunction` as **lightuserdata** (function pointer) |
| **2..** | Original logical upvalues (tag, type handle, assembly name, etc.) |

When managed is entered via a **direct C call**, the current CallInfo is still the **gate’s CClosure**, so `lua_upvalueindex(i)` sees the gate’s upvalues. Therefore:

- Logical upvalue `k` in gated mode must be read as **`lua_upvalueindex(k + 1)`**
- When taking the first logical upvalue via `lua_getupvalue` on the Lua function value, the slot is **2** (not 1)

The third argument to `zlua_gate_init` is the **upvalue pseudo-index base**: 5.1 / LuaJIT → `LUA_GLOBALSINDEX`; 5.2+ → `LUA_REGISTRYINDEX`.

### 2.4 Standalone DLL

The gate builds as a standalone native library and is **not** hard-linked to a specific Lua version:

1. After the current `LUA_DLL` is loaded
2. `zlua_gate_init(lua_touserdata, lua_error, upvalue_pseudo_base)`
3. `zlua_get_callback_gate()` → `lua_pushcclosure`

Sources: `ZLua~/mono-native/`. Artifacts live with the Editor Lua series libraries under **`Plugins/lua/`** (see §5), enabled for **Editor** (no `ZLUA_USE_LUAJIT`-only restriction). The `ZLua.Mono` asmdef is Editor-only, so this is naturally Editor-only.

| Platform | Shipped file | Notes |
|----------|--------------|-------|
| Windows Editor x64 | `Plugins/lua/zlua_mono_gate.dll` | Shipped with this package |
| macOS Editor | `Plugins/lua/libzlua_mono_gate.dylib` | Shipped with this package; universal (arm64 + x86_64) |
| Linux Editor | `Plugins/lua/libzlua_mono_gate.so` | Build per §5.4 and place in the same directory |

**One** gate binary covers all PUC / LuaJIT series (switching `lua53` / `luajit21` etc. does **not** require rebuilding the gate).

Build steps: **§5**.

---

## 3. Managed-side obligations (all Editor series)

### 3.1 Registration entry points

Every Lua→C# `pushcfunction` / `pushcclosure(managed, …)` **must** go through the gate:

- `LuaCallbackGate.PushCFunction` / `PushCClosure`
- Or equivalent wrappers (`ClosurePin`, `ZLuaLib.Register`, `LuaDllExtension.RegisterCallback`, metatable / assembly indexers, etc.)

**Do not** `lua_pushcfunction` a bare `Marshal.GetFunctionPointerForDelegate` into Lua (prefer gating `__gc` and similar too, so error paths are not missed).

### 3.2 Error exits

| API | Behavior |
|-----|----------|
| `LuaDllExtension.error` | `pushstring` + `return ErrorSentinel` (**does not** call `lua_error`) |
| `LuaCallbackBoundary.ToLuaError` | Same (via `error`) |
| `LuaCallbackBoundary.Throw` | **Throws** `LuaScriptException` (entry `try/catch` converts to sentinel) |

### 3.3 Nested C#→Lua failure

When already inside a Lua→C# callback, if an inner `pcall` failure cannot safely `throw`, stash via `NestedLuaCallPendingError`; before return, the entry does `TryTake` → `error` → sentinel, and the gate raises. Compatible with the gate protocol.

### 3.4 Initialization timing

After the Lua DLL is loaded and a `lua_State` is created, and before any gated callback is registered, call `LuaCallbackGate.EnsureInitialized()` (e.g. early in `LuaEnv` construction).

---

## 4. Scope

| Configuration | Gate enabled? |
|---------------|---------------|
| Editor + any PUC / LuaJIT (`ZLua.Mono`) | **Yes** |
| Il2Cpp Player | **No** |

### 4.1 Contrast with Il2Cpp

When Il2Cpp’s `zlua-runtime` calls `lua_error`, it requires: **already at a longjmp-safe native top level, with no C++ objects needing destructors on the stack**. That constraint differs from the Mono×JIT SEH problem; **Il2Cpp does not introduce this gate.**

---

## 5. How to build the `zlua_mono_gate` native plugin

The gate **does not link** Lua / LuaJIT; `lua_touserdata` / `lua_error` are injected at runtime by C# `zlua_gate_init`. After changing `zlua_mono_gate.c` or upgrading the toolchain, rebuild and overwrite the Plugins artifacts.

### 5.1 Source and script locations

Package-relative path: `Packages/com.code-philosophy.zlua/ZLua~/mono-native/`

| File | Role |
|------|------|
| `zlua_mono_gate.c` | Gate implementation |
| `build_zlua_mono_gate.ps1` | Windows x64 → `Plugins/lua/zlua_mono_gate.dll` |
| `build_zlua_mono_gate_unix.sh` | macOS / Linux → `Plugins/lua/libzlua_mono_gate.dylib` or `Plugins/lua/libzlua_mono_gate.so` |

`DllImport("zlua_mono_gate")` is mapped by Unity to those filenames (no `lib` prefix on Windows; `libzlua_mono_gate.*` on Unix).

### 5.2 Windows Editor (x64)

**Dependencies:** Visual Studio (MSVC x64 toolset), `vcvars64.bat` discoverable via `vswhere`.

From the repo (PowerShell):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File `
  Packages/com.code-philosophy.zlua/ZLua~/mono-native/build_zlua_mono_gate.ps1
```

Script behavior:

1. Invoke `vcvars64.bat`
2. `cl /O2 /LD /MD` stages to `mono-native/zlua_mono_gate_build.dll` first (avoids occasional stale writes when `/Fe` targets `Plugins` directly)
3. `Copy-Item -Force` overwrites `Plugins/lua/zlua_mono_gate.dll`
4. Clean `.obj` / `.exp` / `.lib` intermediates
5. Print final path, size, and timestamp — **verify the timestamp changed**

After success, confirm:

- Exports: `zlua_gate_init`, `zlua_get_callback_gate`, `zlua_callback_error_sentinel`
- `zlua_gate_init` takes three args: `(touserdata, lua_error, upvalue_pseudo_base)`
- In Unity Inspector, the DLL enables **Editor**, CPU **x86_64** (no need to constrain with a `ZLUA_USE_LUAJIT` define)

### 5.3 macOS Editor

On a **Mac**:

```bash
bash Packages/com.code-philosophy.zlua/ZLua~/mono-native/build_zlua_mono_gate_unix.sh
```

Output: `Plugins/lua/libzlua_mono_gate.dylib` (default `ARCHS="arm64 x86_64"` → universal; `clang -shared -fPIC -O2 -dynamiclib`).
`.meta`: Editor **enabled**, OS **OSX**, CPU **AnyCPU** (matches universal).

### 5.4 Linux Editor

On **Linux**, run the same script:

```bash
bash Packages/com.code-philosophy.zlua/ZLua~/mono-native/build_zlua_mono_gate_unix.sh
```

Output: `Plugins/lua/libzlua_mono_gate.so` (`gcc -shared -fPIC -O2`).

### 5.5 Editor Lua / gate layout (`Plugins/lua`)

```text
Plugins/lua/
  lua51/… lua55/… luajit20/… luajit21/…   # series Editor libs (see 11-MULTI-VERSION §8)
  zlua_mono_gate.dll                      # Windows
  libzlua_mono_gate.dylib                 # macOS
  libzlua_mono_gate.so                    # Linux (optional self-build)
```

**Do not** place these under `Plugins/x64/`, `Plugins/macOS/`, or other platform subfolders.

### 5.6 Maintenance notes

| Item | Notes |
|------|-------|
| ABI | After changing `zlua_gate_init` parameters or the sentinel, update C# `LuaCallbackGate` and rebuild this plugin |
| No Lua link | Switching `lua53` / `luajit21` etc. does **not** require one gate build per Lua |
| Verify overwrite | On Windows, if the script says Built but the `Plugins` file timestamp is unchanged, treat as failure; use the §5.2 stage+copy script |
| Commit | Include updated binaries and `.meta` in version control (or document CI production) |

---

## 6. Implementation index (in package)

| Component | Path (package-relative) |
|-----------|-------------------------|
| Gate C source | `ZLua~/mono-native/zlua_mono_gate.c` |
| Build scripts | `ZLua~/mono-native/build_zlua_mono_gate.ps1` / `build_zlua_mono_gate_unix.sh` |
| Native plugin | `Plugins/lua/zlua_mono_gate*` / `libzlua_mono_gate*` (`DllImport("zlua_mono_gate")`) |
| C# façade | `Runtime/Mono/Utils/LuaCallbackGate.cs` |
| Error boundary | `Runtime/Mono/Utils/LuaCallbackBoundary.cs`, `LuaDllExtension.error` |
| Registration hubs | `ClosurePin`, `ZLuaLib`, `AssemblyRegistry`, `TypeRegistry*`, etc. |

---

## 7. Acceptance checks

- [ ] Rebuilt and overwrote Plugins artifacts per §5 (timestamp / hash updated)
- [ ] Under both PUC and LuaJIT, callback error paths are catchable via `pcall` and the Editor does not crash
- [ ] Success hot paths (field get, method call) behave normally
- [ ] Closures with logical upvalues work on 5.1 / JIT and 5.2+
- [ ] If Lua DLL is unloaded / `gate_init` not called, first Push throws a clear exception instead of a silent crash

---

## 8. Related documents

| Document | Relationship |
|----------|--------------|
| [01-OFFICIAL-LUA.md](/docs/spec/build/01-OFFICIAL-LUA/) / [02-LUAJIT.md](/docs/spec/build/02-LUAJIT/) | Engine builds |
| [10-LIFETIME.md](/docs/spec/10-LIFETIME/) §8 | External C#↔Lua exception semantics |
| Implementation `LuaPrintBuffer` | Deferred `Debug.Log` (complements the gate) |
| In-package `Plugins/README.md` | Plugin filename cheat sheet |
| [04-EMMYLUA-DEBUGGER.md](/docs/spec/build/04-EMMYLUA-DEBUGGER/) | Editor EmmyLua; the debug library must not break this gate’s constraints |
