---
sidebar_position: 3.5
title: EmmyLua debugger
description: Breakpoint-debug running Lua with EmmyLua under Editor Mono (common setup).
---

# EmmyLua debugger

In **Unity Editor (`ZLua.Mono`)**, use [EmmyLua](https://github.com/EmmyLua/EmmyLuaDebugger) to breakpoint-debug your Lua. After `Initialize`, the host automatically `tcpListen`s; attach from the IDE.

:::info Scope
**Editor only.** Does not cover Il2Cpp Player / devices / WebGL. Full conventions: [Spec · EmmyLua debugger](/docs/spec/build/04-EMMYLUA-DEBUGGER/).
:::

## Quick enable

1. **Project Settings → ZLua**
   - `enableDebugger` = **true** (off by default)
   - `debuggerPort` = **9966** (must match the IDE)
   - `debuggerWaitIDE` = **false** (recommended; `true` blocks the main thread with no timeout and can freeze the Editor)
2. Confirm the current Lua series has a matching `emmy_core` (see below)
3. Unity **Play** (triggers `Initialize`); Console shows `EmmyLua debugger listening on 127.0.0.1:…`
4. In the IDE, **F5** with the `launch.json` below → set breakpoints under the source root `.lua` files and run into those modules

Recommended order: **Play first so the port is listening, then connect from the IDE**; do not turn on `waitIDE` immediately.

## `emmy_core` and Lua versions

The package **ships only** the **Lua 5.5** libraries: `Plugins/emmylua/lua55/<platform>/emmy_core.*`.

| Your Settings version | Directory | Notes |
|--------------------|------|------|
| `lua-5.5.*` | `lua55/` | Works out of the box |
| 5.1–5.4 / LuaJIT | `lua53/`, `luajit21/`, etc. | Build yourself per [EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger) and place under the matching series directory |

**Do not** copy the 5.5 `emmy_core` into other series directories as a stopgap. If the directory is missing, Console logs an error and **skips the debugger** without aborting `Initialize`.

`emmy_core` must be a **Lua C module** (loaded via `require`): its PluginImporter should be **disabled on all platforms**; do not enable it as a normal Unity native plugin.

## IDE setup (VS Code / Cursor)

Install the **EmmyLua** extension and open the **Unity project root** in the IDE (the layer that contains `Packages`). Example `.vscode/launch.json`:

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
        "${workspaceFolder}/LuaScripts"
      ],
      "ext": [".lua"],
      "ideConnectDebugger": true
    }
  ]
}
```

| Field | Notes |
|------|------|
| `host` | Use **`127.0.0.1`** (avoid `localhost` → IPv6 connection failures) |
| `port` | Same as Settings `debuggerPort` |
| `sourcePaths` | **Required**: point at the Lua root used by `moduleLoader` (Demo often `LuaScripts`; test projects may use `Tests/Lua`) |
| `ideConnectDebugger` | `true`: connect to an Editor that already `tcpListen`s |

Connected but breakpoints stay grey / Could not load source → almost always a wrong **`sourcePaths`**. Append more roots in the array if needed.

Optional `.emmyrc.json` only affects completion/diagnostics; it does **not** replace `sourcePaths`. With many `CSharp` globals you can silence `undefined-global` noise.

## FAQ

| Symptom | Fix |
|------|------|
| `debugger skipped` / missing directory | No `Plugins/emmylua/<series>/` for current series; non-5.5 needs a custom build |
| IDE cannot connect | Whether Play already listens; port / `127.0.0.1`; firewall |
| Breakpoints never hit | `sourcePaths`; whether the workspace is the project root |
| Editor freezes after Play | Turn off `debuggerWaitIDE`, or F5 before Play |
| Extension has no `emmylua_new` | Install/enable EmmyLua and reload the window |

## Learning path

| | |
|---|---|
| **Previous** | [Build pipeline](/docs/guides/build/) |
| **Next** | [Lua calling C#](/docs/guides/lua-calling-csharp/) |

## Related

- [Spec · EmmyLua debugger](/docs/spec/build/04-EMMYLUA-DEBUGGER/) — ABI directories, custom builds, `waitIDE`, acceptance checklist
- [Third-party native modules](/docs/guides/native-modules/) — same `cpath` + `require` pattern for socket/cjson, etc.
- [Install and Lua versions](/docs/guides/install/)
- [Initialize and minimal interop](/docs/guides/hello-interop/)
- [Upstream EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger)
