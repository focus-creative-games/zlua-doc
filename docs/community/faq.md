---
sidebar_position: 4
title: 常见问题
description: ZLua 常见问题与解答。
---

# 常见问题

## 一般

### ZLua 与 xLua 有什么区别？

ZLua 在 Il2Cpp 内嵌 Lua、C++ 直桥，不生成 C# Wrap。类型访问用 `CSharp` 根表，C# 调 Lua 用 `[LuaInvoke]`。详见 [与 xLua 对比](../concepts/comparison-with-xlua) 与 [迁移对照草稿](./migration-from-xlua)。

### Mono 和 Il2Cpp 差别有多大？

**Mono（Editor）** 已实现 v1.0 全量功能；**Il2Cpp（Player）** 仅 MVP（Demo 级基础互操作）。见 [项目状态](../getting-started/project-status) 与 [兼容性](../getting-started/compatibility)。

### 正式版什么时候发布？

Il2Cpp 完整实现与性能优化预计 **2026 年 8 月**。

---

## 安装与工程

### 如何安装 ZLua？

UPM Git URL：`"com.code-philosophy.zlua": "https://github.com/focus-creative-games/zlua.git"`。详见 [安装与集成](../getting-started/installation) 与 [zlua-demo](https://github.com/focus-creative-games/zlua-demo)。

### Lua 脚本放哪里？

推荐项目根 `LuaScripts/*.lua`（Editor），Player 用 Sync 到 `StreamingAssets/LuaScripts/*.lua.txt`。

### 为什么用 `.lua.txt`？

避免 Unity 对 `.lua` 的导入规则冲突；Player 从 StreamingAssets 读取文本。

---

## 类型与语法

### 含 namespace 的类型怎么访问？

`CSharp.AC['MyGame.UI.Panel']`，不能链式 `CSharp.AC.MyGame.UI.Panel`。

### 程序集名是什么？

默认游戏脚本为 `Assembly-CSharp`，常设别名 `CSharp['AC'] = CSharp['Assembly-CSharp']`。

### Lua 能访问 private 成员吗？

不能，仅 **public** 成员。

---

## 互操作

### 如何从 C# 调用 Lua？

`[LuaInvoke("module","method")]` + `static extern`。见 [C# 调用 Lua](../guides/csharp-to-lua)。

### 方法重载怎么选？

默认 dispatch；热路径用 `[LuaAlias]` 或 `zlua.get_method`。见 [方法重载](../guides/methods-and-overloads)。

### Lua 如何传回调给 C#？

直接传 `function`，delegate 形参隐式 marshal。见 [回调与 Delegate](../guides/callbacks-and-delegates)。

### Event 怎么订阅？

`eventTable.get(obj, handler)` / 静态 `get(handler)`。见 [Event](../guides/events)。

### ref / out 怎么用？

`zlua.new_ref(T)`，不要传裸数字 expecting 回写。见 [ref / out / in](../guides/marshal-ref-out-in)。

---

## Player / 发布

### Editor 正常 Player 失败？

多半是使用了 Il2Cpp MVP 未支持的功能（泛型、Event、ref 等）。见 [排错指南](../guides/troubleshooting)。

### Player 性能如何？

当前 MVP **不能**代表设计目标性能；完整 Il2Cpp 版发布后再评估。

---

## 调试与支持

### 从哪里找示例代码？

[zlua-demo](https://github.com/focus-creative-games/zlua-demo) 为 canonical 工程。

### 如何报告 Bug？

[GitHub Issues](https://github.com/focus-creative-games/zlua/issues) 或 [联系](./contact)（QQ 群 / Discord）。

---

## 相关文档

- [排错指南](../guides/troubleshooting)
- [最佳实践](../guides/best-practices)
