---
sidebar_position: 11.2
title: 返回值门面类型
description: 返回值 ByObj 门面改为运行时实际类型（ActualTypeUserData）；与 zlua.cast、泛型方法的关系。
---

# 返回值门面类型

默认返回值按 **声明类型** 挂门面；标注 `LuaMarshalType.ActualTypeUserData` 后，仍是 **ByObj userdata**，但 **门面 = 运行时实际类型**，从而在 Lua 可见派生类成员。权威细则：[02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/)、[06-CLASS](/docs/spec/marshal/06-CLASS/)。

## 为何需要 `ActualTypeUserData`

Lua 侧访问成员靠的是 userdata 挂接的 **门面（view）**，不是「猜运行时真实类型」。默认 Push 时门面 = **方法/属性声明的返回类型**，即使堆上实例更具体也 **不会** 自动换成派生类：

```csharp
Base Create() => new Child();  // 实际是 Child，Lua 门面仍是 Base
```

```lua
local o = factory:Create()
o:BaseOnly()     -- OK：门面 Base 上有
-- o.childField  -- 失败：门面看不到 Child 独有成员
```

**默认故意按声明类型出门面**，避免：

| 风险 | 说明 |
|------|------|
| 同一次调用「类型飘忽」 | 脚本无法假定返回值总是某固定 API 面 |
| 与特殊 Marshal 纠缠 | 如声明为 `object` 时，实际是 `string` 也不应默默变成 Lua string |
| 成员表膨胀 | 按声明类型 Bind 的 IMT 可预测、可缓存 |

因此只有在 **API 声明偏宽（基类 / 接口 / `Component` / `object`），而脚本几乎总要调派生成员** 时，才值得在返回值上标 `ActualTypeUserData`，让门面 = `obj.GetType()`，少写一遍 `zlua.cast`。

典型需要：

| 场景 | 声明返回 | 实际常见 | 不标时的痛点 |
|------|----------|----------|--------------|
| 工厂 / 多态创建 | `Base` / 接口 | 具体 `Child` | 每次 `cast` 才能调派生成员 |
| Unity `GetComponent` | `Component` | `Rigidbody` 等 | 只能当 `Component` 用，或脚本侧 cast |
| 返回 `object` / 装箱宽类型 | `object` | 具体 class | 门面永远是 `System.Object` |

**不需要** 的情况：声明类型已经覆盖你会调用的成员；或偶发才 downcast（用 `zlua.cast` 即可）。

## 默认 vs ActualType

| | 默认 Push | `ActualTypeUserData` |
|--|--|--|
| 形态 | ByObj | 仍是 ByObj |
| 门面 | **声明类型** | **实际类型** |
| 典型 | `CreateChild()` → Base | `CreateChildActual()` → Child |

```csharp
Base CreateChild() => new Child();

[return: LuaMarshalAs(LuaMarshalType.ActualTypeUserData)]
Base CreateChildActual() => new Child();
```

```lua
local o = ObjectFactory.CreateChild()         -- 门面 Base
local c = zlua.cast(o, Child)                 -- 脚本侧改门面
local a = ObjectFactory.CreateChildActual()   -- 返回时门面已是 Child
```

## 怎么标

| 方式 | 说明 |
|------|------|
| Attribute | `[return: LuaMarshalAs(LuaMarshalType.ActualTypeUserData)]` |
| XML | `Return`=`ActualTypeUserData`（挂在**声明类型**；继承可用） |
| 热更新程序集 | **只**能 Attribute，**不支持** XML |

**仅返回值**。标在参数 / 字段 / 属性 / 类型级 → 非法（Mono Attribute：回退 `Default` + 日志；Il2Cpp Generate / XML：可失败）。

## 合法类型（摘要）

适用于默认走 **ByObj** 的托管引用类型：`class` / `interface` / `object` / 数组等。

**不可**用于普通 `struct`、默认非 ByObj 的 `string` 等。完整合法集合见 [02-MARSHAL-AS §3](/docs/spec/marshal/02-MARSHAL-AS/)。

## 与 `zlua.cast` 互补

| | ActualTypeUserData | `zlua.cast` |
|--|--|--|
| 谁改门面 | C# 返回时自动 | Lua 脚本主动 |
| 适用 | 固定 API 想「按真类型出门」 | 偶发 downcast |

## 与泛型方法

如 `GetComponent` 闭合后声明返回 `Component`，可在开放方法返回槽标 ActualType；闭合后按 **实际组件类型** 出门面。见 [泛型](/docs/guides/generics/)。

## 常见误解

| 误解 | 实际 |
|------|------|
| 会把 `string` 变成 Lua string | 否；实际为 `string` 时仍为 ByObj（门面 `System.String`） |
| 改变虚派发语义 | 否；按 **view** 找槽，再对真实 `this` 虚调 |
| 等于 Opaque / Table | 否；形态仍是 ByObj UserData |

## 学习路径

| | |
|---|---|
| **上一篇** | [LuaMarshalAs](/docs/guides/lua-marshal-as/) |
| **下一篇** | [0GC Marshal](/docs/guides/zero-gc-marshal/) |

## 相关文档

- [LuaMarshalAs](/docs/guides/lua-marshal-as/)
- [泛型](/docs/guides/generics/)
- [02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/)
- [06-CLASS](/docs/spec/marshal/06-CLASS/)
