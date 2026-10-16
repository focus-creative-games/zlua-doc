---
sidebar_position: 3.5
title: Unity optimizations
description: Optional switch. When on, GetComponent uses three short names and returns the real component type.
---

# Unity optimizations

**Unity Optimizations** in Project Settings → ZLua is on by default. Today it only covers `GetComponent` on `GameObject` / `Component`.

## Why optimize it

`GetComponent` is the hottest Unity call from scripts. The default binding has two costs on that path:

1. **Three overloads share the short name** `GetComponent` (generic, `Type`, and `string`). Every call goes through overload dispatch, and the generic form also needs `inflate` / GTAP.
2. **The return view is the declared type** (often `Component` or an interface). When the instance is actually a `Button`, Lua cannot see `onClick` until you `zlua.cast`.

With the switch on, the generic and `string` overloads get their own short names and no longer compete with `GetComponent(Type)`; the return view is the **actual type**.

## If you leave it off

Unchecking restores the behavior from before this optimization:

- All three overloads stay named `GetComponent` and go through overload dispatch.
- The return view stays the type you asked for; derived members need `zlua.cast`.

## Names when enabled

With it on, the three overloads map to these Lua names (`GetComponent(Type)` keeps its name):

| C# | Lua when enabled |
|----|----------------|
| `GetComponent<T>()` | `go:GetComponentT(zlua.typeof(Button))` |
| `GetComponent(Type)` | `go:GetComponent(typeObject)` |
| `GetComponent(string)` | `go:GetComponentN("UnityEngine.UI.Button")` |

The return value uses the component’s **actual type**. Fetching through an interface or base type still exposes derived fields (for example `Button.onClick`).

Field list: [Settings](/docs/guides/settings/). Call details and limits: [Unity optimizations (guide)](/docs/guides/unity-optimizations/).
