---
sidebar_position: 3
title: Supported versions & platforms
description: Unity, Lua versions, platforms, and feature matrix supported by ZLua.
---

# Supported versions & platforms

## Lua engines

| Version | Mono (Editor) | Il2Cpp (Player) | Notes |
|------|:-------------:|:---------------:|------|
| Lua **5.1.x** | ✅ | ✅ | Optional in Settings (e.g. `lua-5.1.5`); no VM FastMT patch |
| Lua **5.2.x** | ✅ | ✅ | Optional in Settings (e.g. `lua-5.2.4`); no VM FastMT patch |
| Lua **5.3.x** | ✅ | ✅ | Optional in Settings; **default is `lua-5.5.0`** |
| Lua **5.4.x** | ✅ | ✅ | Optional in Settings |
| Lua **5.5.x** | ✅ | ✅ | Optional in Settings |
| LuaJIT | ✅ | ⚠️ | Available in Editor (Mono); **Il2Cpp Player only Android / iOS** (bring your own static libs — see [LuaJIT build](/docs/spec/build/02-LUAJIT/)) |
| [Luau](https://luau.org/) | 🔜 | 🔜 | Planned |

PUC-Rio patch versions use Settings `luaVersionId` (`lua-X.Y.Z`); LuaJIT uses `luajit-M.N` (you must clone sources). Install loads them into the local tree. See [Installation](/docs/getting-started/installation/), [Multi-version](/docs/spec/11-MULTI-VERSION/).

## Unity

| Version | Status |
|------|------|
| Unity **6000.0.x** | ✅ Supported |
| Unity **6000.3.x** | ✅ Supported |
| Unity **6000.5.x** | ✅ Supported |
| Unity 2022.3 LTS | ✅ Supported |
| Unity 2021.3 LTS | ✅ Supported |
| Tuanjie Engine LTS | ✅ Supported |

libil2cpp patch resolution: prefer `patches/libil2cpp/6000.{minor}/`, then fall back to `6000/` (see [Multi-version](/docs/spec/11-MULTI-VERSION/)).

## Scripting Backend

| Backend | Environment | Feature status |
|------|------|----------|
| **Il2Cpp** | Player shipping | **Done** (authoritative implementation) |
| **Mono** | Unity Editor | **Done** (Lua-visible semantics match Il2Cpp) |

Lua-visible semantics match on both ends; Indexer / bridge implementations differ. See [Project status](/docs/getting-started/project-status/), [Spec](/docs/spec/00-OVERVIEW/).

**Il2Cpp builds:** before shipping, run **`ZLua/Generate/All`** (C++ stubs, not C# Wrap).

## Target platforms (Il2Cpp)

| Engine | Il2Cpp Player platforms |
|------|-------------------|
| **PUC-Rio (Lua 5.1–5.5)** | Designed for common Il2Cpp targets (Windows, macOS, iOS, Android, WebGL, WeChat mini games, HarmonyOS / vehicle, etc.) |
| **LuaJIT** | **Android and iOS only**; Win / macOS / Linux / WebGL etc. **unsupported**. Build static `.a` into Plugins yourself — see [LuaJIT build](/docs/spec/build/02-LUAJIT/) |

For other platform issues, please file an Issue.

---

## Feature × runtime matrix

✅ Available · ⚠️ Limited (see notes) · ❌ Unsupported (intentional). Details follow the [Spec](/docs/spec/00-OVERVIEW/).

### Lua calling C#

| Feature | Mono | Il2Cpp | Notes |
|------|:----:|:------:|------|
| class / struct access | ✅ | ✅ | Lazy bind; no C# Wrap whitelist |
| Instance / static fields | ✅ | ✅ | |
| Instance / static methods | ✅ | ✅ | |
| Property (no args) | ✅ | ✅ | |
| Property (indexer) | ✅ | ✅ | Via method forms `get_Item` / `set_Item`; see [Fields & properties](/docs/guides/lua-calling-csharp/) |
| Method overload dispatch | ✅ | ✅ | |
| `[LuaAlias]` / full-signature keys | ✅ | ✅ | Short names only via Bind-time aliases; no runtime `register_method` |
| Generic class / method | ✅ | ✅ | Open generics must be closed first; static generic methods have limits |
| Array (szarray / mdarray) | ✅ | ✅ | mdarray cannot be table-serialized |
| Event-specific metatable | ❌ | ❌ | Use ordinary `add_` / `remove_` methods |
| Delegate / Lua callbacks | ✅ | ✅ | Lua→C# byref params have limits |

### C# calling Lua

| Feature | Mono | Il2Cpp |
|------|:----:|:------:|
| `GetFunction<T>` | ✅ | ✅ |
| Multi-arg / multi-return | ✅ | ✅ |
| `[LuaMarshalAs]` | ✅ | ✅ | Some types — see Spec |

### Marshal

| Type | Mono | Il2Cpp |
|------|:----:|:------:|
| Primitives / string | ✅ | ✅ |
| enum (default integer) | ✅ | ✅ |
| class / struct (ByVal / ByObj / Opaque) | ✅ | ✅ |
| array | ✅ | ✅ |
| OpaqueValue / byref | ✅ | ✅ | See [BYREF](/docs/spec/marshal/03-BYREF/), [OPAQUE](/docs/spec/marshal/04-OPAQUE/) |

### Standard library `zlua`

| API | Mono | Il2Cpp |
|-----|:----:|:------:|
| `typeof` / `get_type_from_name` / `make_generic_*` / `inflate` | ✅ | ✅ |
| szarray / mdarray factories | ✅ | ✅ |
| opaque get/set, `box`/`unbox` | ✅ | ✅ |

## Recommended environments

| Goal | Recommended |
|------|----------|
| Feature work, script iteration | **Editor (Mono)** |
| Shipping & performance | **Il2Cpp Player** + Generate |
| Semantic disputes | Follow the **spec** |

## Next steps

- [Project status](/docs/getting-started/project-status/)
- [Editor vs Player](/docs/guides/editor-vs-player/)
- [Comparison](/docs/compare/)
