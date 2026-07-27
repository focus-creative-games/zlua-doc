---
sidebar_position: 2
title: 初始化与最小互调
description: Initialize、最简 C#→Lua 与 Lua→C#，跑通第一条互操作路径。
---

# 初始化与最小互调

本篇假定已完成 [安装与 Lua 版本](/docs/guides/install/)。目标：在 Editor Play 时同时看到 **C# 调 Lua** 与 **Lua 调 C#**。更完整的 5 分钟对照可看 [快速开始](/docs/getting-started/quick-start/)；本篇是使用指南主线的正式起点。

Canonical：[Bootstrap.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs)、[Demo.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Demo.cs)、[app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua)

## 1. 注册 loader 并 Initialize

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

- `module` 为**逻辑名**（无路径、无扩展名），如 `"app"`  
- 返回 UTF-8 源码字符串；找不到返回 `null`  
- **不需要**手动创建 `LuaState` / 注册 Wrap  

## 2. 最简 C# → Lua

Lua 模块须 `return` 一张表，键名即 `GetFunction` 的 method：

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

热路径请自行缓存 Delegate；`GetFunction` 不保证返回同一实例。详解见 [C# 调用 Lua](/docs/guides/csharp-calling-lua/)。

## 3. 最简 Lua → C#

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

含 namespace 的类型必须用括号键：`CSharp.AC['MyGame.UI.Panel']`。日常用法见 [Lua 调用 C#](/docs/guides/lua-calling-csharp/)。

## 预期输出（Editor Play）

```
lua main start
...
30
```

若无输出：确认 `BeforeSceneLoad` 已执行、`LoadLuaModule("app")` 非 null、Console 未过滤 `Debug`。更多排查见 [排错指南](/docs/guides/troubleshooting/)。

## 下一步

下一篇处理 **Player 构建**（Generate、Sync）。互调 API 本身在 Editor / Player **相同**；未 Generate 的 Player 会在运行期失败。






## 学习路径

| | |
|---|---|
| **上一篇** | [安装与 Lua 版本](/docs/guides/install/) |
| **下一篇** | [构建流程](/docs/guides/build/) |

## 相关文档

- [快速开始](/docs/getting-started/quick-start/)  
- [C# 调用 Lua](/docs/guides/csharp-calling-lua/)  
- [Lua 调用 C#](/docs/guides/lua-calling-csharp/)  
- [宿主 API](/docs/spec/01-HOST-API/)
