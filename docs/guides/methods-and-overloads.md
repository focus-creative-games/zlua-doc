---
sidebar_position: 4
title: 方法重载
description: C# 方法重载在 Lua 侧的解析与显式绑定。
---

# 方法重载

C# 允许同名方法重载；Lua 无静态类型，无法仅凭 `obj:Run(x)` 在编译期选定重载。

ZLua 提供三层机制（优先级从高到低）：

1. **别名** — `[LuaAlias]` 或 XML 声明的唯一别名，O(1) 查找
2. **默认 dispatch** — 单 overload 直接调用；多重重载时运行时分派
3. **显式签名绑定** — `zlua.signature` + `zlua.get_method` / `zlua.register_method`

## 显式绑定示例

```lua
local sig_i32 = zlua.signature(zlua.types.int32)
local run_i32 = zlua.get_method(demo, "Run", sig_i32, false)
run_i32(demo, 10)

zlua.register_method(demo, "run_i32", run_i32)
demo:run_i32(20)
```

:::warning
不推荐 `obj[sig](obj, ...)` 按签名字符串键查找。
:::

## 相关规范

- [方法重载规范](../spec/method-overload-spec)
- [zlua 标准库](../spec/lib-spec) §9
