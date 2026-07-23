---
sidebar_position: 13
title: 最佳实践
description: ZLua 日常开发的建议与常见陷阱。
---

# 最佳实践

面向 **Mono Editor 与 Il2Cpp Player** 双运行时的日常约定。Lua 可见语义一致；发布 Player 前另阅 [Editor 与 Player](./editor-vs-player) 与 [排错指南](./troubleshooting)。

## 工程组织

### 以 zlua-demo 为模板

新工程建议从 [zlua-demo](https://github.com/focus-creative-games/zlua-demo) clone，保留 Bootstrap、Sync 脚本与 `LuaScripts/` 布局。

### 程序集别名

```lua
CSharp['AC'] = CSharp['Assembly-CSharp']
```

## 类型与重载

- 含 namespace：`CSharp.AC['MyGame.UI.Panel']`
- 热路径固定重载：`[LuaAlias]` 或 `register_method`
- 避免每帧字符串键动态查表

## Delegate 与 Event

- 形参隐式 marshal：`obj:Foo(function() end)`
- Event：**`add_OnX` / `remove_OnX`**（无 `.get` / `.set`）
- 取消订阅须同一 function 引用

## 值类型与 byref

- 需要写回：ByVal / ByObj / Opaque；裸 number **不回写**（见 [Struct 编组](../spec/marshal/05-STRUCT)、[ref/out/in](./marshal-ref-out-in)）

## 性能

| 项 | 建议 |
|----|------|
| 字段 | 优先 `obj.field` |
| 基准 | **Il2Cpp Player**；Lua→C# 平均约 **2.6×** vs xLua（见 [PERFORMANCE](../compare/PERFORMANCE)） |

## Player 发布检查清单

- [ ] **`ZLua/Generate/All`**
- [ ] Sync LuaScripts → StreamingAssets
- [ ] 未使用已废弃 Event API
- [ ] 对照 [兼容性](../getting-started/compatibility)







## 学习路径

| | |
|---|---|
| **上一篇** | [Editor 与 Player](./editor-vs-player) |
| **下一篇** | [设计概览](../concepts/design-overview) |

## 相关文档

- [FAQ](../community/faq)
- [Editor 与 Player](./editor-vs-player)
- [规范](../spec/00-OVERVIEW)
