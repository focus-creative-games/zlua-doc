---
sidebar_position: 2
title: 贡献指南
description: 如何参与 ZLua 代码与文档贡献。
---

# 贡献指南

感谢参与 ZLua 与文档建设。本文说明 **文档 PR**、**代码 PR** 与 **规范变更** 流程。

## 仓库分工

| 仓库 | 内容 |
|------|------|
| [zlua](https://github.com/focus-creative-games/zlua) | 运行时、CodeGen、测试工程 |
| [zlua-doc](https://github.com/focus-creative-games/zlua-doc) | 本站全部用户文档与规范 |
| [zlua-demo](https://github.com/focus-creative-games/zlua-demo) | 文档 **canonical** 示例工程 |

主仓库 `zlua/Docs` 将在文档站稳定后移除；**新文档只提交 zlua-doc**。

## 文档贡献

### 本地预览

```bash
git clone https://github.com/focus-creative-games/zlua-doc.git
cd zlua-doc
npm install
npm start          # 开发预览 http://localhost:3000
npm run build      # 生产构建（CI 同款，须无 broken links）
```

### 文档 PR 检查清单

- [ ] 简体中文，术语与现有页面一致（`LuaInvoke`、`CSharp`、`zlua`）
- [ ] 可运行示例链接到 **zlua-demo `main` 分支具体文件**
- [ ] 涉及能力处标注 **Mono / Il2Cpp** 支持表
- [ ] 用户向「怎么用」放 `guides/`；语义变更同步 `spec/`
- [ ] `npm run build` 通过
- [ ] 规范页（`spec/`）保留 `mdx.format: md` front matter

### 写作模板（`guides/`）

1. **概述** — 2–3 句
2. **Canonical 链接** — zlua-demo 文件
3. **基本用法** — 最小示例
4. **完整示例** — C# + Lua 成对
5. **Mono / Il2Cpp 支持** — ✅ / ⚠️ / ❌ 表
6. **常见错误**
7. **相关文档** — 指南 + 规范 + API 参考

### 示例来源优先级

1. [zlua-demo](https://github.com/focus-creative-games/zlua-demo)
2. zlua 仓库 Tests / README
3. 规范中的 illustrative 示例（须标注）

### 规范内链

从旧 `zlua/Docs` 粘贴时，将 `./LIB_SPEC.md` 等改为站内路径（如 `/docs/spec/lib-spec`）。修改 `spec/` 后务必 `npm run build` 检查链接。

## 代码贡献

1. 在 [zlua Issues](https://github.com/focus-creative-games/zlua/issues) 讨论方案
2. Fork → 功能分支 → 实现
3. **Mono Editor**：打开 ZLuaTest `TestScene` → Play → `[SUMMARY] failed=0`
4. **Il2Cpp（若触及 Player）**：Build Player + batchmode，exit code 0
5. 提交 PR，说明影响范围与测试方式

## 规范变更流程

Lua **可见语义**变更（marshal、重载、类型访问等）须：

```mermaid
flowchart LR
    A[实现变更 zlua] --> B[更新 docs/spec/ 对应规范]
    B --> C[更新 guides/ + reference/]
    C --> D[更新 compatibility 矩阵]
    D --> E[补充 ZLuaTest 用例]
    E --> F[zlua-doc PR 可同发或跟进]
```

| 变更类型 | 必改文档 |
|----------|----------|
| 新 Lua API | `spec/lib-spec` + `reference/lua/` + 指南 |
| Marshal 规则 | `spec/marshal/` + `marshal-cheatsheet` |
| 重载 / 别名 | `spec/method-overload-spec` + `guides/methods-and-overloads` |
| Il2Cpp 能力边界 | `getting-started/compatibility` + `roadmap` |

**原则：** 规范为权威语义；指南写任务与示例，不复制整章 SPEC。

## 能力标注约定

```markdown
| 能力 | Mono (Editor) | Il2Cpp (Player) |
|------|:-------------:|:---------------:|
| 某功能 | ✅ | ❌ |
```

## 联系方式

- Bug / 功能：[GitHub Issues](https://github.com/focus-creative-games/zlua/issues)
- 社区：[联系](./contact)

## 相关文档

- [测试框架](./testing)
- [路线图](./roadmap)
