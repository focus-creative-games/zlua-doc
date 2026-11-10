---
title: InteropMetadata
description: 为 Il2Cpp Player 后加载程序集注册运行时 XML。
---

# InteropMetadata

`InteropMetadata` 为 **Il2Cpp Player** 后加载的程序集注册 Alias / MarshalAs / Extension XML。行为契约见 [宿主 API 规范](/docs/spec/01-HOST-API/#interop-metadata)。

## 调用方式

```csharp
ZLua.InteropMetadata.RegisterAliasXml(paths, projectRoot);
ZLua.InteropMetadata.RegisterMarshalAsXml(paths, projectRoot);
ZLua.InteropMetadata.RegisterExtensionXml(paths, projectRoot);
```

| 参数 | 含义 |
|------|------|
| `paths` | 对应规则种类的 XML 路径，内容须使用该种类的 schema |
| `projectRoot` | 解析工程相对路径时使用的工程根目录 |

只注册项目需要的规则种类。XML 格式分别见 [Alias](/docs/spec/04-METHOD-OVERLOAD/)、[MarshalAs](/docs/spec/marshal/02-MARSHAL-AS/)、[Extension](/docs/spec/13-EXTENSION-METHODS/)。

## 顺序与生命周期

1. `Assembly.Load` 加载程序集。
2. 调用所需的 Register 方法。
3. 首次访问 / 绑定类型。

已绑定类型不会被后续注册更新；没有 Reload API。`LuaAppDomain.Reset` 保留进程级 XML 表。Editor Mono 方法为空实现，必须在 Player 验证该流程。Settings XML 仍用于预编译 / AOT 的构建期配置，不会自动替后加载 DLL 注册。

完整使用步骤见 [HybridCLR 集成](/docs/guides/hybridclr/)。
