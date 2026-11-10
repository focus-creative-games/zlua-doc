---
sidebar_position: 0
title: Why ZLua
description: Easier, more complete, faster, less GC, smaller bridge — why choose ZLua over xLua / toLua / SLua.
---

# Why ZLua

xLua, toLua, and SLua proved that “Lua in Unity” works. ZLua targets the next layer: **make Lua↔C# truly modern, complete, and fast and lean enough on Il2Cpp**—instead of piling on more config, whitelists, and mountains of Wrap.

Detailed matrix: **[Comparison](/docs/compare/)**; migration: **[migration](/docs/guides/migration/)**.

---

## Seven reasons (30 seconds)

| | One-liner |
|--|--------|
| **Easier** | More modern design; extremely simple; **zero config** (no per-type C# Wrap whitelist) |
| **More complete** | Standard, complete C#↔Lua interop covering nearly all common C# features |
| **Faster** | Four-way Il2Cpp measurements; see [Performance](/docs/compare/PERFORMANCE/) for the report, environment, and ratios. |
| **Less GC** | Low-allocation Marshal paths; distinguish managed and Lua allocation, warm-up and steady state. See [GC boundaries](/docs/compare/GC/). |
| **Shared bridge** | C++ stubs share reduced signatures. Binary-size savings need measurement; see [Bridge analysis](/docs/compare/BRIDGE/). |
| **Broader versions** | Multiple Lua engines and maintained Unity LTS series; see the [compatibility matrix](/docs/getting-started/compatibility/) for versions, platforms, and branch limits. |
| **More active maintenance** | Full-time professional team; faster bug response and feature iteration |

---

## 1. Easier: modern, simple, zero config

Traditional schemes often burden you with:

- Maintaining `LuaCallCSharp` / export lists
- Re-Generating **huge C# Wrap** whenever APIs change
- Imperative C#→Lua via `LuaEnv` / `GetInPath` / `Call`

ZLua models interop closer to declarative **P/Invoke**:

| What you want | ZLua |
|------------|------|
| C# call Lua | `LuaAppDomain.GetFunction<T>(…)` then `Invoke` the Delegate |
| Override Marshal | `[LuaMarshalAs]` |
| Lua access C# | Lazy-loaded `CSharp` root table — **no** per-type Wrap config |

```csharp
// Must be after Initialize (e.g. Awake); do not use static field initializers
var AppAdd = LuaAppDomain.GetFunction<Func<int, int, int>>("app", "add");
// AppAdd(10, 20);
```

```lua
CSharp['AC'] = CSharp['Assembly-CSharp']
print(CSharp.AC.Demo.Add(3, 5))
```

**Zero config** means: no per-type C# Wrap whitelist or member-level Wrap project. Editor works out of the box; for Il2Cpp Player run **`ZLua/Generate/All`** once (generates **C++ stubs**, not xLua-style C# Wrap).

→ [Quick start](/docs/getting-started/quick-start/) · [Guides](/docs/getting-started/installation/)

---

## 2. More complete: almost anything callable in C# is callable

The goal is not “export a few hot-path APIs”, but **standard, complete C#↔Lua interop**, including but not limited to:

| Category | Capabilities |
|------|------|
| Types | class / struct / interface / enum / nullable |
| Members | Static and instance: fields, properties, methods |
| Advanced | Generic classes, generic methods, delegates, arrays (incl. multi-dim) |
| Language details | Method overloads, `ref` / `out` / `in`, Event (`add_` / `remove_`) |

Semantics are contracted by the [Spec](/docs/spec/00-OVERVIEW/); both ends (Mono Editor / Il2Cpp Player) have **matching Lua-visible behavior**.

→ [Compatibility matrix](/docs/getting-started/compatibility/) · [Features](/docs/compare/FEATURES/)

---

## 3. Faster: not “theoretically a bit quicker”

On **Il2Cpp Win64 Release**, four-way aligned benchmarks (public repo [zlua-benchmark](https://github.com/focus-creative-games/zlua-benchmark); notes in [PERFORMANCE](/docs/compare/PERFORMANCE/)):

See [Performance](/docs/compare/PERFORMANCE/) for the report, Unity version, sample count, ratios, and measured limits.

Root cause is direct: drop **libxlua round-trips + huge C# Wrap**, and finish marshal + `methodPointer` call once in C++.

:::tip
Even fast interop needs profiling first. If the script boundary is only 2% of frame time, 5× interop saves ~1.6%. ZLua fits **combat formulas, UI, and many small per-frame calls** as boundary hotspots.
:::

→ [Performance](/docs/compare/PERFORMANCE/)

---

## 4. Less & faster GC

Default strategy targets hot paths:

| Strategy | Meaning |
|------|------|
| **Reference types** | Default object table / userdata — avoid pointless boxing and temporary `object[]` |
| **struct** | Representation and allocation depend on fields, direction, and Marshal strategy; measure the target Player. |
| **OpaqueValue** | lightuserdata temporary handles: more flexible low-allocation strategy within a sync call chain |
| **enum** | Default integer; no forced boxed userdata |

For write-back use Opaque / ByVal userdata; bare numbers **do not write back** (aligned with C# `ref` semantics — see [ref/out/in](/docs/guides/ref-out-in/)).

→ [GC](/docs/compare/GC/) · [Lifetime Spec](/docs/spec/10-LIFETIME/)

---

## 5. Signature-shared C++ bridges

| Solution | Typical size model |
|------|----------------|
| xLua / toLua / SLua | **Per-type / per-member** Wrap; size grows roughly linearly with exported members |
| **ZLua (Il2Cpp)** | **Merge same signatures** into efficient **C++** stubs (ReducedType reuse) |

So while still accessing almost all C# types, fields, properties, and methods:

- Signature reuse reduces duplicated bridge code; binary-size ratios are not yet measured.
- Compare generated source, distinct stubs, and final Player size separately; no universal size or speed claim follows from the model.

Editor (Mono) uses Expression Emit, **not shipped in the Player package**; Player size is driven by C++ stubs.

→ [Bridge & size](/docs/compare/BRIDGE/)

---

## 6. More Unity and Lua versions

More versions means less risk of being stuck on one Lua/Unity combo. Full matrix: [Compatibility](/docs/getting-started/compatibility/).

→ [Supported versions & platforms](/docs/getting-started/compatibility/)

---

## 7. More active maintenance

ZLua is maintained by a **full-time professional team**:

- More responsive bug handling
- Faster feature and Spec iteration
- Docs, benchmarks, and in-package `Docs` evolve together

Treat Lua interop as **long-term infrastructure**, not a “stale third-party plugin”.

---

## When not to choose ZLua

Honest boundaries matter too:

| Situation | Suggestion |
|------|------|
| **Unwilling to maintain libil2cpp integration** | Plugin-shaped xLua / toLua is lighter |
| **Hard dependency on xLua Hotfix pipelines** | Keep using xLua |
| **Large xLua asset base, no short-term migration budget** | Read [Migrate from xLua](/docs/guides/migration/from-xlua/) first |

---

## Next steps

1. [Quick start](/docs/getting-started/quick-start/) + [zlua-demo](https://github.com/focus-creative-games/zlua-demo)
2. [Performance](/docs/compare/PERFORMANCE/) · [GC](/docs/compare/GC/) · [BRIDGE](/docs/compare/BRIDGE/)
3. [Features](/docs/compare/FEATURES/)
4. [Spec overview](/docs/spec/00-OVERVIEW/)

## Further reading

| Doc | Content |
|------|------|
| [Design overview](/docs/concepts/design-overview/) | GetFunction and bidirectional bridging |
| [Dual runtime](/docs/concepts/dual-runtime/) | Mono / Il2Cpp split |
| [Glossary](/docs/concepts/glossary/) | Opaque / ByVal / stub, etc. |
| [Il2Cpp impl](/docs/impl/IL2CPP/) | Player module map |
