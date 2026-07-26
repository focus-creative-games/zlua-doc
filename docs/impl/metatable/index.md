---
sidebar_position: 12
title: "实现 — 元表（`impl/metatable/`）"
---

# 实现 — 元表（`impl/metatable/`）

本目录描述 **成员索引** 在 Il2Cpp 与 Mono 上的 native/managed 落点。Lua 可见语义以 [../../spec/metatable/02-INDEX.md](/docs/spec/metatable/02-INDEX/) 为准。

| 文件 | 运行时 | 内容 |
|------|--------|------|
| [INDEXER-MONO.md](/docs/impl/metatable/INDEXER-MONO/) | Mono Editor | Lua 三表 closure + `TypeMemberLuaIndexer` |
| [INDEXER-IL2CPP.md](/docs/impl/metatable/INDEXER-IL2CPP/) | Il2Cpp Player | `Dispatch*` + `NameMetaMap`（`MetaBinding` / `TypeRegistry`） |

**硬性约束：** 任意路径的 miss/strict、method 直返、getter 自动 invoke 行为 ≡ spec 02-INDEX。

上级索引：[../IL2CPP.md](/docs/impl/IL2CPP/)、[../MONO.md](/docs/impl/MONO/)
