---
sidebar_position: 4
title: 常见问题
description: ZLua 常见问题与解答。
---

# 常见问题

## ZLua 与 xLua 有什么区别？

ZLua 在 Il2Cpp 层内嵌 Lua，C++ 直桥，不生成 C# Wrap。详见 [与 xLua 对比](../concepts/comparison-with-xlua)。

## Editor 下性能如何？

**Mono（Editor）** 功能完整，性能对标 xLua CodeEmit 档。**Il2Cpp（Player）** 当前为 MVP，设计目标中的性能优势尚未完全落地。详见 [Editor 与 Player](../guides/editor-vs-player)。

## 含 namespace 的类型怎么访问？

使用括号语法：`CSharp.AC['MyGame.UI.Panel']`。

## 方法重载如何选择？

默认运行时分派；热路径建议用 `[LuaAlias]` 或 `zlua.register_method`。详见 [方法重载](../guides/methods-and-overloads)。

## 当前支持哪些版本？

**Mono（Editor）** 已实现 v1.0 全量功能；**Il2Cpp（Player）** 为 MVP，仅基础互操作。均在 Unity 2022.3.62f3 + Lua 5.4 上验证。详见 [兼容性](../getting-started/compatibility) 与 [项目状态](../getting-started/project-status)。

## 如何报告 Bug？

在 [GitHub Issues](https://github.com/focus-creative-games/zlua/issues) 提交，或加入交流群（见 [联系](./contact)）。
