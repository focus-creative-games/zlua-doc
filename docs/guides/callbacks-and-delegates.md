---
sidebar_position: 5
title: 回调与 Delegate
description: Lua function 与 C# delegate 的双向编组。
---

# 回调与 Delegate

Lua 调用 C# 方法时，delegate 形参可接受 **Lua function**，由 `MethodBridge` 隐式 marshal。

## 相关规范

- [函数编组规范](../spec/marshal/function)
- [类型系统规范](../spec/type-system-spec)

:::info 文档建设中
用户向示例将在 v1.0 delegate 功能稳定后补充。
:::
