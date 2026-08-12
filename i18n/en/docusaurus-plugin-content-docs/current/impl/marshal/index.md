---
sidebar_position: 8
title: "Implementation — Marshal (`impl/marshal/`)"
---

# Implementation — Marshal (`impl/marshal/`)

This directory describes **Registry, MarshalMeta, and Overload** C++/C# structures and call chains. Type conversion and `[LuaMarshalAs]` rules are in [../../spec/marshal/](/docs/spec/marshal/).

| File | Contents |
|------|----------|
| [REGISTRIES.md](/docs/impl/marshal/REGISTRIES/) | `ObjectRegistry` / `StructRegistry`: slots, weak cache, ByVal GC |
| [MARSHAL-META.md](/docs/impl/marshal/MARSHAL-META/) | `MarshalMetaInfo`, `MarshalMeta::Create`, writer function pointers |
| [OVERLOAD-RESOLVER.md](/docs/impl/marshal/OVERLOAD-RESOLVER/) | `MethodGroups`, `MethodOverloadResolver`; spec: [../../spec/04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) |

**Layering:** `marshal/` must not depend on `mt/`; Mt supplies metatable refs via `MetatableHooks` (Mono) or upper-layer push (Il2Cpp).

**Bridge usage:** `MethodMarshalCtx` / `FieldMarshalCtx` are created by `MetaBinding` and shared by `bridge/*` and the indexer.

Parent index: [../IL2CPP.md](/docs/impl/IL2CPP/) §4.3, [../MONO.md](/docs/impl/MONO/)
