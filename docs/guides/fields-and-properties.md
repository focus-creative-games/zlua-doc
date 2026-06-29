---
sidebar_position: 3
title: 字段与属性
description: Lua 侧访问 C# 字段与 Property 的规则与性能说明。
---

# 字段与 Property

在 Lua 中，**public 字段**与**无参 Property** 的读写语法一致，均使用 `obj.member` / `Type.staticMember`。带参 Property（indexer）需按方法或专用规则访问。

参考类型：[Demo.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Demo.cs)（`x` 字段 + `GetX`/`SetX` Property）

## 概述

| C# 成员 | Lua 读 | Lua 写 |
|---------|--------|--------|
| `public int x;` | `demo.x` | `demo.x = 10` |
| `public int X { get; set; }` | `demo.X` | `demo.X = 10` |
| 静态字段 `s_x` | `CSharp.AC.Demo.s_x` | `CSharp.AC.Demo.s_x = 10` |
| 静态 Property | `Type.prop` | `Type.prop = v` |

Demo 中同时存在字段 `x` 与 `GetX()`/`SetX()`，Lua 可混用（见 [app.lua test_access_instance_field](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua)）。

## 字段访问

### 实例字段

```lua
local demo = CSharp.AC.Demo()
demo.x = 10
print(demo.x)           -- 10
demo:SetX(20)           -- 也可通过 property setter
print(demo:GetX())      -- 20
```

### 静态字段

```lua
CSharp.AC.Demo.s_x = 10
print(CSharp.AC.Demo.GetSX())
```

## Property（无参）

简单 `{ get; set; }` Property 在 Lua 中与字段 **语法相同**：

```lua
demo.x = 10    -- 可能绑定到 field 或 property，语义均为读写成员
```

Il2Cpp **设计目标** 将 `int X { get; set; }` 优化为 offset 直读（等同字段性能）。Mono 已通过元表 getter/setter 表实现 fast path。

## Property（带 index indexer）

带参数的 index 访问器（如 `this[int i]`）在 Mono 上按 **方法** 分派，不能写 `obj[i]` 除非元表专门注册。

```lua
-- 示意：具体 API 取决于类型绑定，见类型系统规范
-- list[i] 对 Array / List 有专门规则
```

详见 [类型系统规范](../spec/type-system-spec) §4 与 [泛型与数组](./generics-and-arrays)（P2）。

## 底层分派（概念）

成员访问经 **三表分派**（method / field-getter / field-setter），在 Lua VM 内完成 lookup，热路径不经过 C# 字符串反射。详见 [元表模型](../concepts/metatable-model)。

未注册成员 **strict miss** — 直接 `error`，不会 fallback 到反射。

## 性能建议

| 写法 | Mono | 说明 |
|------|------|------|
| `demo.x` | ✅ 快路径 | 优先直接成员访问 |
| `demo:GetX()` | ✅ | property getter 有额外调用 |
| 循环内频繁读写字段 | ✅ | 避免每帧 `get_method` |

Player MVP 下字段直读已实现；Property 优化随 Il2Cpp 完整版落地。

## Mono / Il2Cpp 支持

| 能力 | Mono | Il2Cpp |
|------|:----:|:------:|
| 实例 / 静态字段 | ✅ | ✅ |
| 无参 Property | ✅ | ⚠️ |
| index Property | ✅ | ❌ |
| 字段写入 | ✅ | ✅ |

## 常见错误

| 现象 | 原因 |
|------|------|
| `member not writable` | 只读 property / 无 setter |
| 读到的值不对 | 混淆 field 与 property；检查 C# 定义 |
| 静态字段用实例访问 | 应使用 `CSharp.AC.Demo.s_x` |

## 相关文档

- [Lua 访问 C# 基础](./lua-to-csharp-basics)
- [元表索引规范](../spec/meta-table-spec)
- [类型系统规范](../spec/type-system-spec)
