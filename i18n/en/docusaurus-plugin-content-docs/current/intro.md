---
sidebar_position: 1
slug: /intro
title: Introduction
description: What ZLua is, its core features, and when to use it.
---

# Introduction

**ZLua** is a modern native Lua solution **highly optimized** for Unity Il2Cpp.

It unifies bidirectional C# ↔ Lua calls with clear rules, treating Lua as another form of **Native**—analogous to P/Invoke—with concepts such as `LuaAppDomain.GetFunction` and `[LuaMarshalAs]`, while hiding the error-prone Lua C API.

## Why choose ZLua

Compared with xLua / toLua / SLua, ZLua’s core claims are:

| | |
|--|--|
| **Easier** | Modern, simple, **zero config** (no per-type C# Wrap whitelist) |
| **More complete** | Covers nearly all common C#↔Lua features (generics, overloads, ref/out, arrays, delegates…) |
| **Faster** | Four-way Il2Cpp measurements; see [Performance](/docs/compare/PERFORMANCE/) for the report, environment, and ratios. |
| **Less GC** | Low-allocation Marshal paths; distinguish managed and Lua allocation, warm-up and steady state. See [GC boundaries](/docs/compare/GC/). |
| **Shared bridge** | C++ stubs share reduced signatures. Binary-size savings need measurement; see [Bridge analysis](/docs/compare/BRIDGE/). |
| **Broader versions** | Multiple Lua engines and maintained Unity LTS series; see the [compatibility matrix](/docs/getting-started/compatibility/) for versions, platforms, and branch limits. |
| **Native HybridCLR support** | Works with HybridCLR **v9.0.0+** out of the box; seamless interop with hot-update code |
| **HybridCLR hot update** | Unified installation and runtime metadata registration; see [HybridCLR integration](/docs/guides/hybridclr/). |
| **More active maintenance** | Full-time professional team |

Full rationale: **[Why ZLua](/docs/concepts/why-zlua/)**; four-way comparison: **[Comparison](/docs/compare/)**.

## Core features

| Capability | Notes |
|------|------|
| Lua → C# | Lazy-loaded `CSharp` root table; fields/methods/properties; generics and arrays; overloads; `add_`/`remove_` for events |
| C# → Lua | `LuaAppDomain.GetFunction<T>` then `Invoke` the Delegate |
| Dual runtime | **Mono (Editor) and Il2Cpp (Player) both done**; same semantics, different implementation paths |
| Marshal | ByVal / ByObj / Opaque and more; see [Marshal Spec](/docs/spec/marshal/) |

:::info Current status
<span class="runtimeBadge"><span class="runtimeBadgeMono">Mono · Done</span><span class="runtimeBadgeIl2cpp">Il2Cpp · Done</span></span>

Develop day-to-day in the **Editor (Mono)**; ship and measure performance on the **Il2Cpp Player** (run `ZLua/Generate/All` before building). See [Project status](/docs/getting-started/project-status/).
:::

## Next steps

- [Quick start](/docs/getting-started/quick-start/) — minimal working example
- [Why ZLua](/docs/concepts/why-zlua/) — why pick ZLua
- [Installation](/docs/getting-started/installation/) — UPM install and project layout
- [Guides](/docs/getting-started/installation/) — progressive tutorials (install → interop → build → …)
- [HybridCLR integration](/docs/guides/hybridclr/) — dual-package install order and hot-update constraints
- [Comparison](/docs/compare/) — vs xLua / toLua / SLua
- [Performance benchmarks](https://github.com/focus-creative-games/zlua-benchmark) — reproducible Il2Cpp comparison and [latest report](https://github.com/focus-creative-games/zlua-benchmark/blob/main/reports/comparison_20260728_121554.md)
- [Spec overview](/docs/spec/00-OVERVIEW/) — authoritative semantic contract
