---
title: HybridCLR 集成
description: 统一安装、加载热更程序集与首次绑定前注册 XML。
---

# HybridCLR 集成

本文面向 [安装规范](/docs/spec/11-MULTI-VERSION/) 中的统一集成包。由 ZLua 的 Installer 安装 HybridCLR 底座并叠加 ZLua；旧版双包流程不适用于本页。

## 安装与生成

1. 按 [安装与集成](/docs/getting-started/installation/) 引入 ZLua，配置 Settings 并执行 `ZLua/Install...`。
2. 不要另装 `com.code-philosophy.hybridclr` 或运行另一个 Installer 覆盖本地 Il2Cpp 树。
3. 发布前运行 `ZLua/Generate/All`：StripAOT 只执行一次，然后串行生成 HybridCLR MethodBridge 与 ZLua 桥。
4. 换 Unity / Lua 或升级包后重跑 Install → Generate。具体兼容版本见 [兼容性](/docs/getting-started/compatibility/)。

## 加载热更程序集与 XML

在 Lua 首次访问热更类型之前完成以下顺序：

1. 按项目需要加载补充 AOT 元数据。
2. 使用 `Assembly.Load` 加载热更程序集。
3. 如果使用 XML，调用 `InteropMetadata.Register*Xml`。
4. 执行 Lua / C# 代码，触发类型首次绑定。

```csharp
// dllBytes 由项目资源系统提供；paths / projectRoot 是项目配置。
System.Reflection.Assembly.Load(dllBytes);
ZLua.InteropMetadata.RegisterAliasXml(aliasPaths, projectRoot);
ZLua.InteropMetadata.RegisterMarshalAsXml(marshalPaths, projectRoot);
ZLua.InteropMetadata.RegisterExtensionXml(extensionPaths, projectRoot);
// 此后才能首次访问热更类型。
```

`LuaAppDomain.Initialize` 可以更早执行，但 Lua 代码访问热更类型必须在加载和注册之后。无需 XML 的项目可省略注册步骤，继续使用 `[LuaAlias]` / `[LuaMarshalAs]` / `[LuaExtension]`。

## 三种配置路径

| 配置 | 适用范围 | 生效时机 |
|------|----------|----------|
| C# Attribute | 可改源码的类型，包括热更类型 | 类型绑定时读取 |
| Settings XML | 构建期已知的预编译 / AOT 程序集 | Editor 初始化；Il2Cpp Generate 烘焙 |
| `InteropMetadata.Register*Xml` | Il2Cpp Player 后加载程序集 | 加载程序集后、首次类型绑定前显式注册 |

Settings 的路径列表不会自动为后加载 DLL 注册运行时元数据。Editor Mono 的 `Register*Xml` 是空实现；热更类型的验证须在 Il2Cpp Player 中执行。

已创建 `MetaBinding` 的类型不会被后续注册更新。没有 Reload API；`LuaAppDomain.Reset` 也不清空进程级 XML 表，不能用于修改已绑定类型的元数据。完整契约与参数见 [InteropMetadata](/docs/reference/csharp/interop-metadata/)。

## 验证与排错

| 现象 | 检查 |
|------|------|
| Install / patch 失败 | 是否混用了旧独立包与统一包；重跑当前包的 Install |
| 热更类型不可见 | 是否已加载 DLL；程序集名和类型全名是否正确 |
| XML 不生效 | 是否在 Player 调用正确的 Register 方法；是否已过首次绑定 |
| 换版本后构建异常 | Install → Generate → 重新构建 |

继续 [首次构建](/docs/getting-started/build/)，并在 Player 中运行热更类型访问与 Alias / MarshalAs / Extension 冒烟测试。
