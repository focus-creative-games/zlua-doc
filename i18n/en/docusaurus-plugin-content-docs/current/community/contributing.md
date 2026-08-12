---
sidebar_position: 2
title: "Contributing"
---

# Docs & implementation contribution conventions

> Authoritative order, change process, and path rules when contributing to ZLua docs, Spec, and code.

---

## 1. Authority order (conflict resolution)

When docs and implementation conflict, resolve in this order:

```
① docs/spec/**      ← normative contract (highest; sole semantic standard in this repo)
② Il2Cpp source zlua/** ← implementation truth (Il2Cpp done; align Spec or impl on conflict)
③ docs/impl/**      ← implementation notes (do not change Lua-visible semantics)
④ docs/guides/** etc. ← user Guides / community migration & contributing
⑤ docs/compare/**   ← comparison with other solutions (not a behavior contract)
```

Root notes: [README.md](/docs/intro/).

---

## 2. Change Spec or impl?

| Change type | Change first | Then |
|----------|----------|----------|
| **Lua-visible behavior** (API, error semantics, nil/error) | `spec/**` | Il2Cpp `zlua/**` + Mono `Runtime/Mono/**` + `Tests/Lua/**` |
| **Implementation strategy only** (Emit details, module split) | `impl/**` | Code; do **not** change Spec |
| **Perf / comparison / migration** | `docs/compare/**` or `docs/guides/**` / `docs/community/**` | No Spec change needed |
| **Terminology alignment** | `concepts/glossary.md` | Cross-refs in related Spec |

**Forbidden:** long-term drift where Spec and Player behavior diverge because only one side was updated.

### 2.1 Recommended PR flow

1. In `spec/`, write clear behavior / error semantics / **test case ids** (see [TESTING.md](/docs/community/testing/)).
2. Implement Il2Cpp + Mono (both ends must satisfy Spec; signatures that cannot Emit fail at bind time — no hot-path `Method.Invoke`).
3. Add or update `Tests/Lua/cases/**/tc_*.lua` and `manifest.lua`.
4. If implementation details need explanation, add `impl/` booklets.
5. When comparison or migration impact is large, update `compare/` or `community/migration/`.

---

## 3. Code path rules

### 3.1 Il2Cpp (Player source of truth)

| Allowed edits | Forbidden (unless explicitly requested) |
|----------|------------------------|
| `build-win64/Il2CppOutputProject/IL2CPP/libil2cpp/zlua/**` | `Packages/com.code-philosophy.zlua/ZLua~/libil2cpp-2022/**` |
| `libil2cpp/lua/**` when needed | In-package dirs are **manually synced copies** |

Authoritative reference: [README.md](/docs/intro/) dual-end consistency table.

### 3.2 Mono (Editor)

| Path | Notes |
|------|------|
| `Packages/com.code-philosophy.zlua/Runtime/Mono/**` | Editor impl; see [impl/MONO.md](/docs/impl/MONO/) |
| `_archive/Mono-pre-rewrite-*` | Read-only reference; **not** compiled |

**Hard Mono rules (summary):**

- Three-table Lua indexer (see [impl/metatable/INDEXER-MONO.md](/docs/impl/metatable/INDEXER-MONO/)).
- Signatures that cannot Expression Emit → **explicit bind-time error**; no hot-path `Method.Invoke`.
- No Event-specific support; `add_` / `remove_` as ordinary methods.

### 3.3 Lua tests

| Allowed | Forbidden |
|------|------|
| `Tests/Lua/**` | Manually editing `Assets/StreamingAssets/Tests/**` |

`SyncTestsLuaToStreamingAssets` syncs automatically at build time.

---

## 4. Doc writing conventions

1. Prefer **Simplified Chinese** as primary (aligned with Spec).
2. Use **relative links** to `spec/`, `impl/`, `compare/`.
3. Spec clauses should carry **test case ids** when possible.
4. Keep `compare/**` honest — no marketing copy.

Boundary conventions: [README.md](/docs/intro/) § boundary conventions.

---

## 5. Il2Cpp coding conventions (summary)

| Rule | Notes |
|------|------|
| Don’t eagerly `#include "il2cpp-api-types.h"` | Transitive via project headers |
| `Il2CppClass*` / `MethodInfo*` etc. | Default **non-null**; don’t sprinkle nullptr branches |
| Details | Il2Cpp-related rules under repo `.cursor/rules/` |

---

## 6. Dual-end consistency acceptance

| Check | Requirement |
|------|------|
| Editor Play | `TestScene` manifest all green |
| Il2Cpp Player | Same manifest all green |
| Semantics | Mono and Il2Cpp Lua-visible behavior **must match** |

Dual-end semantics follow Spec; implementation paths: [impl/MONO.md](/docs/impl/MONO/) / [impl/IL2CPP.md](/docs/impl/IL2CPP/).

---

## Related

| Doc | Content |
|------|------|
| [TESTING.md](/docs/community/testing/) | Testing and clause mapping |
| [migration/README.md](/docs/guides/migration/) | Migration Guides |
| [spec/00-OVERVIEW.md](/docs/spec/00-OVERVIEW/) | Product overview |
