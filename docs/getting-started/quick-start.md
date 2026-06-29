---
sidebar_position: 1
title: 快速开始
description: 基于 zlua-demo 从零跑通 C# ↔ Lua 互操作。
---

# 快速开始

本教程基于官方示例 [zlua-demo](https://github.com/focus-creative-games/zlua-demo)，逐步完成 **C# 调用 Lua** 与 **Lua 访问 C#**。建议先 clone Demo 工程对照操作。

:::tip 示例源码
| 组件 | 链接 |
|------|------|
| C# 入口 | [Assets/Bootstrap.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs) |
| C# 类型 | [Assets/Demo.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Demo.cs) |
| Lua 模块 | [LuaScripts/app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua) |
:::

## 前置条件

- 已完成 [安装与集成](./installation)，或已 clone zlua-demo
- Unity **2022.3**，Editor 下 Play 验证（Mono 全功能）

## 第 1 步：初始化 ZLua

`Bootstrap` 在场景加载前注册 Lua 加载器并初始化域：

```csharp
[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
private static void InitZLuaOnStartup()
{
    LuaAppDomain.Initialize(LoadLuaModule);
}
```

`LoadLuaModule("app")` 在 Editor 下读取 `LuaScripts/app.lua`（见 [Bootstrap.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs)）。

**不需要**手动创建 `LuaState`、执行 `require` 或注册 wrap——ZLua 启动时完成全局 CLR 与 Lua 环境集成。

## 第 2 步：C# 调用 Lua

用 `[LuaInvoke("module", "method")]` 声明 `static extern` 函数：

```csharp
[LuaInvoke("app", "main")]
private static extern void AppMain();

[LuaInvoke("app", "add")]
private static extern int AppAdd(int a, int b);

void Start()
{
    AppMain();
    int value = AppAdd(10, 20);
    Debug.Log($"AppAdd(10,20)={value}");  // 30
}
```

对应 Lua 模块末尾 **必须** `return` 一个表，导出函数名：

```lua
local function main()
    print("lua main start")
    -- ...
end

local function add(a, b)
    return a + b
end

return {
    main = main,
    add = add,
}
```

完整逻辑见 [LuaScripts/app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua)。

### 预期 Console 输出（Editor Play）

```
lua main start
[test_call_static_method] start
Demo.Add: 8
...
AppAdd(10,20)=30
```

## 第 3 步：Lua 访问 C# 类型

### 程序集别名

Lua 中通过 `CSharp` 根表懒加载程序集与类型：

```lua
CSharp['AC'] = CSharp['Assembly-CSharp']   -- 短别名，Demo 惯例
```

### 静态方法

```lua
print(CSharp.AC.Demo.Add(3, 5))       -- 8
print(CSharp.AC.Demo.Multi(3, 5))     -- 15
```

### 构造与实例方法

```lua
local demo = CSharp.AC.Demo()
print(demo:GetX())                    -- 0
demo:SetX(10)
```

### 字段与属性

字段与无参 Property 写法相同：

```lua
demo.x = 20
print(demo:GetX())                    -- 20
```

### 静态成员

```lua
CSharp.AC.Demo.s_x = 10
print(CSharp.AC.Demo.GetSX())         -- 10
```

以上测试函数在 [app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua) 的 `test_*` 系列中。

## 访问规则速记

| 操作 | Lua 写法 |
|------|----------|
| 构造实例 | `CSharp.AC.Demo()` |
| 实例字段/属性 | `demo.x` / `demo:SetX(10)` |
| 实例方法 | `demo:Run(10)` |
| 静态字段 | `CSharp.AC.Demo.s_x` |
| 静态方法 | `CSharp.AC.Demo.Add(3, 5)` |
| 含 namespace 的类型 | `CSharp.AC['MyGame.UI.Panel']` |

## 第 4 步（可选）：方法重载

`Demo.Run` 有 `int` 与 `string` 两个重载。Mono 下可显式绑定：

```lua
local sig_i32 = zlua.signature(zlua.types.int32)
local run_i32 = zlua.get_method(demo, "Run", sig_i32, false)
run_i32(demo, 10)
```

Demo 中 `test_overload_signature` 默认注释掉；取消注释前请确认 API 名称（`zlua` 标准库）。详见 [方法重载](../guides/methods-and-overloads)。

## 构建 Il2Cpp Player

1. 确保已配置 [SyncLuaScriptsToStreamingAssets](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Editor/SyncLuaScriptsToStreamingAssets.cs)
2. Build Settings → Il2Cpp → Build
3. **仅使用 MVP 已支持能力**（基础字段/方法、`LuaInvoke`），勿依赖泛型、重载 dispatch 等

详见 [项目状态](./project-status#il2cpp-mvp)。

## Mono / Il2Cpp 支持

| 本页示例 | Mono (Editor) | Il2Cpp (Player) |
|----------|:-------------:|:---------------:|
| Initialize + LuaInvoke | ✅ | ✅ |
| 静态/实例方法、字段 | ✅ | ✅（Demo 签名） |
| Property `x` / `GetX` | ✅ | ⚠️ 部分 |
| 方法重载显式绑定 | ✅ | ❌ |

## 常见错误

| 错误 | 排查 |
|------|------|
| `module 'app' not found` | 检查 `LuaScripts/app.lua` 是否存在；`LoadLuaModule` 路径 |
| 类型 `Demo` 为 nil | 程序集名错误；应为 `CSharp.AC.Demo` |
| `AppAdd` 返回 0 | Lua 模块未 `return { add = add }`；或函数名与 `[LuaInvoke]` 不一致 |
| Player 无 Lua 输出 | 未同步 `StreamingAssets/LuaScripts/app.lua.txt` |

## 下一步

- [C# 调用 Lua 详解](../guides/csharp-to-lua)
- [Lua 访问 C# 基础](../guides/lua-to-csharp-basics)
- [安装与集成](./installation)
