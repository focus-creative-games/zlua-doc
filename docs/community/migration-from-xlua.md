---
sidebar_position: 6
title: 从 xLua 迁移
description: 从 xLua / tolua 迁移到 ZLua 的对照草稿（v2.0 完整版规划中）。
---

# 从 xLua 迁移

:::info 对照草稿
本文为 **迁移对照草稿**，便于评估与试点迁移；完整迁移指南、工具与案例计划在 **v2.0**。架构差异见 [与 xLua 对比](../concepts/comparison-with-xlua)。
:::

## 何时考虑迁移

| 适合 | 暂缓 |
|------|------|
| 新项目、Il2Cpp 性能敏感 | 大量 xLua 生成 Wrap 存量、短期上线 |
| 希望统一 C# 语义、少维护 Wrap | 依赖 xLua 生态工具链且无法替换 |
| 可接受 Editor Mono 全功能 + Player 分阶段 | 当前必须全平台完整 Il2Cpp 特性 |

**当前 Il2Cpp 仍为 MVP** — 生产 Player 仅适合 Demo 级互操作，见 [项目状态](../getting-started/project-status)。

---

## 概念对照

| 概念 | xLua | ZLua |
|------|------|------|
| Lua 环境 | `LuaEnv` 手动管理 | `LuaAppDomain.Initialize` 全局集成 |
| C# → Lua | `luaenv.DoString` / `GetFunction` / DelegateBridge | `[LuaInvoke("mod","fn")]` + `static extern` |
| Lua → C# | `[LuaCallCSharp]` 生成 Wrap | `CSharp.{asm}.Type` 懒注册，无 C# Wrap |
| 类型根 | `CS.Namespace.Type` | `CSharp.{assembly}.Type` 或 `['Ns.Type']` |
| 实例方法 | `obj:Method()` | 相同 `obj:Method()` |
| 静态 | `CS.Type.Method()` | `CSharp.Asm.Type.Method()` |
| 代码生成 | 大量 C# Wrap + libxlua | Editor 注入 + Il2Cpp C++ 桥（无 Wrap 膨胀） |
| 热更路径 | 常见 xLua 工具链 | Lua 源码 + `LoadLuaModule`（同 Demo） |

---

## API 映射示例

### 初始化

**xLua：**

```csharp
LuaEnv luaenv = new LuaEnv();
luaenv.DoString("require 'main'");
```

**ZLua：**

```csharp
LuaAppDomain.Initialize(LoadLuaModule);
// C# 侧 [LuaInvoke] 或 Lua 主动 CSharp.* 访问
```

参考 [Bootstrap.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs)。

### C# 调用 Lua

**xLua：**

```csharp
LuaFunction f = luaenv.Global.Get<LuaFunction>("add");
f.Call(1, 2);
```

**ZLua：**

```csharp
[LuaInvoke("app", "add")]
private static extern int Add(int a, int b);
```

### Lua 访问 C# 类型

**xLua：**

```lua
local Demo = CS.MyGame.Demo
local d = Demo()
d:Run(10)
```

**ZLua：**

```lua
CSharp['AC'] = CSharp['Assembly-CSharp']
local Demo = CSharp.AC['MyGame.Demo']   -- 或 CSharp.AC.Demo
local d = Demo()
d:Run(10)
```

### 委托 / 回调

**xLua：**

```lua
obj:Subscribe(function(x) print(x) end)
-- 或 xLua 特有 adapter
```

**ZLua：**

```lua
obj:Subscribe(function(x) print(x) end)   -- 隐式 marshal，见回调指南
```

### 热更新标注

**xLua：** `[LuaCallCSharp]` / `[CSharpCallLua]` 列表 + 代码生成

**ZLua：** 无 `[LuaCallCSharp]`；public 成员 **按需 lazy bind**，无需预生成 Wrap 列表

---

## 文件与工程差异

| 项 | xLua | ZLua |
|----|------|------|
| Package | `com.tencent.xlua` 等 | `com.code-philosophy.zlua`（Git UPM） |
| Lua 路径 | 项目自定义 | 推荐 `LuaScripts/` + Player Sync |
| 示例工程 | xLua 官方 Examples | [zlua-demo](https://github.com/focus-creative-games/zlua-demo) |
| 文档 | xLua 手册 | [ZLua Docs](https://doc.zlua.cn) |

---

## 建议迁移步骤（草稿）

1. **并行评估** — 只读 [与 xLua 对比](../concepts/comparison-with-xlua)，确认 Il2Cpp 路线与 MVP 边界
2. **搭骨架** — clone zlua-demo，替换 `Demo.cs` / `app.lua` 为最小业务
3. **迁 Lua 层** — `CS.` → `CSharp.{asm}.`；namespace 改括号访问
4. **迁 C# 调 Lua** — `GetFunction` / `DoString` → `[LuaInvoke]`
5. **删 Wrap 配置** — 移除 xLua Generator 与 `[LuaCallCSharp]` 列表
6. **Editor 全量验证** — Mono 跑通业务（泛型、Event、ref 等）
7. **Player 裁剪** — 按 [兼容性矩阵](../getting-started/compatibility) 剥离 MVP 不支持 API，或等待 Il2Cpp 对齐
8. **性能回归** — Il2Cpp 完整版发布后再 benchmark

---

## 已知无法 1:1 映射项

| xLua 习惯 | ZLua 差异 |
|-----------|-----------|
| `LuaTable` / `LuaFunction` 句柄 | 以 module return + `[LuaInvoke]` 为主 |
| 大量预生成 Wrap | 无；Il2Cpp 走 C++ 桥 |
| `CS` 全局 | 固定 `CSharp` 根表 |
| 部分 xLua 扩展 API | 使用 `zlua.*` 标准库 |

---

## 相关文档

- [与 xLua 对比](../concepts/comparison-with-xlua)
- [路线图](./roadmap) — v2.0 完整迁移指南
- [快速开始](../getting-started/quick-start)
- [排错指南](../guides/troubleshooting)
