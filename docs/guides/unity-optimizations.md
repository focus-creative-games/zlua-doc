---
sidebar_position: 11.3
title: Unity 优化
description: 打开 Unity Optimizations 后，GetComponent 拆成三个名字并按运行时类型返回。
---

# Unity 优化

Project Settings → ZLua → **Unity Optimizations**（字段 `enableUnityOptimizations`）。默认开。这是 Unity 引擎 API 的总开关，以后新增的优化也走它。规范见 [15-UNITY-OPTIMIZATIONS](/docs/spec/15-UNITY-OPTIMIZATIONS/)。

当前只处理 `GameObject` 与 `Component` 上的 `GetComponent`。

## 为什么要优化 GetComponent

这是 Lua 侧最热的 Unity 调用，默认绑定有两个代价：

| 默认 | 问题 |
|------|------|
| 三个重载共用短名 `GetComponent` | 每次调用走重载分派；泛型还要 `inflate` / GTAP |
| 返回门面 = **声明类型**（`Component` 或接口） | 实际是 `Button` 也看不到 `onClick`，要再 `zlua.cast` |

打开后，泛型和 `string` 换成独立名字，`GetComponent(Type)` 成为单候选 **direct**；三个重载的返回值都是 `ActualTypeUserData`，门面 = **运行时实际类型**。

## 不开启会怎样

不加载包内 Alias / MarshalAs XML。三个重载仍共用 `GetComponent`，返回门面仍是声明类型（含接口）。调用方式回到 [函数调用](/docs/getting-started/method-calls/) 里的泛型方法写法。

## 打开之后怎么调用

| C# | Lua |
|----|-----|
| `GetComponent<T>()` | `go:GetComponentT(zlua.typeof(T))` |
| `GetComponent(Type)` | `go:GetComponent(someType)` |
| `GetComponent(string)` | `go:GetComponentN("UnityEngine.UI.Button")` |

`Component` 上同样三个名字。`GetComponent(Type)` 不再和另外两个重载抢分派。

返回值按 **运行时类型** 挂成员，而不是声明类型或接口。`GetComponent<Selectable>()` 拿到的如果是 `Button`，可以直接用 `onClick`，不必再 `zlua.cast`。门面规则见 [返回值门面类型](/docs/guides/actual-type-userdata/)。

```lua
local Button = CSharp.UnityEngine.UI.Button
local button = go:GetComponentT(zlua.typeof(Button))
button.onClick:AddListener(onClick)
```

## 注意

- 默认开。关掉后的行为见上一节。
- 不要在自己的 Alias / MarshalAs XML 里再写这几个 `GetComponent`，加载会因为重复规则失败。
- 改开关后打 Player 要重新 **`ZLua/Generate/All`**。
- `GetComponentInChildren`、`AddComponent` 等还没进这套优化。
