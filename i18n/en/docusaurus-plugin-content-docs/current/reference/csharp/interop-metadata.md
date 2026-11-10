---
title: InteropMetadata
description: Runtime XML registration for assemblies loaded in Il2Cpp Player.
---

# InteropMetadata

`InteropMetadata` registers Alias / MarshalAs / Extension XML for assemblies loaded later in **Il2Cpp Player**. The [Host API specification](/docs/spec/01-HOST-API/#interop-metadata) owns the behavior contract.

## Calls

```csharp
ZLua.InteropMetadata.RegisterAliasXml(paths, projectRoot);
ZLua.InteropMetadata.RegisterMarshalAsXml(paths, projectRoot);
ZLua.InteropMetadata.RegisterExtensionXml(paths, projectRoot);
```

| Argument | Meaning |
|----------|---------|
| `paths` | XML paths for the selected rule kind; use that kind's schema |
| `projectRoot` | Project root used to resolve project-relative paths |

Register only the rule kinds your project uses. XML schemas: [Alias](/docs/spec/04-METHOD-OVERLOAD/), [MarshalAs](/docs/spec/marshal/02-MARSHAL-AS/), [Extension](/docs/spec/13-EXTENSION-METHODS/).

## Ordering and lifetime

1. Load the assembly with `Assembly.Load`.
2. Call the required Register methods.
3. First access / bind the type.

Already bound types are not updated. There is no Reload API. `LuaAppDomain.Reset` preserves process-level XML tables. Editor Mono methods are no-ops; verify this workflow in Player. Settings XML remains the build-time path for precompiled / AOT assemblies, not an automatic loader for later DLLs.

See [HybridCLR integration](/docs/guides/hybridclr/) for an end-to-end example.
