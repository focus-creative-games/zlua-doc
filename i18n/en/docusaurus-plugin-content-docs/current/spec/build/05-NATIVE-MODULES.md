---
sidebar_position: 5
title: "Third-party native modules"
---

# Build — Third-party native modules (socket / cjson, etc.)

> Defines how a game project wires **non–zlua-shipped** Lua C modules (e.g. lua-cjson, luasocket) into ZLua.
> Does **not** vendor concrete third-party libraries into `com.code-philosophy.zlua`.
> Editor precedent: [04-EMMYLUA-DEBUGGER](/docs/spec/build/04-EMMYLUA-DEBUGGER/); multi-version: [11-MULTI-VERSION](/docs/spec/11-MULTI-VERSION/); host: [01-HOST-API](/docs/spec/01-HOST-API/).
> How-to guide: [Third-party native plugins](/docs/guides/native-modules/).

---

## 1. Goals and non-goals

### 1.1 Goals

| Item | Convention |
|------|------------|
| Business API | Uniform `require("modname")`, independent of implementation shape |
| Editor | Dynamic library + `package.cpath` + `require` (`luaopen_*`) |
| Player (Il2Cpp) | Statically linked into the same artifact + `luaL_requiref` / `package.preload` |
| Pure Lua | Via `moduleLoader` / custom searchers only; no native |
| ABI | **Same series** as Settings `luaVersionId` |

### 1.2 Non-goals

| Item | Stance |
|------|--------|
| Shipping socket / cjson binaries or sources in the package | **Not done** (license, size, version matrix) |
| Relying on `dlopen` + `cpath` on Player | **Not recommended** (iOS / WebGL; costly on Android) |
| Changing C#↔Lua interop semantics | **Not done** |
| Replacing `moduleLoader` for `.lua` | **Not done**; native and source paths are orthogonal |

### 1.3 Current state (implementation boundary)

| Capability | Behavior |
|------------|----------|
| `luaL_openlibs` | Standard libraries only (Mono `LuaEnv` / Il2Cpp `LuaEnv::RegisterLibs`) |
| `moduleLoader` | Returns module source **only** (string / byte[]); does not load `.dll/.so` |
| EmmyLua `emmy_core` | The only formal in-package C-module integration precedent |
| Public `OpenLib` / `RegisterNativeModule` API | **None today**; productization hooks in §6 |

---

## 2. Shape comparison

| Shape | Host | Load |
|-------|------|------|
| A Pure Lua | Editor + Player | `moduleLoader(name)` → `load` |
| B Native dynamic | **Editor Mono only** | `package.cpath` → `require` → `luaopen_*` |
| C Native static | **Il2Cpp Player** | Link `luaopen_*` → `luaL_requiref` / preload |

After changing `luaVersionId`: every native plugin must be **rebuilt for the new series** and directories switched.

---

## 3. Editor (shape B)

### 3.1 Layout

Split by **series** (same logical names as `Plugins/lua/<series>/`, `Plugins/emmylua/<series>/`), for example:

```text
<project>/zlua-native-modules/
  lua55/<os>/cjson.<ext>
  lua55/<os>/socket_core.<ext>
  luajit21/<os>/...
```

`<ext>`: Windows `dll`, macOS `dylib`, Linux Editor `so`.

### 3.2 PluginImporter

Same as EmmyLua: **`enabled: 0` on all platforms**.
Rationale: modules load via Lua `require`/`loadlib`; Unity `LoadLibrary` then `require` is undefined / double-load.

### 3.3 Injection

After `LuaAppDomain.Initialize` completes and standard libraries are open:

1. Resolve the current series and OS to an absolute directory `absDir`;
2. If `package.cpath` does not yet contain that directory entry, append `absDir/?.ext`;
3. Optionally `require` eagerly, or rely on the first business `require`;
4. Composite libraries (luasocket): ensure `socket.core` can load from C first; pure-Lua shells go through `moduleLoader`.

