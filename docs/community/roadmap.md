---
mdx:
  format: md
sidebar_position: 1
title: 路线图
description: ZLua 版本计划与功能清单。
---

# 开发计划

## 运行时实现状态

验证环境：**Unity 2022.3.62f3 + Lua 5.4**

| 运行时 | 环境 | 状态 |
|--------|------|------|
| **Mono** | Unity Editor | **v1.0 功能已全部实现** |
| **Il2Cpp** | Player 发布 | **MVP 阶段**，仅实现少量基础互操作 |

正式版（Il2Cpp 完整实现与性能优化）预计 **2026 年 8 月** 发布。

---

## Mono（Editor）— 已实现

### Lua 调用 C#

- [x] 访问 class、struct 类
- [x] 访问成员变量和静态成员变量
- [x] 调用函数和静态函数
- [x] 函数重载（dispatch、`get_method`、`[LuaAlias]`）
- [x] 访问 Property（含无参 property 与 index 访问器）
- [x] 访问 Event
- [x] 访问泛型类
- [x] 调用泛型函数
- [x] 访问 Array 等集合类型

### C# 调用 Lua

- [x] `[LuaInvoke]`

### Marshal

- [x] 常规 bool、byte、long、float、double 等值类型
- [x] string 类型
- [x] class 类型
- [x] struct / 值类型
- [x] 枚举类型
- [x] array 类型
- [x] 特殊类型：指针、函数指针、TypedReference
- [x] in / out / ref 类型（见 [编组规范](../spec/marshal/)）
- [x] `[LuaMarshalAs]` 规则

### 杂项

- [x] `zlua` 标准库（`typeof`、`new_ref`、`make_generic_type`、`make_szarray_type` 等）

### 性能优化（Mono）

- [x] 优化成员和属性访问
- [x] 将简单的 `int X {get; set;}` 之类 Property 访问重构为字段访问
- [x] 优化函数调用
- [x] 桥接函数优化
- [x] Marshal 优化

### 测试

- [x] 测试项目与自研 Runner（见 [测试框架](./testing)）

---

## Il2Cpp（Player）— 当前已支持（MVP）

> 详细架构见 [Il2Cpp 架构](../architecture/il2cpp-architecture)。

### 已支持

- [x] `[LuaInvoke]`（C# 调用 Lua）
- [x] 访问 class（如 `Demo` 构造）
- [x] 访问实例 / 静态成员变量（字段直读）
- [x] 调用实例 / 静态方法（**手写桥接**，仅覆盖 Demo 常见签名）
- [x] 基础类型 marshal：`int`、`bool`、`string`、`void`

### 尚未支持（v1.0 目标）

- [ ] struct 完整互操作
- [ ] 函数重载 dispatch / `zlua.get_method`
- [ ] Property / Event
- [ ] 泛型类与泛型函数
- [ ] Array 与复杂集合
- [ ] enum、delegate、ref/out/in 等扩展 marshal
- [ ] `[LuaMarshalAs]`
- [ ] 构建时自动生成全量 MethodBridge
- [ ] 性能优化（offset 直读、Property 转字段等设计目标）

---

## v1.0 总目标

Il2Cpp Player 追平 Mono 已实现的全量功能，并完成 C++ 直桥性能优化。

- [ ] Il2Cpp 功能对齐 Mono v1.0 清单
- [ ] Il2Cpp 性能报告
- [ ] 编译 lua 5.4.8 for macOS（及其他平台工具链）

## v2.0

- 支持 Unity 2021+ LTS、团结引擎
- 支持 Lua 5.1、Lua 5.3+、LuaJIT、Luau
- Editor 方面的优化（待定）
- 额外功能，如 LuaMonoBehaviour 支持（待定）
- xLua、tolua 迁移指南

## v3.0

- 基于 Lua 5.3+ 版本的 LuaJIT
