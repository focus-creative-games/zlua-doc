---
sidebar_position: 5
title: LuaAppDomain
description: Initialize, Reset, and GetFunction — obtain a Delegate for a Lua function from C#.
---

# LuaAppDomain

`LuaAppDomain` is ZLua's **only public host entry**: initialize / domain-reset Lua, and use **`GetFunction`** to obtain a Delegate for a Lua function by module and name. The host surface does **not** expose `Shutdown`; clearing the script world goes only through `Reset`.

Canonical example: [zlua-demo Bootstrap.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs)

## API

```csharp
namespace ZLua
{
    public static class LuaAppDomain
    {
        public static void Initialize(Func<string, object> moduleLoader);
        public static void Reset(Func<string, object> moduleLoader);

        public static T GetFunction<T>(string luaModule, string luaMethodName)
            where T : MulticastDelegate;
    }
}
```

Authoritative details: [spec/01-HOST-API.md](/docs/spec/01-HOST-API/), [spec/10-LIFETIME.md](/docs/spec/10-LIFETIME/) §7.

---

### `Initialize(moduleLoader)`

| Parameter | Description |
|-----------|-------------|
| `moduleLoader` | `Func<string, object>`; returns Lua source as **string** or **byte[]** by module name |

Only on first use (or when there is no main `lua_State` yet) create the state and install the loader. Calling again when **already initialized** → **throws** (use `Reset`; **no** longer supports “swap loader only”).

```csharp
[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
private static void InitZLuaOnStartup()
{
    LuaAppDomain.Initialize(LoadLuaModule);
}
```

`LoadLuaModule` handles Editor (`LuaScripts/*.lua`) vs Player (`StreamingAssets/*.lua.txt`) path differences; see [installation guide](/docs/getting-started/installation/).

---

### `Reset(moduleLoader)`

Hot reload or clear the script world: tear down the single main `lua_State`, then recreate it with the given loader.

| Behavior | Description |
|----------|-------------|
| At call site | **Schedule only**: store the loader; later schedules keep the last one. Does **not** `lua_close` immediately |
| When applied | This frame’s **EndOfFrame** (`LuaFramePump` / `WaitForEndOfFrame`): drain pending refs → shut down Registry / module cache → `lua_close` → rebuild via the Initialize path and install the loader |
| Old delegates | After EndOfFrame applies, invoking old `GetFunction` delegates → throws a C# exception; the host must re-`GetFunction` and discard field caches |
| Il2Cpp | Process-level Bridge / XML tables / InternalCall are **kept**; only state-level resources are rebuilt |

```csharp
// Clear the script world after hot reload (safe mid C#↔Lua call; queues only)
LuaAppDomain.Reset(LoadLuaModule);
// From the next frame: drop old Action/Func, re-GetFunction
```

---

### `GetFunction<T>(luaModule, luaMethodName)`

Resolve a Lua `function` by module and method name, bind it to delegate type `T`, and return it.

```csharp
var add = LuaAppDomain.GetFunction<Func<int, int, int>>("app", "add");
int sum = add(10, 20);

var onTick = LuaAppDomain.GetFunction<Action<float>>("game", "OnTick");
onTick(0.016f);
```

| Rule | Description |
|------|-------------|
| `T` | Must be a concrete `MulticastDelegate` type (e.g. `Action<>` / `Func<>`) |
| `luaModule` / `luaMethodName` | Must match `LoadLuaModule` module name and Lua `return { ... }` key |
| Caching | **Caller's responsibility** (on hot paths, store in a field / local before invoking); after `Reset` takes effect, old delegates are invalid and must be rebound |
| Marshal | `Invoke` on the returned delegate follows the [Marshal cheatsheet](/docs/reference/marshal-cheatsheet/); `[LuaMarshalAs]` may apply |

Missing module, key that is not a function, or failure to bind as `T` → throws a C# exception.

---

## Initialization Flow

```mermaid
sequenceDiagram
    participant App as Game startup
    participant LAD as LuaAppDomain
    participant BE as Backend Mono / Il2Cpp
    participant L as lua_State

    App->>LAD: Initialize(moduleLoader)
    LAD->>BE: Resolve ZLua.Mono or ZLua.Il2Cpp
    BE->>L: Create state, openlibs, register CSharp / zlua
    BE->>BE: Install moduleLoader, FramePump
    LAD-->>App: Ready for GetFunction / CSharp access
    Note over App,L: On hot-reload clear, App calls Reset; EndOfFrame runs teardown + rebuild
```

## Dual-Runtime Forwarding

`LuaAppDomain` itself lives in `ZLua.Common`; real logic is implemented by the backend assembly:

| Environment | Assembly | Implementation type |
|-------------|----------|---------------------|
| Unity Editor | `ZLua.Mono` | `LuaMonoAppDomain` |
| Il2Cpp Player | `ZLua.Il2Cpp` | `LuaIl2CppAppDomain` |

`Application.isEditor` chooses which backend to load; the **public API stays the same**.

## Lifetime and FramePump

After init, `LuaFramePump` is registered and, in the Unity frame loop, handles:

- `LateUpdate`: deferred release of ref / userdata (`ProcessPendingRefReleases`)
- `WaitForEndOfFrame`: run a scheduled `Reset` (domain teardown + rebuild)

Usually **no** manual frame-pump calls are needed.

## Relationship to `LuaEnv`

| Type | Visibility | Description |
|------|------------|-------------|
| `LuaAppDomain` | **public** | Sole entry for game code (`Initialize` / `Reset` / `GetFunction`) |
| `LuaEnv` | public (Mono module) | Wrapper for underlying `lua_State`; created by the backend. **Do not** `new LuaEnv()` in business code |

Standard integration path: `LuaAppDomain.Initialize` → `GetFunction` / `CSharp` access; use `Reset` to clear after hot reload.

## Module Loading Convention

The return value of `moduleLoader("app")` is loaded with `require` semantics. The **module** argument to `GetFunction(..., "app", ...)` must match.

| Environment | Path |
|-------------|------|
| Editor | `{ProjectRoot}/LuaScripts/app.lua` |
| Player | `StreamingAssets/LuaScripts/app.lua.txt` |

## Common Errors

| Symptom | Fix |
|---------|-----|
| `Lua module loader is not configured` | `Initialize` not called, or loader is null |
| Second `Initialize` throws | Main state already exists; use `Reset(loader)` |
| `require` / GetFunction fails | Check module name, file path, `.lua.txt` suffix, `return` table keys |
| Old delegate throws after Reset | Discard cached `Action`/`Func`, re-`GetFunction` |
| No Lua scripts in Player | Confirm Sync script ran; StreamingAssets contains target files |
| Marshal / bind failure | Cross-check [Marshal cheatsheet](/docs/reference/marshal-cheatsheet/) and `T` signature |

## Related

- [C# calling Lua guide](/docs/guides/csharp-calling-lua/)
- [Function and Delegate](/docs/guides/functions/)
- [Lua module loading](/docs/guides/csharp-calling-lua/)
- [Design spec](/docs/spec/00-OVERVIEW/)
- [Source LuaAppDomain.cs](https://github.com/focus-creative-games/zlua/blob/main/Runtime/Common/LuaAppDomain.cs)
