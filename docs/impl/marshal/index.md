---
sidebar_position: 8
title: "实现 — Marshal（`impl/marshal/`）"
---

# 实现 — Marshal（`impl/marshal/`）

本目录描述 **Registry、MarshalMeta、Overload** 的 C++/C# 结构与调用链。类型转换与 `[LuaMarshalAs]` 规则见 [../../spec/marshal/](/docs/spec/marshal/)。

| 文件 | 内容 |
|------|------|
| [REGISTRIES.md](/docs/impl/marshal/REGISTRIES/) | `ObjectRegistry` / `StructRegistry`：槽位、弱缓存、ByVal GC |
| [MARSHAL-META.md](/docs/impl/marshal/MARSHAL-META/) | `MarshalMetaInfo`、`MarshalMeta::Create`、writer 函数指针 |
| [OVERLOAD-RESOLVER.md](/docs/impl/marshal/OVERLOAD-RESOLVER/) | `MethodGroups`、`MethodOverloadResolver`；规范见 [../../spec/04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) |

**分层：** `marshal/` 不依赖 `mt/`；Mt 通过 `MetatableHooks`（Mono）或上层 push 传入 metatable ref（Il2Cpp）。

**Bridge 使用：** `MethodMarshalCtx` / `FieldMarshalCtx` 由 `MetaBinding` 创建，供 `bridge/*` 与 indexer 共用。

上级索引：[../IL2CPP.md](/docs/impl/IL2CPP/) §4.3、[../MONO.md](/docs/impl/MONO/)
