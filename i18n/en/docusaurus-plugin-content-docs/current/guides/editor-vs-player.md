---
sidebar_position: 91
title: Editor vs Player
description: Differences between Mono Editor and Il2Cpp Player dual runtimes (appendix).
---

# Editor vs Player

Appendix. For the release checklist, see also [Build workflow](/docs/guides/build/). ZLua has two backends: **Lua-visible semantics must match**; implementation paths differ.

| | Editor (Mono) | Player (Il2Cpp) |
|---|---------------|-----------------|
| **Status** | **Complete** | **Complete** |
| Implementation | Expression Emit + three-table indexer | C++ stub + native indexer |
| C#→Lua | `GetFunction<T>` + Delegate bridge | Same as left |
| Performance | Day-to-day iteration | Benchmark against Player (see [Performance comparison](/docs/compare/PERFORMANCE/)) |
| Generate | No per-type C# Wrap; Editor does not need Generate | **`ZLua/Generate/All`** (C++ stubs, not C# Wrap) |

See [Mono implementation](/docs/impl/MONO/), [Il2Cpp implementation](/docs/impl/IL2CPP/), and [Project status](/docs/getting-started/project-status/).

:::info Semantics match
Event, Marshal, type access, etc. follow the [Spec](/docs/spec/00-OVERVIEW/); neither side has Event-specific metatables (use `add_` / `remove_`).
:::

## Player release checklist

- [ ] Run **`ZLua/Generate/All`**
- [ ] Lua synced to StreamingAssets (see [zlua-demo](https://github.com/focus-creative-games/zlua-demo))
- [ ] Script behavior matches the [Spec](/docs/spec/00-OVERVIEW/) (do not rely on deprecated Event `.get` / `.set`)
- [ ] Smoke-test against the [compatibility matrix](/docs/getting-started/compatibility/)

## Learning path

| | |
|---|---|
| **Previous** | [Troubleshooting](/docs/guides/troubleshooting/) |
| **Next** | — |

## Related

- [Build workflow](/docs/guides/build/)
- [Third-party native modules](/docs/guides/native-modules/) — Editor dynamic / Player static differences also apply to C modules
- [Dual runtime](/docs/concepts/dual-runtime/)
- [Comparison](/docs/compare/)
- [Troubleshooting](/docs/guides/troubleshooting/)
