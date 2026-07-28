---
sidebar_position: 3.5
title: EmmyLua 调试器
description: Editor Mono 下用 EmmyLua 对运行中的 Lua 断点调试（常用配置）。
---

# EmmyLua 调试器

在 **Unity Editor（`ZLua.Mono`）** 里用 [EmmyLua](https://github.com/EmmyLua/EmmyLuaDebugger) 对业务 Lua 断点调试。宿主在 `Initialize` 后自动 `tcpListen`，IDE Attach 即可。

:::info 范围
仅 **Editor**。不覆盖 Il2Cpp Player / 真机 / WebGL。完整约定见 [规范 · EmmyLua 调试器](/docs/spec/build/04-EMMYLUA-DEBUGGER/)。
:::

## 快速启用

1. **Project Settings → ZLua**
   - `enableDebugger` = **true**（默认关闭）
   - `debuggerPort` = **9966**（与 IDE 一致）
   - `debuggerWaitIDE` = **false**（推荐；为 true 会在主线程无超时阻塞，易假死）
2. 确认当前 Lua 系列有对应 `emmy_core`（见下节）
3. Unity **Play**（触发 `Initialize`），Console 出现 `EmmyLua debugger listening on 127.0.0.1:…`
4. IDE 用下方 `launch.json` **F5** 连接 → 在源码根下的 `.lua` 打断点并跑到该模块

推荐顺序：**先 Play 听端口，再 IDE 连接**；不要一上来就开 `waitIDE`。

## `emmy_core` 与 Lua 版本

包内**只随附** **Lua 5.5** 对应的库：`Plugins/emmylua/lua55/<platform>/emmy_core.*`。

| 你的 Settings 版本 | 目录 | 说明 |
|--------------------|------|------|
| `lua-5.5.*` | `lua55/` | 开箱可用 |
| 5.1–5.4 / LuaJIT | `lua53/`、`luajit21/` 等 | 须按 [EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger) 自建，放入对应系列目录 |

**不要**把 5.5 的 `emmy_core` 拷到其它系列目录凑合用。缺目录时 Console 会报错并**跳过调试器**，不中断 `Initialize`。

`emmy_core` 必须是 **Lua C 模块**（经 `require` 加载）：其 PluginImporter 应 **全平台禁用**，勿当普通 Unity 原生插件启用。

## IDE 配置（VS Code / Cursor）

安装 **EmmyLua** 扩展，用 IDE **打开 Unity 工程根**（含 `Packages` 的那一层）。`.vscode/launch.json` 示例：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "emmylua_new",
      "request": "launch",
      "name": "ZLua EmmyLua (Unity Editor)",
      "host": "127.0.0.1",
      "port": 9966,
      "sourcePaths": [
        "${workspaceFolder}/LuaScripts"
      ],
      "ext": [".lua"],
      "ideConnectDebugger": true
    }
  ]
}
```

| 字段 | 注意 |
|------|------|
| `host` | 用 **`127.0.0.1`**（避免 `localhost` → IPv6 连不上） |
| `port` | 与 Settings `debuggerPort` 相同 |
| `sourcePaths` | **必填**：对准 `moduleLoader` 的 Lua 根（Demo 常为 `LuaScripts`；测试工程可能是 `Tests/Lua`） |
| `ideConnectDebugger` | `true`：连已 `tcpListen` 的 Editor |

能连上但断点灰色 / Could not load source → 几乎都是 **`sourcePaths` 指错**。多根目录可在数组里追加多项。

可选 `.emmyrc.json` 只影响补全/诊断，**不替代** `sourcePaths`。大量 `CSharp` 全局时可关掉 `undefined-global` 诊断噪音。

## 常见问题

| 现象 | 处理 |
|------|------|
| `debugger skipped` / 缺目录 | 当前系列无 `Plugins/emmylua/<series>/`；非 5.5 需自建 |
| IDE 连不上 | 是否已 Play 并 listen；端口 / `127.0.0.1`；防火墙 |
| 断点不生效 | `sourcePaths`；工作区是否为工程根 |
| Play 后 Editor 假死 | 关掉 `debuggerWaitIDE`，或先 F5 再 Play |
| 扩展无 `emmylua_new` | 安装/启用 EmmyLua 后重载窗口 |





## 学习路径

| | |
|---|---|
| **上一篇** | [构建流程](/docs/guides/build/) |
| **下一篇** | [Lua 调用 C#](/docs/guides/lua-calling-csharp/) |

## 相关文档

- [规范 · EmmyLua 调试器](/docs/spec/build/04-EMMYLUA-DEBUGGER/) — ABI 目录、自建、`waitIDE`、验收清单  
- [安装与 Lua 版本](/docs/guides/install/)  
- [初始化与最小互调](/docs/guides/hello-interop/)  
- [上游 EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger)
