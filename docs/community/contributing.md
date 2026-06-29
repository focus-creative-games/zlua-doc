---
sidebar_position: 2
title: 贡献指南
description: 如何参与 ZLua 与文档贡献。
---

# 贡献指南

## 文档维护

ZLua 文档统一在 [zlua-doc](https://github.com/focus-creative-games/zlua-doc) 仓库维护。主仓库 `zlua/Docs` 将在文档站完成后移除。

### 本地预览

```bash
npm install
npm start
```

构建检查：

```bash
npm run build
```

### 示例代码来源（canonical）

文档中的可运行示例 **优先引用 [zlua-demo](https://github.com/focus-creative-games/zlua-demo)**，并链接到 `main` 分支具体文件：

| 用途 | 路径 |
|------|------|
| 初始化 / LuaInvoke | [Assets/Bootstrap.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs) |
| Lua 访问的 C# 类型 | [Assets/Demo.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Demo.cs) |
| Lua 主模块 | [LuaScripts/app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua) |
| UPM 依赖 | [Packages/manifest.json](https://github.com/focus-creative-games/zlua-demo/blob/main/Packages/manifest.json) |
| Player 脚本同步 | [Assets/Editor/SyncLuaScriptsToStreamingAssets.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Editor/SyncLuaScriptsToStreamingAssets.cs) |

### 指南页写作模板

`docs/guides/` 下教程建议结构：

1. **概述** — 2–3 句说明场景
2. **Canonical 链接** — 指向 zlua-demo 文件
3. **基本用法** — 最小示例
4. **完整示例** — C# + Lua 成对
5. **进阶** — 可选
6. **Mono / Il2Cpp 支持** — 表格标注 ✅ / ⚠️ / ❌
7. **常见错误** — 排错表
8. **相关文档** — 指南 + 规范链接

### 规范文档（`docs/spec/`）

- 保持 `mdx.format: md` front matter，避免 MDX 解析 C# 花括号
- 修改后运行 `npm run fix-spec-links` 统一站内引用（若从旧 SPEC 粘贴）
- 用户向「怎么用」写在 `guides/`；语义变更只改 `spec/`

### 能力标注

涉及运行时差异时，使用统一表格：

```markdown
| 能力 | Mono (Editor) | Il2Cpp (Player) |
|------|:-------------:|:---------------:|
| 某功能 | ✅ | ❌ |
```

## 代码贡献

1. 在 [zlua](https://github.com/focus-creative-games/zlua) 提交 Issue 讨论
2. Fork 并创建分支
3. 确保 [测试框架](./testing) 用例通过（Mono Editor 与 Il2Cpp Player）
4. 提交 Pull Request

## 规范变更

涉及 Lua 可见语义的变更须同步更新 `docs/spec/` 下对应规范文档，并更新 `docs/guides/` 中相关教程与 [兼容性](../getting-started/compatibility) 矩阵。
