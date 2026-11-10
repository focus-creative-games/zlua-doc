---
title: HybridCLR integration
description: Unified installation, hot-update assembly loading, and XML registration before first binding.
---

# HybridCLR integration

This guide targets the unified integration package in the [Install specification](/docs/spec/11-MULTI-VERSION/). ZLua's Installer installs the HybridCLR base and ZLua overlay. The older two-package workflow does not apply here.

## Install and generate

1. Follow [Installation](/docs/getting-started/installation/) to add ZLua, configure Settings, and run `ZLua/Install...`.
2. Do not add the standalone `com.code-philosophy.hybridclr` package or overwrite the local Il2Cpp tree with another Installer.
3. Run `ZLua/Generate/All` before release: StripAOT runs once, followed by HybridCLR MethodBridge and ZLua bridge generation.
4. After changing Unity / Lua or upgrading the package, run Install → Generate again. See [Compatibility](/docs/getting-started/compatibility/).

## Load hot-update assemblies and XML

Before the first access to a hot-update type:

1. Load supplemental AOT metadata if required by the project.
2. Load the assembly with `Assembly.Load`.
3. If using XML, call `InteropMetadata.Register*Xml`.
4. Execute Lua / C# code that binds the type for the first time.

```csharp
// dllBytes comes from your resource system; paths / projectRoot are project configuration.
System.Reflection.Assembly.Load(dllBytes);
ZLua.InteropMetadata.RegisterAliasXml(aliasPaths, projectRoot);
ZLua.InteropMetadata.RegisterMarshalAsXml(marshalPaths, projectRoot);
ZLua.InteropMetadata.RegisterExtensionXml(extensionPaths, projectRoot);
// First access to hot-update types may now proceed.
```

`LuaAppDomain.Initialize` may run earlier, but code accessing hot-update types must wait for loading and registration. If XML is unnecessary, omit registration and use `[LuaAlias]` / `[LuaMarshalAs]` / `[LuaExtension]`.

## Three configuration paths

| Configuration | Scope | Applied when |
|---------------|-------|--------------|
| C# Attribute | Editable source, including hot-update types | Type binding |
| Settings XML | Precompiled / AOT assemblies known at build time | Editor initialization; Il2Cpp Generate |
| `InteropMetadata.Register*Xml` | Assemblies loaded later in Il2Cpp Player | Explicit registration after assembly loading, before first type binding |

Settings paths do not automatically register runtime metadata for DLLs loaded later. `Register*Xml` is a no-op in Editor Mono; validate hot-update behavior in Il2Cpp Player.

Registration does not update a type that already has a `MetaBinding`. There is no Reload API. `LuaAppDomain.Reset` preserves process-level XML tables and is not a way to change metadata for an already bound type. See [InteropMetadata](/docs/reference/csharp/interop-metadata/) for the contract and parameters.

## Verify and troubleshoot

| Symptom | Check |
|---------|-------|
| Install / patch fails | Mixed standalone and unified packages; rerun the current package's Installer |
| Hot-update type missing | Assembly loaded; assembly name and full type name correct |
| XML ignored | Correct Register method called in Player; registration before first binding |
| Build fails after version change | Install → Generate → rebuild |

Continue with [First Player build](/docs/getting-started/build/) and smoke-test hot-update type access, Alias, MarshalAs, and Extension in Player.
