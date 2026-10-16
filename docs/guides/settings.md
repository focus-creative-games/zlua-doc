---
sidebar_position: 1.2
title: Settings
description: Project Settings → ZLua 的字段、存在哪、改完要不要重新 Generate。
---

# Settings

菜单 **`ZLua/Settings...`** 打开 **Project Settings → ZLua**。内容写在 `ProjectSettings/ZLua.asset`。字段契约见 [14-SETTINGS](/docs/spec/14-SETTINGS/)。

## 字段

| 界面 | 做什么 |
|------|--------|
| **Enable** | 关掉后当前构建目标不启用 ZLua |
| **Lua Version Id** | `lua-5.5.0` 或 `luajit-2.1` 这类 id。改完要重新 **Install**，见 [安装与 Lua 版本](/docs/guides/install/) |
| **MarshalAs Xml Paths** | 不能改源码的程序集上的 Marshal 规则。见 [LuaMarshalAs](/docs/guides/lua-marshal-as/) |
| **Lua Alias Xml Paths** | 同上，方法换名。见 [LuaAlias](/docs/guides/lua-alias/) |
| **Lua Extension Xml Paths** | 同上，扩展方法挂到目标类型。见 [Extension 方法](/docs/guides/extension-methods/) |
| **Unity Optimizations** | 默认开。启用包里自带的 Unity API 优化，当前是 `GetComponent`。见 [Unity 优化](/docs/guides/unity-optimizations/) |
| **Enable Debugger** | 仅 Editor。接 EmmyLua，见 [调试器](/docs/guides/debugger/) |
| **Debugger Port** | 默认 `9966` |
| **Debugger Wait IDE** | 勾上会堵住主线程，直到 IDE Attach |

三类 XML **不要** 用来配置热更新程序集；热更用 Attribute。

改 MarshalAs / Alias / Extension 路径，或勾选 **Unity Optimizations** 之后，Editor 里下次初始化会按新列表加载。打 Il2Cpp 包前要再跑一次 **`ZLua/Generate/All`**。
