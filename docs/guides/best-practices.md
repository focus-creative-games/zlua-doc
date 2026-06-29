---
sidebar_position: 10
title: 最佳实践
description: ZLua 日常开发的建议与常见陷阱。
---

# 最佳实践

## 类型访问

- 为常用程序集设置短别名：`CSharp['AC'] = CSharp['Assembly-CSharp']`
- 含 **namespace** 的类型必须用括号：`CSharp.AC['MyGame.UI.Panel']`

## 方法重载

- 热路径使用 `[LuaAlias]` 或 `register_method` 缓存，避免每次 dispatch
- 不推荐 `obj[sig](obj, ...)` 签名字符串查找

## 性能

- Player 下字段/简单 Property 走 offset 直读，优先直接访问 `obj.field`
- 性能评估请在 **Il2Cpp Player** 下进行，而非 Editor

## 常见错误

| 现象 | 可能原因 |
|------|----------|
| 找不到类型 | 程序集名或 namespace 路径错误 |
| 重载调用错误 | 多重重载未显式绑定 |
| Editor 正常 Player 失败 | 语义不一致，查阅规范文档 |

## 相关文档

- [FAQ](../community/faq)
- [规范文档](../spec/)
