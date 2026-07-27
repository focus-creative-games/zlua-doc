---
sidebar_position: 2
title: "贡献约定"
---

# 文档与实现贡献约定

> 参与 ZLua 文档、规范与代码时的权威顺序、修改流程与路径规则。

---

## 1. 权威序（冲突裁决）

当文档与实现冲突时，按以下顺序裁决：

```
① docs/spec/**      ← 规范性契约（最高；本仓库唯一语义标准）
② Il2Cpp 源码 zlua/** ← 实现真相（Il2Cpp 已完成；与规范冲突时改规范或实现对齐）
③ docs/impl/**      ← 实现说明（不改变 Lua 可见语义）
④ docs/guides/** 等      ← 用户指南 / 社区迁移与贡献
⑤ docs/compare/**   ← 与其它方案对比（非行为契约）
```

根目录说明见 [README.md](/docs/intro/)。

---

## 2. 改 spec 还是改 impl？

| 变更类型 | 先改什么 | 再改什么 |
|----------|----------|----------|
| **Lua 可见行为**（API、错误语义、nil/error） | `spec/**` | Il2Cpp `zlua/**` + Mono `Runtime/Mono/**` + `Tests/Lua/**` |
| **仅实现策略**（Emit 细节、模块划分） | `impl/**` | 代码；**不**改 spec |
| **性能 / 对比 / 迁移** | `docs/compare/**` 或 `docs/guides/**` / `docs/community/**` | 无需改 spec |
| **术语统一** | `concepts/glossary.md` | 相关 spec 交叉引用 |

**禁止：** 长期只改一侧导致 spec 与 Player 行为漂移。

### 2.1 推荐 PR 流程

1. 在 `spec/` 写清行为 / 错误语义 / **测试用例 id**（见 [TESTING.md](/docs/community/testing/)）。
2. 实现 Il2Cpp + Mono（双端均须满足 spec；无法 Emit 的签名绑定期报错，禁止热路径 `Method.Invoke`）。
3. 添加或更新 `Tests/Lua/cases/**/tc_*.lua` 与 `manifest.lua`。
4. 若实现细节需说明，补 `impl/` 分册。
5. 对比或迁移影响面大时，更新 `compare/` 或 `community/migration/`。

---

## 3. 代码路径规则

### 3.1 Il2Cpp（Player 真相源）

| 允许编辑 | 禁止（除非用户明确要求） |
|----------|------------------------|
| `build-win64/Il2CppOutputProject/IL2CPP/libil2cpp/zlua/**` | `Packages/com.code-philosophy.zlua/ZLua~/libil2cpp-2022/**` |
| 必要时 `libil2cpp/lua/**` | 包内目录为 **手动同步副本** |

权威参考：[README.md](/docs/intro/) 双端一致性表。

### 3.2 Mono（Editor）

| 路径 | 说明 |
|------|------|
| `Packages/com.code-philosophy.zlua/Runtime/Mono/**` | Editor 实现；见 [impl/MONO.md](/docs/impl/MONO/) |
| `_archive/Mono-pre-rewrite-*` | 只读参考，**不**参与编译 |

**Mono 实现硬性规则（摘要）：**

- 三表 Lua indexer（见 [impl/metatable/INDEXER-MONO.md](/docs/impl/metatable/INDEXER-MONO/)）。
- 无法 Expression Emit 的签名 → **绑定期显式错误**，禁止热路径 `Method.Invoke`。
- 无 Event 专用支持；`add_` / `remove_` 作普通方法。

### 3.3 Lua 测试

| 允许 | 禁止 |
|------|------|
| `Tests/Lua/**` | 手动改 `Assets/StreamingAssets/Tests/**` |

构建时 `SyncTestsLuaToStreamingAssets` 自动同步。

---

## 4. 文档写作约定

1. **简体中文**为主（与 spec 一致）。
2. 使用 **相对链接** 链到 `spec/`、`impl/`、`compare/`。
3. 规范条款尽量带 **测试用例 id**。
4. `compare/**` 保持诚实对比，不写营销话术。

边界约定见 [README.md](/docs/intro/) §边界约定。

---

## 5. Il2Cpp 编码约定（摘要）

| 规则 | 说明 |
|------|------|
| 勿主动 `#include "il2cpp-api-types.h"` | 经项目头 transitive include |
| `Il2CppClass*` / `MethodInfo*` 等 | 默认 **非 null**；勿滥加 nullptr 分支 |
| 详见 | 仓库 `.cursor/rules/` 中 il2cpp 相关规则 |

---

## 6. 双端一致性验收

| 检查 | 要求 |
|------|------|
| Editor Play | `TestScene` manifest 全绿 |
| Il2Cpp Player | 同一 manifest 全绿 |
| 语义 | Mono 与 Il2Cpp Lua 可见行为 **必须一致** |

双端语义以 spec 为准；实现路径见 [impl/MONO.md](/docs/impl/MONO/) / [impl/IL2CPP.md](/docs/impl/IL2CPP/)。

---

## 相关文档

| 文档 | 内容 |
|------|------|
| [TESTING.md](/docs/community/testing/) | 测试与条款映射 |
| [migration/README.md](/docs/guides/migration/) | 迁移指南 |
| [spec/00-OVERVIEW.md](/docs/spec/00-OVERVIEW/) | 产品总览 |
