---
sidebar_position: 2
title: 双运行时架构
description: Mono Editor 与 Il2Cpp Player 的实现分工。
---

# 双运行时架构

```mermaid
flowchart LR
    subgraph Editor["Unity Editor"]
        Mono["ZLua.Mono"]
        Reflect["反射 / Expression.Compile"]
    end

    subgraph Player["Il2Cpp Player"]
        Il2Cpp["ZLua.Il2Cpp"]
        Native["C++ MethodBridge"]
    end

    Lua["Lua VM"] --> Mono
    Lua --> Native
    Mono --> Reflect
    Native --> Il2Cpp
```

- **Editor（Mono）** — `ZLua.Mono`：v1.0 **全量功能已实现**，基于反射 + 表达式编译，适合日常开发
- **Player（Il2Cpp）** — `ZLua.Il2Cpp`：**MVP 阶段**，C++ 直桥建设中，当前仅 Demo 级基础互操作

:::info 进度差异
Mono 与 Il2Cpp **目标**是 Lua 可见语义一致；**当前** Player 能力远少于 Editor。发布前请查阅 [项目状态](../getting-started/project-status)。
:::

公共特性（`LuaInvokeAttribute` 等）定义在 `ZLua.Common` 模块。

## 相关规范

- [设计规范](../spec/design-spec)
- [Il2Cpp 架构](../architecture/il2cpp-architecture)
