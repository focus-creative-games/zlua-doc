---
sidebar_position: 4
title: FAQ
description: Frequently asked questions about ZLua.
---

# FAQ

Organized by topic; for gaps see [Troubleshooting](/docs/guides/troubleshooting/) or [GitHub Issues](https://github.com/focus-creative-games/zlua/issues).

## General

### How does ZLua differ from xLua?

ZLua embeds Lua in Il2Cpp with a C++ direct bridge and **does not generate per-type C# Wrap** (Player generates **C++ stubs**). Types are accessed via the `CSharp` root table; C# calls Lua with `LuaAppDomain.GetFunction<T>`. See [Why ZLua](/docs/concepts/why-zlua/), [Comparison](/docs/compare/), [Migrate from xLua](/docs/guides/migration/from-xlua/).

### How different are Mono and Il2Cpp?

**Lua-visible semantics match.** **Mono (Editor) and Il2Cpp (Player) are both done**; implementation paths differ (Emit vs C++ stubs). See [Project status](/docs/getting-started/project-status/).

### Is it production-ready?

Il2Cpp Player can be used for full semantic validation and shipping if you accept **libil2cpp integration** and **`ZLua/Generate/All`**. xLua strengths like Hotfix need to be built yourself. See [Compatibility](/docs/getting-started/compatibility/).

### Which Unity / Lua versions are supported?

See [Compatibility](/docs/getting-started/compatibility/). PUC-Rio **5.1–5.5** supported; **LuaJIT** supported, but **Il2Cpp Player is Android / iOS only** (details: [LuaJIT build](/docs/spec/build/02-LUAJIT/)).

---

## Install & project setup

### How do I install ZLua?

UPM: `"com.code-philosophy.zlua": "https://github.com/focus-creative-games/zlua.git"`. See [Installation](/docs/getting-started/installation/), [zlua-demo](https://github.com/focus-creative-games/zlua-demo).

### Do I need Generate before shipping?

**Il2Cpp: yes.** Menu **`ZLua/Generate/All`** generates C++ MethodBridge and other Lua→C# stubs — **not** xLua-style C# Wrap. Editor Mono does not depend on that C# Wrap flow. **C#→Lua has no Generate step.**

### Where do Lua scripts go?

Project-root `LuaScripts/*.lua` (Editor); Player Sync to `StreamingAssets/LuaScripts/*.lua.txt`.

---

## Types & syntax

### How do I access types with namespaces?

`CSharp.AC['MyGame.UI.Panel']` — do not chain dots through the namespace.

### How do I subscribe to Events?

**No** dedicated `.get` / `.set` tables. Use `obj:add_OnX(handler)` / `obj:remove_OnX(handler)`. See [Event](/docs/guides/lua-calling-csharp/).

### How do ref / out work?

Lua→C#: ByVal userdata or Opaque can write back; bare numbers **do not**. C#→Lua byref defaults to Opaque. See [ref/out/in](/docs/guides/ref-out-in/), [BYREF](/docs/spec/marshal/03-BYREF/).

---

## Interop

### How do I call Lua from C#?

`LuaAppDomain.GetFunction<T>("module","method")` then `Invoke` the Delegate. See [C# calling Lua](/docs/guides/csharp-calling-lua/).

### How are method overloads chosen?

Default `demo:Run(10)` uses dispatch; precise naming uses the full-signature key `demo['Run(System.Int32)'](demo, 10)`; for hot-path short names use Bind-time `[LuaAlias]` then `demo:run_i32(10)`. See [Method overloads](/docs/guides/overloads/).

### How does Lua pass callbacks to C#?

Pass a `function` directly. See [Functions & Delegates](/docs/guides/functions/).

---

## Player / shipping

### Editor works but Player fails?

Check: whether **Generate** ran; whether Lua was Synced; whether deprecated Event APIs are used. See [Editor vs Player](/docs/guides/editor-vs-player/), [Troubleshooting](/docs/guides/troubleshooting/).

### How is Player performance?

Treat Il2Cpp as truth. Public four-way benchmark: [zlua-benchmark](https://github.com/focus-creative-games/zlua-benchmark); summary: [PERFORMANCE](/docs/compare/PERFORMANCE/); latest full report: [comparison_20260728_121554.md](https://github.com/focus-creative-games/zlua-benchmark/blob/main/reports/comparison_20260728_121554.md).

---

## Related

- [Troubleshooting](/docs/guides/troubleshooting/)
- [Spec overview](/docs/spec/00-OVERVIEW/)
- [Contact & support](/docs/community/contact/)
