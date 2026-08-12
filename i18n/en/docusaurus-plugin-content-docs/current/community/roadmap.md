---
mdx:
  format: md
sidebar_position: 1
title: Roadmap
description: ZLua version plans and feature checklist.
---

# Development plan

## Runtime implementation status

| Runtime | Environment | Status |
|--------|------|------|
| **Il2Cpp** | Player shipping | **Done** |
| **Mono** | Unity Editor | **Done** |

Authoritative notes: [Project status](/docs/getting-started/project-status/), [Mono impl](/docs/impl/MONO/), [Il2Cpp impl](/docs/impl/IL2CPP/). Supported Unity / Lua versions: [Compatibility](/docs/getting-started/compatibility/).

---

## Il2Cpp (Player)

- [x] Embedded Lua + C++ direct bridge
- [x] ReducedType stub reuse (`ZLua/Generate/All`)
- [x] `GetFunction` Delegate bridge
- [x] Lazy bind, `CSharp` root table, overloads, Marshal paths
- [x] Perf measurements vs xLua / toLua / SLua (see [PERFORMANCE](/docs/compare/PERFORMANCE/), [zlua-benchmark](https://github.com/focus-creative-games/zlua-benchmark))
- [ ] Multi-platform toolchains and more device measurements

## Mono (Editor)

- [x] Directories and modules aligned with Il2Cpp
- [x] Expression Emit bridges, three-table indexer
- [x] `GetFunction` + Delegate bridge
- [x] Lua-visible semantics match Il2Cpp

## Semantics & docs

- [x] This repo’s `docs/spec` normative contract (sole semantic standard)
- [x] `docs/impl` / `docs/compare` impl notes and Comparison
- [ ] Ongoing sync/correction of user Guides and reference
- [ ] Fill comparison gaps: toLua / SLua / Delegate / GC Alloc, etc.

## Later version directions

- Luau
- More platform toolchains and device measurements
- Migration Guides and case studies ([migration](/docs/guides/migration/))

## Related

- [Compatibility matrix](/docs/getting-started/compatibility/)
- [Contributing](/docs/community/contributing/)
- [Testing framework](/docs/community/testing/)
