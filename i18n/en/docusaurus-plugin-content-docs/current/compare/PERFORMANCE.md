---
sidebar_position: 4
title: "Performance comparison"
---

# Lua ↔ C# interop performance comparison

Formal conclusions cite **Il2Cpp Player** only (Mono Editor does not represent ship performance).

**Benchmark project:** [focus-creative-games/zlua-benchmark](https://github.com/focus-creative-games/zlua-benchmark) (ZLua / xLua / toLua / SLua four-way alignment).
**Latest report:** [comparison_20260728_121554.md](https://github.com/focus-creative-games/zlua-benchmark/blob/main/reports/comparison_20260728_121554.md)

| Item | Value |
|----|-----|
| Unity | **2022.3.62f3** · Il2Cpp · C++ Release · Win64 |
| Stats | After warmup, 5 rounds **mid ns/op**; **ratio = other / ZLua** (>1 means slower than ZLua) |
| Scope | cs2lua 54 + lua2cs 231; no steady-state Delegate; GC Alloc not measured (see [GC](/docs/compare/GC/)) |

Reproduce: `run_benchmark.ps1` in the repo README (or `-CompareOnly`).

---

## Measured summary

Average ratio vs ZLua:

| Direction | cases | xLua | toLua | SLua |
|------|------:|-----:|------:|-----:|
| **Lua→C#** | 231 | **2.57×** | **3.52×** | **7.68×** |
| **C#→Lua** | 54 | **1.59×** | **3.27×** | **14.9×** |

Vs xLua: ~**98.6%** of cases ahead (281/285). Per-case details in the full report.

### Representative cases (ns/call mid)

| Scenario | case_id | ZLua | xLua | ratio |
|------|---------|-----:|-----:|------:|
| No-arg method | `lua2cs.instance.method.0arg.void` | 21.57 | 58.64 | **2.72** |
| prop get int | `lua2cs.instance.prop.get.int` | 21.67 | 79.03 | **3.65** |
| field get int | `lua2cs.instance.field.get.int` | 21.32 | 75.23 | **3.53** |
| field set Vector3 | `lua2cs.instance.field.set.Vector3` | 22.80 | 90.90 | **3.99** |
| C#→Lua class | `cs2lua.class.3arg.ret` | 94.00 | 461.00 | **4.90** |
| C#→Lua int[] | `cs2lua.int[].3arg.ret` | 92.00 | 601.00 | **6.53** |

toLua / SLua same-case numbers are in the report.

**Reading tip:** even if interop is several times faster, if the boundary is only a small share of frame time, whole-frame gains are limited — profile first. When `string` / heavy objects dominate marshal, gaps shrink.

---

## Why faster

Typical hot paths in xLua / toLua / SLua go through **C# Wrap + multiple Lua binding / P/Invoke layers (e.g. LuaDLL)** before the target method; each stack read/write crosses the boundary several times.

ZLua Player finishes once in **C++ linked with lua**: read stack → marshal → `methodPointer` (or field offset) → write stack — **no** per-type C# Wrap, and no repeated native↔managed round-trips.

| Root cause | Effect |
|------|------|
| No libxlua / multi-layer P/Invoke | Stack ops no longer cross the boundary every time |
| No generated C# Wrap (Lua→C#) | C++ direct bridge + `methodPointer` |
| C#→Lua via cached Delegate, one bridge | Not a C# loop calling LuaDLL |
| Field / no-arg property fast path | Il2Cpp offset direct read |

So lightweight `int` / field cases lead more clearly; heavy marshal converges — matching measurements. Bridge size and stub reuse: [BRIDGE](/docs/compare/BRIDGE/).

---

## Related

| Doc | Content |
|------|------|
| [zlua-benchmark](https://github.com/focus-creative-games/zlua-benchmark) | Reproducible benchmarks and latest reports |
| [GC.md](/docs/compare/GC/) | Allocation and “zero GC” boundaries |
| [BRIDGE.md](/docs/compare/BRIDGE/) | Stub size and indirection |
| [FEATURES.md](/docs/compare/FEATURES/) | Feature differences |
