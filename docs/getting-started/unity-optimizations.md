---
sidebar_position: 3.5
title: Unity 优化
description: 可选开关。打开后 GetComponent 用三个短名，并按真实组件类型返回。
---

# Unity 优化

Project Settings → ZLua 里有一项 **Unity Optimizations**，默认勾选。当前只优化 `GameObject` / `Component` 上的 `GetComponent`。

## 为什么要优化它

`GetComponent` 是脚本里最常调的 Unity API，默认绑定有两处不适合热路径：

1. **三个重载共用短名** `GetComponent`（泛型、`Type`、`string`）。每次调用都要做重载分派，泛型还要再走 `inflate` / GTAP。
2. **返回值门面是声明类型**（常为 `Component` 或接口）。实例其实是 `Button` 时，Lua 上看不到 `onClick`，还要 `zlua.cast`。

打开开关后：泛型和 `string` 换成独立短名，不再和 `GetComponent(Type)` 抢分派；返回值按 **实际类型** 挂成员。

## 不开启会怎样

取消勾选后，行为和未做这项优化时相同：

- 三个重载仍都叫 `GetComponent`，走重载分派。
- 返回值门面仍是你请求的那个类型，派生成员要自己 `zlua.cast`。

## 打开之后的名字

勾上之后，三个重载各自换成下面的 Lua 名（`GetComponent(Type)` 名字不变）：

| C# | 打开后的 Lua |
|----|----------------|
| `GetComponent<T>()` | `go:GetComponentT(zlua.typeof(Button))` |
| `GetComponent(Type)` | `go:GetComponent(typeObject)` |
| `GetComponent(string)` | `go:GetComponentN("UnityEngine.UI.Button")` |

返回的是组件的 **实际类型**。用接口或基类去取时，也能直接点到子类上的字段（例如 `Button.onClick`）。

字段列表见 [Settings](/docs/guides/settings/)。调用细节与限制见 [Unity 优化（指南）](/docs/guides/unity-optimizations/)。
