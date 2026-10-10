---
sidebar_position: 2
title: Initialize and minimal interop
description: Initialize, minimal C#→Lua and Lua→C#, and the first working interop path.
---

# Initialize and minimal interop

This page assumes [Install and Lua versions](/docs/guides/install/) is done. Goal: see both **C# calling Lua** and **Lua calling C#** during Editor Play. For a fuller 5-minute walkthrough, see [Quick start](/docs/getting-started/quick-start/); this page is the formal start of the Guides mainline.

Canonical: [Bootstrap.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs), [Demo.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Demo.cs), [app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua)

## 1. Register the loader and Initialize

```csharp
using System.IO;
using System.Text;
using UnityEngine;
using ZLua;

public class Bootstrap : MonoBehaviour
{
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

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    private static void InitZLuaOnStartup()
    {
        LuaAppDomain.Initialize(LoadLuaModule);
    }
}
```

- `module` is a **logical name** (no path, no extension), e.g. `"app"`
- Return a UTF-8 source string; return `null` if not found
- You do **not** need to create a `LuaState` or register Wrap by hand

## 2. Minimal C# → Lua

The Lua module must `return` a table whose keys are the `GetFunction` method names:

```lua
-- LuaScripts/app.lua
local function main()
    print("lua main start")
end

local function add(a, b)
    return a + b
end

return {
    main = main,
    add = add,
}
```

```csharp
Action AppMain;
Func<int, int, int> AppAdd;

void Awake()
{
    // 须在 Initialize 之后；勿放在与 RuntimeInitializeOnLoadMethod 同类型的 static 字段初始化器里
    AppMain = LuaAppDomain.GetFunction<Action>("app", "main");
    AppAdd = LuaAppDomain.GetFunction<Func<int, int, int>>("app", "add");
}

void Start()
{
    AppMain();
    Debug.Log(AppAdd(10, 20)); // 30
}
```

Cache Delegates yourself on hot paths; `GetFunction` does not guarantee the same instance. Details: [C# calling Lua](/docs/guides/csharp-calling-lua/).

## 3. Minimal Lua → C#

```csharp
// Assets/Demo.cs（示意）
public class Demo
{
    public static int Add(int a, int b) => a + b;
    public int x;
    public void SetX(int v) => x = v;
    public int GetX() => x;
}
```

```lua
CSharp['AC'] = CSharp['Assembly-CSharp']

print(CSharp.AC.Demo.Add(3, 5))   -- 8  静态方法

local demo = CSharp.AC.Demo()     -- 构造
demo:SetX(10)
print(demo.x)                     -- 10 字段 / 无参 Property
```

Types with a namespace must use bracket keys: `CSharp.AC['MyGame.UI.Panel']`. Day-to-day usage: [Lua calling C#](/docs/guides/lua-calling-csharp/).

## Expected output (Editor Play)

```
lua main start
...
30
```

If there is no output: confirm `BeforeSceneLoad` ran, `LoadLuaModule("app")` is not null, and Console is not filtering `Debug`. More diagnosis: [Troubleshooting](/docs/guides/troubleshooting/).

## Next steps

The next page covers **Player builds** (Generate, Sync). The interop APIs themselves are **the same** in Editor / Player; a Player without Generate fails at runtime.

## Learning path

| | |
|---|---|
| **Previous** | [HybridCLR integration](/docs/guides/hybridclr/) |
| **Next** | [Build pipeline](/docs/guides/build/) |

## Related

- [Quick start](/docs/getting-started/quick-start/)
- [C# calling Lua](/docs/guides/csharp-calling-lua/)
- [Lua calling C#](/docs/guides/lua-calling-csharp/)
- [Host API](/docs/spec/01-HOST-API/)
