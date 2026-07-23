---
sidebar_position: 4
title: "迁移指南"
---

# 迁移指南

从常见 Unity Lua 绑定方案迁移到 **ZLua** 的索引与共用清单。

> **背景差异：** 见 [compare/FEATURES.md](../../compare/FEATURES)。  
> **ZLua 状态：** Mono（Editor）与 Il2Cpp（Player）**均已完成**；迁移验收以 [spec](../../spec/00-OVERVIEW) 与双端冒烟为准。

---

## 分方案文档

| 文件 | 来源方案 | 内容 |
|------|----------|------|
| [from-xlua.md](./from-xlua) | xLua | `CS.*` → `CSharp`、Generate 废弃、`[LuaInvoke]` |
| [from-tolua.md](./from-tolua) | toLua / tolua# | 删除 Wrap、全局类 → 懒绑定 |
| [from-slua.md](./from-slua) | SLua | 导出配置 → public + 懒 Bind |

---

## 共用迁移清单

按顺序执行；各方案文档有 before/after 与专项坑点。

### 1. 环境与初始化

| 步骤 | 说明 |
|------|------|
| 引入 ZLua 包 | 替换原插件 asmdef 引用 |
| 初始化 | `LuaAppDomain.Initialize(moduleLoader)` 替代 `LuaEnv` / `LuaState` / `LuaSvr` |
| 模块 loader | 对接现有 `require` 路径；Player 需 `.lua.txt` 规则 |
| 删除旧 native | 移除 libxlua / tolua binding 等与 ZLua 冲突的 native 插件 |

### 2. 类型访问路径

- 全局 `CS.X` / 导出全局类 → `CSharp[assembly]['Full.TypeName']`
- **命名空间类型必须用括号键**
- 建立程序集别名（可选）：`CSharp.AC = CSharp['Assembly-CSharp']`

### 3. 成员调用与重载

- `obj:Method()` 语法大多保留
- 重载歧义 → `[LuaAlias]` / 本地缓存 direct closure / `zlua.register_method`
- Event → `add_Xxx` / `remove_Xxx`（无 xLua 式 `obj.Event = fn`）

### 4. C#→Lua / Delegate

- `[CSharpCallLua]` / `LuaFunction` → `[LuaInvoke("mod","fn")]` static extern（直接调）
- **把 Lua 函数拿回 C#：** `[LuaInvoke]` **返回** `Action`/`Func`；或返回 `Delegate` + module/method/`Type` + `zlua.to_delegate`（见 [回调与 Delegate §3](../../guides/callbacks-and-delegates)）
- Lua function 作 C# 参数 → 方法形参 `Action`/`Func`/delegate（隐式 marshal）
- 删除 xLua `DelegateBridge` 手动注册（按 ZLua delegate spec）

### 5. 值类型、ref、GC 敏感路径

- struct / `ref` / `out` 对照 [spec/marshal/](../../spec/marshal/)
- C#→Lua 的 `ref` → **OpaqueValue**（非 integer）
- 热路径避免每帧 new string / 依赖跨帧 Opaque

### 6. 生成 / 导出配置废弃

- 删除 XLua Generate、toLua `CustomSettings`、SLua 导出列表（**不再作为访问控制**）
- 敏感 API 改 **非 public** 而非白名单
- Il2Cpp：确保测试与游戏程序集走 ZLua Codegen + Weaver

### 7. 测试与回归

- 按 [TESTING.md](../testing) 建立 `Tests/Lua` 用例
- **Editor + Il2Cpp Player** 双端全绿
- 对比 [compare/PERFORMANCE.md](../../compare/PERFORMANCE) 确认性能预期

---

## 迁移策略建议

| 策略 | 适用 |
|------|------|
| **模块切分** | 大项目；先迁纯 Lua 模块，再逐 assembly 改 `CSharp` 路径 |
| **双轨并行** | 短期不可全量；独立分支 + 场景隔离（长期应消除双插件） |
| **测试驱动** | 为旧脚本关键 API 写 `tc_*.lua`，迁一条绿一条 |

---

## 不建议迁移的情况

- 项目强依赖 xLua 热更 toolchain 且无替换方案
- 团队无法维护 libil2cpp merge
- 互调非性能瓶颈且 toLua/SLua 已稳定多年

---

## 相关文档

| 文档 | 内容 |
|------|------|
| [compare/README.md](../../compare/) | 四方对比索引 |
| [spec/02-TYPE-SYSTEM.md](../../spec/02-TYPE-SYSTEM) | ZLua 类型规范 |
| [CONTRIBUTING.md](../contributing) | 贡献与路径规则 |
