---
sidebar_position: 2
title: LuaCallback
description: "[LuaCallback] / MonoLuaCallback 属性说明。"
---

# LuaCallback

类似于 `MonoPInvokeCallback`，用于从 Lua 调用 C# 函数指针。

:::info
一般情况下 **无需** 手动标记：C# 函数在 Lua 首次调用时自动注册。仅当需要将 C# 函数指针传递给 Lua 直接调用时才可能需要。
:::

Lua 仅支持 `int (lua_State* L)` 签名的 native 回调，因此使用场景有限。

## 详见

- [设计规范](../../spec/design-spec)
