---
sidebar_position: 4
title: 常见问题
description: ZLua 常见问题与解答。
---

# 常见问题

按主题分类；未覆盖见 [排错指南](../guides/troubleshooting) 或 [GitHub Issues](https://github.com/focus-creative-games/zlua/issues)。

## 一般

### ZLua 与 xLua 有什么区别？

ZLua 在 Il2Cpp 内嵌 Lua、C++ 直桥，**不生成 per-type C# Wrap**（Player 生成 **C++ stub**）。类型访问用 `CSharp` 根表，C# 调 Lua 用 `LuaAppDomain.GetFunction<T>`。见 [为什么选择 ZLua](../concepts/why-zlua)、[选型对比](../compare/)、[从 xLua 迁移](./migration/from-xlua)。

### Mono 和 Il2Cpp 差别有多大？

**Lua 可见语义一致**。**Mono（Editor）与 Il2Cpp（Player）均已完成**；实现路径不同（Emit vs C++ stub）。见 [项目状态](../getting-started/project-status)。

### 当前适合上生产吗？

Il2Cpp Player 可用于完整语义验证与发布；接受 **libil2cpp 集成** 与 **`ZLua/Generate/All`**。Hotfix 等 xLua 专长需自建。见 [兼容性](../getting-started/compatibility)。

### 支持哪些 Unity / Lua 版本？

见 [兼容性](../getting-started/compatibility)。PUC-Rio **5.1–5.5** 已支持；**LuaJIT** 已支持，但 **Il2Cpp Player 仅 Android / iOS**（细则见 [LuaJIT 构建](../spec/build/02-LUAJIT)）。

---

## 安装与工程

### 如何安装 ZLua？

UPM：`"com.code-philosophy.zlua": "https://github.com/focus-creative-games/zlua.git"`。见 [安装](../getting-started/installation)、[zlua-demo](https://github.com/focus-creative-games/zlua-demo)。

### 发布前要 Generate 吗？

**Il2Cpp：要。** 菜单 **`ZLua/Generate/All`** 生成 C++ MethodBridge 等 Lua→C# stub，**不是** xLua 式 C# Wrap。Editor Mono 不依赖该 C# Wrap 流程。**C#→Lua 无 Generate 步骤。**

### Lua 脚本放哪里？

项目根 `LuaScripts/*.lua`（Editor）；Player Sync 到 `StreamingAssets/LuaScripts/*.lua.txt`。

---

## 类型与语法

### 含 namespace 的类型怎么访问？

`CSharp.AC['MyGame.UI.Panel']`，不能链式点号穿越 namespace。

### Event 怎么订阅？

**无** `.get` / `.set` 专用表。使用 `obj:add_OnX(handler)` / `obj:remove_OnX(handler)`。见 [Event](../guides/events)。

### ref / out 怎么用？

Lua→C#：ByVal userdata 或 Opaque 可写回；裸 number **不回写**。C#→Lua byref 默认 Opaque。见 [ref/out/in](../guides/marshal-ref-out-in)、[BYREF](../spec/marshal/03-BYREF)。

---

## 互操作

### 如何从 C# 调用 Lua？

`LuaAppDomain.GetFunction<T>("module","method")` 取得 Delegate 后 `Invoke`。见 [C# 调用 Lua](../guides/csharp-to-lua)。

### 方法重载怎么选？

默认 dispatch；热路径 `[LuaAlias]` / `zlua.register_method`。见 [方法重载](../guides/methods-and-overloads)。

### Lua 如何传回调给 C#？

直接传 `function`。见 [回调与 Delegate](../guides/callbacks-and-delegates)。

---

## Player / 发布

### Editor 正常 Player 失败？

检查：是否 **Generate**；Lua 是否 Sync；是否使用已废弃 Event API。见 [Editor vs Player](../guides/editor-vs-player)、[排错](../guides/troubleshooting)。

### Player 性能如何？

以 Il2Cpp 为准；理论与待测项见 [PERFORMANCE](../compare/PERFORMANCE)。

---

## 相关文档

- [排错指南](../guides/troubleshooting)
- [规范总览](../spec/00-OVERVIEW)
- [联系与支持](./contact)
