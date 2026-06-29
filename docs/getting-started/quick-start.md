---
sidebar_position: 1
title: 快速开始
description: 5 分钟跑通 ZLua 最小 C# ↔ Lua 互操作示例。
---

# 快速开始

本页展示 ZLua 最核心的用法：**C# 调用 Lua** 与 **Lua 访问 C#**，无需额外配置。

完整可运行示例见 [ZLua-Demo](https://github.com/focus-creative-games/zlua-demo)。

## 1. 初始化

在 Unity 启动时初始化 `LuaAppDomain`，并提供 Lua 模块加载器：

```csharp
public class Bootstrap : MonoBehaviour
{
    private static string LoadLuaModule(string module)
    {
        string path = Path.Combine(
            Application.streamingAssetsPath, "LuaScripts", module + ".lua.txt");
        return File.Exists(path)
            ? File.ReadAllText(path, Encoding.UTF8)
            : null;
    }

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    private static void InitZLuaOnStartup()
    {
        LuaAppDomain.Initialize(LoadLuaModule);
    }
}
```

:::tip
**不需要任何额外配置**，仅需设置 `LuaLoader` 即可。以下示例在 **Editor（Mono）** 下可完整运行；构建 **Il2Cpp Player** 时请确认未使用 Player 尚未支持的能力（泛型、重载显式绑定等），详见 [项目状态](./project-status)。
:::

## 2. C# 调用 Lua

用 `[LuaInvoke("module", "method")]` 标记 `static extern` 函数：

```csharp
[LuaInvoke("app", "main")]
private static extern void AppMain();

[LuaInvoke("app", "add")]
private static extern int AppAdd(int a, int b);

void Start()
{
    AppMain();
    int value = AppAdd(10, 20);
    Debug.Log($"AppAdd(10,20)={value}");
}
```

对应 Lua 模块 `app.lua.txt`：

```lua
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

## 3. Lua 访问 C# 类型

通过 `CSharp.{assembly name}.{full type name}` 访问 C# 类型，用法与 C# 一致：

```lua
-- 程序集别名（可选，简化长程序集名）
CSharp['AC'] = CSharp['Assembly-CSharp']

-- 静态方法
print(CSharp.AC.Demo.Add(3, 5))

-- 实例化与成员访问
local demo = CSharp.AC.Demo()
demo.x = 10
print(demo:GetX())

-- 静态成员
CSharp.AC.Demo.s_x = 10
```

### 访问规则速记

| 操作 | Lua 写法 |
|------|----------|
| 构造实例 | `CSharp.AC.Demo()` |
| 实例字段/属性 | `demo.x` / `demo:SetX(10)` |
| 实例方法 | `demo:Run(10)` |
| 静态字段/属性 | `CSharp.AC.Demo.s_x` |
| 静态方法 | `CSharp.AC.Demo.Add(3, 5)` |

含命名空间的类型须用括号访问：`CSharp.AC['MyGame.UI.Panel']`。详见 [Lua 访问 C# 基础](../guides/lua-to-csharp-basics)。

## 4. 方法重载（进阶）

多重重载时，可用 `zlua.signature` 显式绑定：

```lua
local sig_i32 = zlua.signature(zlua.types.int32)
local run_i32 = zlua.get_method(demo, "Run", sig_i32, false)
run_i32(demo, 10)
```

详见 [方法重载](../guides/methods-and-overloads)。

## 下一步

- [安装与集成](./installation)
- [C# 调用 Lua](../guides/csharp-to-lua)
- [Lua 访问 C#](../guides/lua-to-csharp-basics)
