---
sidebar_position: 15
title: "Unity 优化"
---

# 15 — Unity 优化

> 开关：`Settings.enableUnityOptimizations`（Project Settings 标签 **Unity Optimizations**）。
> 默认 **开**。关 = 与未实现本文件时的 Lua 可见语义相同。
> 用法见 [Unity 优化（指南）](/docs/guides/unity-optimizations/)、[入门](/docs/getting-started/unity-optimizations/)。

本开关是 **Unity 引擎 API 的一揽子优化**，不是单个方法的开关。当前只包含 `GetComponent`。以后新增的 Unity 优化在本开关打开时一并生效，并追加到本文。

---

## 1. 当前范围

仅下列 **声明类型** 上的实例方法（`UnityEngine.CoreModule`）：

| 类型 | 方法 |
|------|------|
| `UnityEngine.GameObject` | `GetComponent` |
| `UnityEngine.Component` | `GetComponent` |

`GetComponentInChildren` / `GetComponentInParent` / `AddComponent` **不** 在范围内。

---

## 2. 关闭时

不加载包内：

- `Packages/com.code-philosophy.zlua/ZLua~/unity/UnityOptimizations.alias.xml`
- `Packages/com.code-philosophy.zlua/ZLua~/unity/UnityOptimizations.marshalas.xml`

`GetComponent<T>()`、`GetComponent(System.Type)`、`GetComponent(string)` 仍共用短名 `GetComponent`，返回值门面为 **声明类型**（含接口）。

---

## 3. 打开时

包内 XML 插在用户 `luaAliasXmlPaths` / `marshalAsXmlPaths` **之前**。用户 XML 若再声明同一方法槽位，加载 **失败**（与其它重复 Alias / MarshalAs 规则相同）。

### 3.1 别名（替换默认名）

| CLR | Lua 名 |
|-----|--------|
| `GetComponent<T>()` | `GetComponentT` |
| `GetComponent(string)` | `GetComponentN` |
| `GetComponent(System.Type)` | **仍为** `GetComponent`（不换名） |

换名后三个重载不再共用一个 dispatch 组：`GetComponent(Type)` 为单候选 **direct**。`GetComponentT` 仍走开放泛型的 GTAP（前缀一个 `System.Type`）。规则同 [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §3.8、§5。

### 3.2 返回值门面

上述三个重载的返回值均为 `ActualTypeUserData`：ByObj userdata，**门面 = 运行时实际类型**。`null` → `nil`。见 [marshal/02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/)、[marshal/06-CLASS.md](/docs/spec/marshal/06-CLASS/)。

因此 `GetComponentT(typeof(Selectable))` 在实例为 `Button` 时，Lua 成员表是 `Button`，而不是接口或基类 `Selectable`。

---

## 4. 运行时

| 宿主 | 行为 |
|------|------|
| Editor Mono | `Initialize` 时按开关加载 XML |
| Il2Cpp Player | Generate 时把当时的开关与 XML 烘焙进绑定表。改开关后须重新 **`ZLua/Generate/All`** |

全签名键仍使用 CLR 名（`GetComponent()` / `GetComponent(System.Type)` / `GetComponent(System.String)`），不使用别名。
