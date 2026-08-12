---
sidebar_position: 5
title: "vs xLua / toLua / SLua"
---

# vs xLua / toLua / SLua

> **Nature:** evaluation and analysis material — **not** a ZLua behavior Spec.
> **Coverage:** four-way comparison of xLua, toLua/tolua#, SLua, and ZLua.

## This directory

| File | Content |
|------|------|
| [FEATURES.md](/docs/compare/FEATURES/) | Feature & usage differences: type access, calls, C#→Lua, value types, hotupdate/codegen, Editor/Player, invasiveness, whitelist |
| [PERFORMANCE.md](/docs/compare/PERFORMANCE/) | Lua↔C# performance: **Il2Cpp four-way measurements** + why faster ([zlua-benchmark](https://github.com/focus-creative-games/zlua-benchmark)) |
| [GC.md](/docs/compare/GC/) | GC theory: hot-path allocation, ObjectRegistry/ByVal/Opaque, “zero GC” boundaries |
| [BRIDGE.md](/docs/compare/BRIDGE/) | Bridge performance & binary size: generation granularity, stub reuse, four-way contrast |

## Comparison targets

| Solution | Typical positioning | Maturity | Relation to ZLua |
|------|----------|--------|--------------|
| **xLua** | Hotupdate-friendly, generated Wrap + reflection fallback, mature ecosystem | Production-grade | Same “high-perf native binding” track; ZLua aims to cut libxlua / C# Wrap round-trips |
| **toLua / tolua#** | Export wrapper classes, traditional Lua framework style | Legacy, less maintained | Both require moving from “pre-generated Wrap” to ZLua lazy bind |
| **SLua** | Export + auto-bind | Legacy | Similar to toLua; config-driven export |
| **ZLua** | Dual backend Editor Mono / Player Il2Cpp; Il2Cpp embedded, signature stub reuse, C#-like semantics | **Mono and Il2Cpp both done** (see [impl/MONO.md](/docs/impl/MONO/), [impl/IL2CPP.md](/docs/impl/IL2CPP/)) | The “subject under evaluation” of this doc tree |

## ZLua current status (honest)

| Backend | Status | Notes |
|------|------|------|
| **Il2Cpp (Player)** | Done | Spec and impl follow `build-win64/.../libil2cpp/zlua`; perf comparisons should use Player |
| **Mono (Editor)** | Done | Lua-visible semantics match Il2Cpp; Expression Emit implementation |
| **Docs / ecosystem** | Building | No xLua-scale community or hotupdate kit; migration needs your own test matrix |

**ZLua numbers in perf/GC docs** mean **Il2Cpp Player**; Mono Editor does not represent ship performance.

## Reading order

1. Before choosing or migrating: read [FEATURES.md](/docs/compare/FEATURES/) for semantic and engineering differences.
2. If performance is the bottleneck: read [PERFORMANCE.md](/docs/compare/PERFORMANCE/) + [GC.md](/docs/compare/GC/), then decide whether to profile.
3. For package size / codegen volume: read [BRIDGE.md](/docs/compare/BRIDGE/).
4. For actual migration: see [guides/migration/](/docs/guides/migration/).

## Writing principles

1. **Features/usage**: comparison tables + migration impact (link [guides/migration/](/docs/guides/migration/)).
2. **Performance / GC / bridge size**: prefer **reproducible benchmarks**; unmeasured items marked **TBD**.
3. Do not dismiss other solutions’ valid niches; spell out ZLua’s trade-offs (libil2cpp invasiveness, Unity version merges, Lua version lock-in, etc.).
4. Multipliers and ns: follow the **Il2Cpp measured tables** in [PERFORMANCE.md](/docs/compare/PERFORMANCE/) (public repo [zlua-benchmark](https://github.com/focus-creative-games/zlua-benchmark)).

## Related

| Doc | Content |
|------|------|
| [spec/00-OVERVIEW.md](/docs/spec/00-OVERVIEW/) | ZLua product goals and dual runtime |
| [guides/migration/README.md](/docs/guides/migration/) | Migration Guides index |
| [guides/TESTING.md](/docs/community/testing/) | Dual-end regression testing |
| [zlua-benchmark](https://github.com/focus-creative-games/zlua-benchmark) | Reproducible perf benchmarks and latest comparison reports |

---

*Comparison docs update as ZLua evolves; on conflict, ZLua behavior follows `spec/**`.*
