---
sidebar_position: 2
title: 贡献指南
description: 如何参与 ZLua 与文档贡献。
---

# 贡献指南

## 文档维护

ZLua 文档统一在 [zlua-doc](https://github.com/focus-creative-games/zlua-doc) 仓库维护。主仓库 `zlua/Docs` 将在文档站完成后移除。

修改文档后本地预览：

```bash
npm install
npm start
```

## 代码贡献

1. 在 [zlua](https://github.com/focus-creative-games/zlua) 提交 Issue 讨论
2. Fork 并创建分支
3. 确保 [测试框架](./testing) 用例通过（Mono Editor 与 Il2Cpp Player）
4. 提交 Pull Request

## 规范变更

涉及 Lua 可见语义的变更须同步更新 `docs/spec/` 下对应规范文档。
