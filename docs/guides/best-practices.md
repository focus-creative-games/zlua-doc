---
sidebar_position: 13
title: 最佳实践
description: ZLua 日常开发的建议与常见陷阱。
---

# 最佳实践

面向 **Editor（Mono）** 日常开发的约定与性能建议。发布 Il2Cpp 前另阅 [Editor 与 Player](./editor-vs-player) 与 [排错指南](./troubleshooting)。

## 工程组织

### 以 zlua-demo 为模板

新工程建议从 [zlua-demo](https://github.com/focus-creative-games/zlua-demo) clone，保留：

- [Bootstrap.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs) — 初始化模式
- [SyncLuaScriptsToStreamingAssets.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Editor/SyncLuaScriptsToStreamingAssets.cs) — Player 同步
- `LuaScripts/` 源 + `StreamingAssets` 产物分离

### Lua 模块划分

```
LuaScripts/
├── app.lua           -- C# LuaInvoke 入口
├── game/
│   └── battle.lua
└── shared/
    └── util.lua
```

`LoadLuaModule` 支持自定义子路径映射；保持 module 名与文件路径一致可维护性更高。见 [Lua 模块加载](./lua-module-loading)。

### 程序集别名

每个 Lua 入口文件顶部统一：

```lua
CSharp['AC'] = CSharp['Assembly-CSharp']
-- 其它程序集：CSharp['Game'] = CSharp['Game.Runtime']
```

## 类型访问

- 含 **namespace** 的类型 **必须** 括号：`CSharp.AC['MyGame.UI.Panel']`
- 嵌套类型：`CSharp.AC['Outer+Nested']`
- 热路径缓存类型表：`local Demo = CSharp.AC.Demo`

## 方法重载

| 场景 | 建议 |
|------|------|
| 热路径固定重载 | C# `[LuaAlias("run_i32")]` |
| 脚本侧缓存 | `get_method` + `register_method` |
| 多重重载偶尔调用 | 默认 `obj:Run(x)` dispatch |
| 避免 | `obj[sig](obj,...)` 字符串键 |

## Delegate 与 Event

- 优先 **方法形参隐式 marshal**：`obj:Foo(function() end)`
- Event 取消订阅保留 **同一 function 引用** 供 `.set` 使用
- 在 `OnDestroy` / Lua 模块卸载时移除 C# 侧长期持有的回调

## 值类型与 ref

- 需要 C# 回写：`zlua.new_ref` 或 struct `_ctor` userdata
- 不要向 `ref int` 传裸 literal  expecting 回写
- enum 默认用 **integer 常量** 传参；boxed 场景再 `EnumType(value)`

## 泛型与集合

- 先 `local ListInt = zlua.make_generic_type(...)` 再缓存类型表
- 数组批量数据：大数据考虑 `zlua.to_bytes`（blittable）减少 Lua 表开销

## 性能

| 项 | 建议 |
|----|------|
| 字段 / 简单 Property | 优先 `obj.field` 直读 |
| 成员访问 | 避免每帧字符串键动态查表 |
| 性能测试环境 | **完整 Il2Cpp 实现后** 再与 xLua 对比；MVP 无代表性 |
| Editor 性能 | 对标 xLua CodeEmit；已足够日常开发 |

## Player 发布检查清单

- [ ] 脚本功能 ⊆ [Il2Cpp MVP](../getting-started/project-status#il2cpp-mvp)
- [ ] 已运行 Sync LuaScripts
- [ ]  smoke 测试 [app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua) 同等路径
- [ ] 无泛型 / Event / ref / 复杂重载依赖

## 调试技巧

- 在 Lua 入口加 `print` 确认模块加载顺序
- 类型错误时打印 `CSharp.AC['Full.TypeName']` 是否为 nil
- Mono 下对比 [规范文档](../spec/) 确认语义预期
- 疑难问题查 [排错指南](./troubleshooting)

## 相关文档

- [FAQ](../community/faq)
- [Editor 与 Player](./editor-vs-player)
- [规范文档](../spec/)
