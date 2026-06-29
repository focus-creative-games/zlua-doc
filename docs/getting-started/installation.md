---
sidebar_position: 2
title: 安装与集成
description: 将 ZLua Package 接入 Unity 工程。
---

# 安装与集成

:::warning 运行时差异
**Mono（Editor）** 已支持 v1.0 全量功能；**Il2Cpp（Player）** 仍为 MVP，仅 Demo 级基础互操作。Player 构建前请阅读 [项目状态](./project-status)。
:::

## 前置要求

- Unity **2021+ LTS**（当前 Alpha 已在 **2022.3.62f3** 验证）
- Scripting Backend：**Mono**（Editor）/ **Il2Cpp**（Player）
- Lua 版本：**5.4**（Alpha 阶段；后续支持 5.1–5.5、LuaJIT、Luau）

## 推荐目录结构

```
YourUnityProject/
├── Assets/
├── Packages/
│   └── com.code-philosophy.zlua/    # ZLua UPM 包
└── StreamingAssets/
    └── LuaScripts/
        ├── app.lua.txt              # 模块 app
        └── ...
```

## 初始化清单

1. 引入 ZLua Package（UPM 或本地路径，待正式发布）
2. 在 `StreamingAssets/LuaScripts/` 放置 Lua 脚本（`.lua.txt` 避免 Unity 误导入）
3. 实现 `LoadLuaModule` 并在启动时调用 `LuaAppDomain.Initialize(loader)`
4. 用 `[LuaInvoke]` 声明需从 C# 调用的 Lua 函数

## 下一步

- [快速开始](./quick-start)
- [支持的版本与平台](./compatibility)
