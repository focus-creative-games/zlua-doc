---
sidebar_position: 3
title: 支持的版本与平台
description: ZLua 支持的 Unity、Lua 版本、平台与功能矩阵。
---

# 支持的版本与平台

## Lua 引擎

| 版本 | Mono (Editor) | Il2Cpp (Player) | 备注 |
|------|:-------------:|:---------------:|------|
| Lua 5.4 | ✅ | ✅ | 主验证线之一 |
| Lua 5.1 / 5.3 / 5.5 | ✅ | ✅ | Settings 可选；**默认 `lua-5.3.6`** |
| LuaJIT | 🚧 | 🚧 | 开发中，很快会支持 |
| [Luau](https://luau.org/) | 🔜 | 🔜 | 规划中 |

## Unity

| 版本 | 状态 |
|------|------|
| Unity 2022.3 LTS | ✅ 支持 |
| Unity 2021+ LTS | ✅ 支持 |
| 团结引擎 LTS | ✅ 支持 |

## Scripting Backend

| 后端 | 环境 | 功能状态 |
|------|------|----------|
| **Il2Cpp** | Player 发布 | **已完成**（权威实现） |
| **Mono** | Unity Editor | **已完成**（与 Il2Cpp 语义一致） |

Lua 可见语义两端一致；Indexer / 桥接实现不同。详见 [项目状态](./project-status)、[规范](../spec/00-OVERVIEW)。

**Il2Cpp 构建：** 发布前执行 **`ZLua/Generate/All`**（C++ stub，非 C# Wrap）。

## 目标平台（Il2Cpp）

设计目标覆盖 Il2Cpp 支持的平台（Windows、macOS、iOS、Android、WebGL、微信小游戏、鸿蒙/车机等）。以 Desktop Player 验证为主；其他平台问题请提交 Issue。

---

## 功能 × 运行时矩阵

✅ 可用 · ⚠️ 有限制（见说明） · ❌ 不支持（有意限制）。细则以 [规范](../spec/00-OVERVIEW) 为准。

### Lua 调用 C#

| 功能 | Mono | Il2Cpp | 说明 |
|------|:----:|:------:|------|
| class / struct 访问 | ✅ | ✅ | 懒绑定，无 C# Wrap 白名单 |
| 实例 / 静态字段 | ✅ | ✅ | |
| 实例 / 静态方法 | ✅ | ✅ | |
| Property（无参） | ✅ | ✅ | |
| Property（indexer） | ✅ | ✅ | 经 `get_Item` / `set_Item` 等方法形式访问，见 [字段与属性](../guides/fields-and-properties) |
| 方法重载 dispatch | ✅ | ✅ | |
| `[LuaAlias]` / `register_method` | ✅ | ✅ | |
| 泛型类 / 泛型方法 | ✅ | ✅ | 开放泛型须先闭合；静态泛型方法有限制 |
| Array（szarray / mdarray） | ✅ | ✅ | mdarray 不可 table 序列化 |
| Event 专用元表 | ❌ | ❌ | 使用 `add_` / `remove_` 普通方法 |
| Delegate / Lua 回调 | ✅ | ✅ | Lua→C# byref 形参有限制 |

### C# 调用 Lua

| 功能 | Mono | Il2Cpp |
|------|:----:|:------:|
| `GetFunction<T>` | ✅ | ✅ |
| 多参数 / 返回值 | ✅ | ✅ |
| `[LuaMarshalAs]` | ✅ | ✅ | 部分类型见规范 |

### Marshal

| 类型 | Mono | Il2Cpp |
|------|:----:|:------:|
| 基元 / string | ✅ | ✅ |
| enum（默认 integer） | ✅ | ✅ |
| class / struct（ByVal / ByObj / Opaque） | ✅ | ✅ |
| array | ✅ | ✅ |
| OpaqueValue / byref | ✅ | ✅ | 见 [BYREF](../spec/marshal/03-BYREF)、[OPAQUE](../spec/marshal/04-OPAQUE) |

### 标准库 `zlua`

| API | Mono | Il2Cpp |
|-----|:----:|:------:|
| `typeof` / `get_type_from_name` / `make_generic_*` | ✅ | ✅ |
| szarray / mdarray 工厂 | ✅ | ✅ |
| opaque get/set、`box`/`unbox` | ✅ | ✅ |
| `register_method` | ✅ | ✅ |

## 开发环境建议

| 目标 | 推荐环境 |
|------|----------|
| 功能开发、脚本迭代 | **Editor（Mono）** |
| 发布与性能 | **Il2Cpp Player** + Generate |
| 语义争议 | 以 **spec** 为准 |

## 下一步

- [项目状态](./project-status)
- [Editor 与 Player](../guides/editor-vs-player)
- [选型对比](../compare/)
