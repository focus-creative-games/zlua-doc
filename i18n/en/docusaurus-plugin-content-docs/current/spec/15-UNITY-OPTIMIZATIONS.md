---
sidebar_position: 15
title: "Unity optimizations"
---

# 15 — Unity optimizations

> Switch: `Settings.enableUnityOptimizations` (Project Settings label **Unity Optimizations**).
> Default **on**. Off = the same Lua-visible semantics as before this document existed.
> Usage: [Unity optimizations (guide)](/docs/guides/unity-optimizations/), [getting started](/docs/getting-started/unity-optimizations/).

This switch is a **bundle of Unity engine API optimizations**, not a switch for one method. Today it only includes `GetComponent`. Later Unity optimizations take effect when this switch is on, and are appended to this document.

---

## 1. Current scope

Instance methods on the following **declaring types** only (`UnityEngine.CoreModule`):

| Type | Method |
|------|------|
| `UnityEngine.GameObject` | `GetComponent` |
| `UnityEngine.Component` | `GetComponent` |

`GetComponentInChildren` / `GetComponentInParent` / `AddComponent` are **out of scope**.

---

## 2. When off

Do not load the package files:

- `Packages/com.code-philosophy.zlua/ZLua~/unity/UnityOptimizations.alias.xml`
- `Packages/com.code-philosophy.zlua/ZLua~/unity/UnityOptimizations.marshalas.xml`

`GetComponent<T>()`, `GetComponent(System.Type)`, and `GetComponent(string)` still share the short name `GetComponent`. The return view is the **declared type** (including interfaces).

---

## 3. When on

Package XML is inserted **before** user `luaAliasXmlPaths` / `marshalAsXmlPaths`. If user XML declares the same method slot again, loading **fails** (same as other duplicate Alias / MarshalAs rules).

### 3.1 Aliases (replace the default name)

| CLR | Lua name |
|-----|--------|
| `GetComponent<T>()` | `GetComponentT` |
| `GetComponent(string)` | `GetComponentN` |
| `GetComponent(System.Type)` | **Stays** `GetComponent` (not renamed) |

After renaming, the three overloads no longer share one dispatch group: `GetComponent(Type)` is a single-candidate **direct**. `GetComponentT` still uses open-generic GTAP (one `System.Type` prefix). Rules match [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §3.8, §5.

### 3.2 Return view

All three overloads return `ActualTypeUserData`: ByObj userdata, **view = runtime actual type**. `null` → `nil`. See [marshal/02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/), [marshal/06-CLASS.md](/docs/spec/marshal/06-CLASS/).

So `GetComponentT(typeof(Selectable))` when the instance is a `Button` exposes the `Button` member table, not the interface or base `Selectable`.

---

## 4. Runtime

| Host | Behavior |
|------|------|
| Editor Mono | Load XML according to the switch at `Initialize` |
| Il2Cpp Player | Generate bakes the switch and XML into the binding tables. After changing the switch, re-run **`ZLua/Generate/All`** |

Full-signature keys still use CLR names (`GetComponent()` / `GetComponent(System.Type)` / `GetComponent(System.String)`), not the aliases.
