---
sidebar_position: 12
title: "Implementation — Metatable (`impl/metatable/`)"
---

# Implementation — Metatable (`impl/metatable/`)

This directory describes **member indexing** native/managed landing points on Il2Cpp and Mono. Lua-visible semantics follow [../../spec/metatable/02-INDEX.md](/docs/spec/metatable/02-INDEX/).

| File | Runtime | Contents |
|------|---------|----------|
| [INDEXER-MONO.md](/docs/impl/metatable/INDEXER-MONO/) | Mono Editor | Lua three-table closure + `TypeMemberLuaIndexer` |
| [INDEXER-IL2CPP.md](/docs/impl/metatable/INDEXER-IL2CPP/) | Il2Cpp Player | `Dispatch*` + `NameMetaMap` (`MetaBinding` / `TypeRegistry`) |

**Hard constraint:** On every path, miss/strict, method direct-return, and getter auto-invoke behavior ≡ spec 02-INDEX.

Parent index: [../IL2CPP.md](/docs/impl/IL2CPP/), [../MONO.md](/docs/impl/MONO/)
