---
sidebar_position: 11
title: 排错指南
description: ZLua 常见问题诊断与解决方案。
---

# 排错指南

按症状快速定位问题。开发期默认在 **Editor（Mono）** 排查；Player 问题先对照 [Il2Cpp MVP 清单](../getting-started/project-status#il2cpp-mvp)。

Canonical 工程：[zlua-demo](https://github.com/focus-creative-games/zlua-demo)

---

## 安装与启动

### Play 后完全无 Lua 输出

| 检查项 | 说明 |
|--------|------|
| `LuaAppDomain.Initialize` | 须 `[RuntimeInitializeOnLoadMethod(BeforeSceneLoad)]` 或更早调用 |
| Bootstrap 是否在场景中 | Demo 用 RuntimeInitialize，不依赖场景挂载；自定义代码是否执行 |
| Console 过滤器 | 确认未隐藏 `Log` |

### `module 'xxx' not found` / loader 返回 null

| 检查项 | Editor | Player |
|--------|--------|--------|
| 文件路径 | `{ProjectRoot}/LuaScripts/xxx.lua` | `StreamingAssets/LuaScripts/xxx.lua.txt` |
| 文件名 | 与 module 名一致 | 同步后带 `.lua.txt` |
| Sync 脚本 | 可选 | **必须** [SyncLuaScriptsToStreamingAssets.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Editor/SyncLuaScriptsToStreamingAssets.cs) |

对照 [Bootstrap.cs LoadLuaModule](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs)。

---

## 类型与成员访问

### `type not found` / 类型为 nil

```
CSharp['Assembly-CSharp']   -- 程序集名是否正确？
CSharp.AC['Ns.TypeName']    -- namespace 是否用括号？
```

- 类型是否 **public**
- 程序集是否已加载（游戏脚本默认 `Assembly-CSharp`）
- 拼写与 C# **FullName** 一致

### `static member not found` / `instance member not found`

| 原因 | 处理 |
|------|------|
| 静/实例混用 | 静态走 `Type.field`；实例走 `obj:Method()` |
| 非 public 成员 | Lua 仅可见 public |
| strict miss | 成员未在 Bind 期注册；检查拼写 |
| 继承成员 | 实例会沿链提升；静态须在 Bind 期扁平化 |

### namespace 类型链式访问失败

❌ `CSharp.AC.MyGame.UI.Panel`  
✅ `CSharp.AC['MyGame.UI.Panel']`

---

## C# 调用 Lua

### `[LuaInvoke]` 无效 / 仍为空实现

- 必须为 **`static extern`**
- 重新编译触发 CodeGen（Editor dnlib 注入）
- module / method 与 Lua `return` 表键一致
- 不能是泛型方法

### 返回值错误

- Lua 函数是否 `return` 了值
- 类型是否支持 marshal（Player MVP 仅部分类型）

---

## 方法重载

### 调用了错误重载

- 多重重载：使用 [LuaAlias] 或 `zlua.get_method` + `register_method`
- 不要用 `obj[sig](obj,...)` 签名字符串键

### `ambiguous` / dispatch 失败

- 检查实参 Lua 类型（integer vs number）
- 显式绑定目标签名

---

## Delegate / Event

### `expects delegate X`

- 须传 **Lua function** 或 delegate userdata
- Event 订阅用 `.get` / `.set`，不是 `=` 赋值

### Event 无法 remove

- `set` 时须传入 **与 get 相同** 的 function 引用

---

## ref / out / in

### out 参数未更新

- 使用 `zlua.new_ref(T)`，不要传裸数字

### ref 修改未反映

- 确认 C# 为 `ref`/`out` 而非 by-val
- struct 须为 StructUserData / `new_ref` 真 ref

---

## Editor 正常、Player 失败

**最常见原因：** 脚本使用了 Il2Cpp MVP **未实现** 的能力。

| 功能 | Player MVP |
|------|:----------:|
| 泛型 / List | ❌ |
| 重载 dispatch / get_method | ❌ |
| delegate / Event | ❌ |
| ref/out | ❌ |
| Demo 级字段 + 简单方法 | ✅ |

排查步骤：

1. 阅读 [兼容性矩阵](../getting-started/compatibility)
2. 确认已 Sync LuaScripts
3. 缩小脚本至 [app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua) 同等能力
4. 查看 Player log / 崩溃栈

---

## 性能与 GC

| 现象 | 建议 |
|------|------|
| Editor 卡顿 | 避免热路径重复 dispatch；用 `[LuaAlias]` |
| 错误评估 Player 性能 | MVP 不代表最终 Il2Cpp 性能 |
| delegate 泄漏 | 取消 Event 订阅；避免 C# 长期持有未释放的 Lua 回调 |

---

## 获取帮助

1. 对照 [FAQ](../community/faq) 与本文
2. 提供 **Unity 版本、Mono/Player、最小复现**（基于 zlua-demo 修改）
3. [GitHub Issues](https://github.com/focus-creative-games/zlua/issues) 或 [联系](../community/contact)

## 相关文档

- [最佳实践](./best-practices)
- [Editor 与 Player](./editor-vs-player)
- [项目状态](../getting-started/project-status)
