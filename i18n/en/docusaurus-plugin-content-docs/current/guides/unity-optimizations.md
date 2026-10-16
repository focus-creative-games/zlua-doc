---
sidebar_position: 11.3
title: Unity optimizations
description: With Unity Optimizations on, GetComponent splits into three names and returns the runtime type.
---

# Unity optimizations

Project Settings → ZLua → **Unity Optimizations** (field `enableUnityOptimizations`). On by default. This is the master switch for Unity engine API optimizations; later additions use the same switch. Spec: [15-UNITY-OPTIMIZATIONS](/docs/spec/15-UNITY-OPTIMIZATIONS/).

Today it only covers `GetComponent` on `GameObject` and `Component`.

## Why optimize GetComponent

This is the hottest Unity call from Lua. The default binding has two costs:

| Default | Cost |
|------|------|
| Three overloads share the short name `GetComponent` | Every call goes through overload dispatch; the generic form also needs `inflate` / GTAP |
| Return view = **declared type** (`Component` or an interface) | An actual `Button` still cannot see `onClick` until `zlua.cast` |

When on, the generic and `string` overloads get their own names, and `GetComponent(Type)` becomes a single-candidate **direct**. All three returns are `ActualTypeUserData`: the view is the **runtime actual type**.

## If you leave it off

The package Alias / MarshalAs XML is not loaded. The three overloads still share `GetComponent`, and the return view stays the declared type (including interfaces). Calls go back to the generic-method style in [Method calls](/docs/getting-started/method-calls/).

## How to call when enabled

| C# | Lua |
|----|-----|
| `GetComponent<T>()` | `go:GetComponentT(zlua.typeof(T))` |
| `GetComponent(Type)` | `go:GetComponent(someType)` |
| `GetComponent(string)` | `go:GetComponentN("UnityEngine.UI.Button")` |

`Component` uses the same three names. `GetComponent(Type)` no longer shares dispatch with the other two overloads.

The return view is the **runtime type**, not the declared type or interface. If `GetComponent<Selectable>()` actually returns a `Button`, you can use `onClick` without `zlua.cast`. View rules: [Return view type](/docs/guides/actual-type-userdata/).

```lua
local Button = CSharp.UnityEngine.UI.Button
local button = go:GetComponentT(zlua.typeof(Button))
button.onClick:AddListener(onClick)
```

## Notes

- On by default. Behavior when off is in the section above.
- Do not declare these `GetComponent` methods again in your own Alias / MarshalAs XML; loading fails on duplicate rules.
- After changing the switch, re-run **`ZLua/Generate/All`** before building a Player.
- `GetComponentInChildren`, `AddComponent`, and similar APIs are not in this set yet.
