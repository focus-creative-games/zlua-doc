---
sidebar_position: 4
title: "迁移指南"
---

# 迁移指南

从常见 Unity Lua 绑定方案迁移到 **ZLua** 的索引与共用清单。

> **背景差异：** 见 [compare/FEATURES.md](/docs/compare/FEATURES/)。  
> **ZLua 状态：** Mono（Editor）与 Il2Cpp（Player）**均已完成**；迁移验收以 [spec](/docs/spec/00-OVERVIEW/) 与双端冒烟为准。  
> **适配契约（权威）：** [12-MIGRATION-ADAPTORS.md](/docs/spec/12-MIGRATION-ADAPTORS/)。

---

## 分方案文档

| 文件 | 来源方案 | 内容 |
|------|----------|------|
| [from-xlua.md](/docs/guides/migration/from-xlua/) | xLua | `CS.*`、Generate、`GetFunction`、**xlua adaptor** |
| [from-tolua.md](/docs/guides/migration/from-tolua/) | toLua / tolua# | Wrap、全局短名、**tolua adaptor** |
| [from-slua.md](/docs/guides/migration/from-slua/) | SLua | 导出配置、命名空间链、**slua adaptor** |

---

## 迁移适配层（推荐先用）

ZLua 原生类型入口是 `CSharp[assembly]['Full.Name']`。为降低改写量，包内提供 **可选** 适配（`ZLua~/adaptors/{xlua|tolua|slua}/`）：只解决 **Lua→C# 类型表怎么拿到**，不改变成员调用 / Marshal / C#→Lua 语义。

| 方案 | 旧写法（适配后可继续） | 实际落到 |
|------|------------------------|----------|
| xLua | `CS.UnityEngine.GameObject` | `CSharp['UnityEngine.CoreModule']['UnityEngine.GameObject']` |
| toLua | `GameObject`（全局短名） | 同上 |
| SLua | `UnityEngine.GameObject` | 同上 |

### 五步启用

1. 在 **仍含旧框架** 的工程里，复制 `adaptors/{方案}/ExportTypes.cs` → `Editor/`
2. 菜单 **`ZLua/ExportTypes`** → 生成 `xlua_export_types.lua`（或 `tolua_` / `slua_` 前缀）
3. 把生成清单 + 同方案的 `adaptor.lua` 复制到 ZLua 工程 **LuaLoader 可 `require` 到的目录**
4. 入口脚本：

```lua
local export_types = require "xlua_export_types"  -- 与生成文件名一致
local adaptor = require "adaptor"
adaptor.init(export_types)
```

5. 旧类型路径在 **白名单范围内** 可用；其余仍按 ZLua 规范改写（见下方清单）

### 能力边界（必读）

| 做 | 不做 |
|----|------|
| 按旧导出白名单挂 `CS.*` / 短名 / `UnityEngine.*` | C#→Lua（`GetFunction` 等仍要改） |
| 清单来自旧 Gen / CustomSettings / 特性 | 默认扫全程序集 public |
| 显式 `require` + `init` | 随 `zlualib` 自动安装 |
| — | xLua 式 `List(Int32)` 泛型构造语法（改用 `zlua.make_generic_type`） |

三分案目录 **互不混用**：只复制当前方案那一套，避免菜单重复。细则与验收见 [规范 12](/docs/spec/12-MIGRATION-ADAPTORS/)。

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
| **（可选）适配** | 上节五步；未 `init` 则无 `CS` / 短名等副作用 |

### 2. 类型访问路径

**路线 A — 适配层（减改写）：** 保留旧路径 → [适配层](#迁移适配层推荐先用) / [规范 12](/docs/spec/12-MIGRATION-ADAPTORS/)。

**路线 B — 原生 ZLua：**

- 全局 `CS.X` / 导出全局类 → `CSharp[assembly]['Full.TypeName']`
- **命名空间类型必须用括号键**
- 程序集别名（可选）：`CSharp.AC = CSharp['Assembly-CSharp']`

### 3. 成员调用与重载

- `obj:Method()` 语法大多保留
- 重载歧义 → 全签名键 `Name(Types…)` / `[LuaAlias]` / `zlua.register_method` 短名
- Event → `add_Xxx` / `remove_Xxx`（无 xLua 式 `obj.Event = fn`）
- **适配层不覆盖本项**

### 4. C#→Lua / Delegate

- `[CSharpCallLua]` / `LuaFunction` → `LuaAppDomain.GetFunction<T>("mod","fn")` 后 `Invoke`
- **把 Lua 函数拿回 C#：** `GetFunction<Action>`/`GetFunction<Func<…>>`；或 `GetFunction<Delegate>` + `zlua.to_delegate`（见 [Function 与 Delegate](/docs/guides/functions/)）
- Lua function 作 C# 参数 → 方法形参 `Action`/`Func`/delegate（隐式 marshal）
- 删除 xLua `DelegateBridge` 手动注册（按 ZLua delegate spec）
- **适配层明确不覆盖 C#→Lua**

### 5. 值类型、ref、GC 敏感路径

- struct / `ref` / `out` 对照 [spec/marshal/](/docs/spec/marshal/)
- C#→Lua 的 `ref` → **OpaqueValue**（非 integer）
- 热路径避免每帧 new string / 依赖跨帧 Opaque

### 6. 生成 / 导出配置废弃

- 删除 XLua Generate、toLua `CustomSettings`、SLua 导出列表（**不再作为访问控制**）
- 敏感 API 改 **非 public** 而非白名单
- Il2Cpp：确保测试与游戏程序集走 ZLua Codegen（Lua→C# stub）
- 适配用的 `*_export_types.lua` **不是** 新白名单管控，只是迁移期类型路径兼容；长期可逐步改为原生 `CSharp` 并卸掉 adaptor

### 7. 测试与回归

- 按 [TESTING.md](/docs/community/testing/) 建立 `Tests/Lua` 用例
- **Editor + Il2Cpp Player** 双端全绿
- 对比 [compare/PERFORMANCE.md](/docs/compare/PERFORMANCE/) 确认性能预期
- 若用适配：抽测旧路径与 `CSharp[asm][full]` 指向同一类型表

---

## 迁移策略建议

| 策略 | 适用 |
|------|------|
| **先适配、后收口** | 大项目；先 `adaptor.init` 稳住类型访问，再按模块改 `CSharp` / 卸适配 |
| **模块切分** | 先迁纯 Lua 模块，再逐 assembly 收口路径 |
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
| [spec/12-MIGRATION-ADAPTORS.md](/docs/spec/12-MIGRATION-ADAPTORS/) | 适配契约（与本文冲突时以 spec 为准） |
| [compare/](/docs/compare/) | 四方对比索引 |
| [spec/02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) | ZLua 类型规范 |
| [CONTRIBUTING.md](/docs/community/contributing/) | 贡献与路径规则 |