Implementations may follow in-package `EmmyLuaDebugger.BuildInitChunk` (dedupe append, log-only on missing dir, etc. — project-defined).

### 3.4 Linking

- Plugins must **dynamically link** the same-series Editor Lua DLL (e.g. `lua55.dll`), with matching symbols and calling convention.
- **Do not** statically embed a second Lua interpreter inside the plugin.

---

## 4. Il2Cpp Player (shape C)

### 4.1 Bring into the link

Choose one (project-owned build):

- Compile plugin `.c/.cpp` into the same compile units as `libil2cpp` (including `libil2cpp/lua`); or
- Provide platform static libraries (`.a` / `.lib`) and fold them into the iOS / Android / Windows Il2Cpp link; on iOS, exports must be visible to Lua as `__Internal`.

Must match the Lua patch version / Defines chosen by Install (`ZLUA_LUA_5_x` / `ZLUA_USE_LUAJIT`, etc.).

### 4.2 Registration timing

**After** `luaL_openlibs` and **before** business scripts run (conceptually right after `LuaEnv::RegisterLibs`):

```cpp
luaL_requiref(L, "cjson", luaopen_cjson, 1);
lua_pop(L, 1);
```

Or set `package.preload["cjson"] = luaopen_cjson` (and luasocket’s `socket.core`, etc.), then `require` the pure-Lua shell.

### 4.3 Forbidden

- Using Player-runtime `package.cpath` + standalone `.so` as the **primary path** (especially iOS, WebGL).
- Assuming new `luaopen_*` symbols are picked up without a fresh **Install / player build**.

---

## 5. Project-side bootstrap (recommended)

```text
NativeModuleBootstrap.Install(...)
  Editor  → resolve series, append cpath, optional pre-require
  Player  → no-op (registration already done in native) or assert package.loaded
```

Lifecycle: `Initialize(moduleLoader)` → Bootstrap → business `require`.

Pure-Lua shells (e.g. official `socket.lua`) always go through the same `moduleLoader`, so Editor/Player paths stay aligned.

---

## 6. Productization hooks (reserved, not current implementation)

To reduce per-project boilerplate, zlua **may** later add thin extension points with no concrete library dependency:

| Side | Suggestion |
|------|------------|
| Mono | Optional callback / Settings search-path list after `luaL_openlibs` |
| Il2Cpp | Weak symbols or a generated table (e.g. `ZLuaNativeModules.inc`) after `RegisterLibs` calling `luaL_requiref` |
| Settings | Path-convention fields similar to `luaAliasXmlPaths` (optional) |

Still **does not** vendor any third-party library source or binary by default.

---

## 7. Library reference (informational)

| Library | `require` / open | Notes |
|---------|------------------|-------|
| lua-cjson | `cjson` / `luaopen_cjson` | Watch 5.3+ integer vs JIT separate builds |
| luasocket | `socket` + `socket.core` / `luaopen_socket_core` | Mobile blocking and permissions; C# networking can substitute |
| Pure Lua JSON | Any module name | Shape A |

---

## 8. Acceptance

- [ ] Editor `require` of the target module succeeds for the selected series
- [ ] At least one Player target runs the same script successfully
- [ ] PluginImporter entries are all disabled
- [ ] After switching `luaVersionId`, old binaries fail clearly rather than silent ABI corruption
- [ ] Plugin does not statically embed a second Lua

## Related documents

- [Third-party native plugins (guide)](/docs/guides/native-modules/)
- [04-EMMYLUA-DEBUGGER](/docs/spec/build/04-EMMYLUA-DEBUGGER/)
- [01-OFFICIAL-LUA](/docs/spec/build/01-OFFICIAL-LUA/) · [02-LUAJIT](/docs/spec/build/02-LUAJIT/)
- [11-MULTI-VERSION](/docs/spec/11-MULTI-VERSION/)
