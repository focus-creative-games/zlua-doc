---
sidebar_position: 5
title: C# calling Lua
description: GetFunction, module return conventions, and Editor/Player load paths.
---

# C# calling Lua

Use **`LuaAppDomain.GetFunction<T>`** to obtain a bound Delegate by module and method name, then invoke it. The **API is the same** in Editor and Player.

Canonical: [Bootstrap.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs)

## Basic usage

```csharp
var main = LuaAppDomain.GetFunction<Action>("app", "main");
main();

var add = LuaAppDomain.GetFunction<Func<int, int, int>>("app", "add");
int sum = add(10, 20);
```

```lua
local function add(a, b)
    return a + b
end

return {
    main = main,
    add = add,
}
```

| Rule | Notes |
|------|------|
| Call `Initialize` first | Otherwise an exception is thrown |
| `T : MulticastDelegate` | Concrete `Action` / `Func` / custom delegates |
| module / method | `"app","add"` ↔ `return { add = ... }` |
| Caching | Cache yourself on hot paths; same instance is not guaranteed |
| Timing | Must be **after** `Initialize`; do not put in a static field initializer on the same type as `RuntimeInitializeOnLoadMethod` |

## Module loading

`GetFunction("app", …)` requires `LoadLuaModule("app")` to return source.

| Environment | Typical path |
|------|----------|
| Editor | `{ProjectRoot}/LuaScripts/app.lua` |
| Player | `StreamingAssets/LuaScripts/app.lua.txt` |

```csharp
private static string LoadLuaModule(string module)
{
#if UNITY_EDITOR
    string path = Path.Combine(Application.dataPath, "..", "LuaScripts", module + ".lua");
#else
    string path = Path.Combine(
        Application.streamingAssetsPath, "LuaScripts", module + ".lua.txt");
#endif
    return File.Exists(path) ? File.ReadAllText(path, Encoding.UTF8) : null;
}
```

Key points:

- Modules must **`return { key = fn }`**; the key name = GetFunction’s method
- Nested paths: `module.Replace('.', '/')` (e.g. `battle.ai`)
- Sync before Player builds; see [Build workflow](/docs/guides/build/)
- For hot reload / clearing the script world use `LuaAppDomain.Reset(loader)` (takes effect at EndOfFrame; old `GetFunction` delegates are invalid and must be rebound); **no** longer supports “swap loader only” on an already-initialized domain. Note StreamingAssets is read-only on Android

### Multiple modules

```csharp
var appMain = LuaAppDomain.GetFunction<Action>("app", "main");
var battleTick = LuaAppDomain.GetFunction<Action<float>>("battle", "tick");
```

## Compared with “function as a parameter”

| Scenario | Approach |
|------|------|
| C# **actively** calls a Lua-exported function | `GetFunction<T>(module, method)` |
| C# parameter is `Action`/`Func`, Lua passes `function` | **Implicit** marshal; see [Function](/docs/guides/functions/) |
| Lua already has a function; need a specific delegate type | `zlua.to_delegate` |

## Common mistakes

| Symptom | Fix |
|------|------|
| `module 'app' not found` | Editor/Player paths; whether Sync ran |
| GetFunction result invalid / call has no effect | Not Initialize’d; return-table key mismatch |
| Old scripts still running | Player not re-Synced |

## Learning path

| | |
|---|---|
| **Previous** | [Lua calling C#](/docs/guides/lua-calling-csharp/) |
| **Next** | [Value types](/docs/guides/value-types/) |

## Related

- [Host API](/docs/spec/01-HOST-API/)
- [LuaAppDomain reference](/docs/reference/csharp/lua-app-domain/)
- [Function and Delegate](/docs/guides/functions/)
- [Build workflow](/docs/guides/build/)
