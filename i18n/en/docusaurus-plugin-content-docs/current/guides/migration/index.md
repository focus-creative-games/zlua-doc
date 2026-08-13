---
sidebar_position: 4
title: "Migration guide"
---

# Migration guide

Index and shared checklist for migrating from common Unity Lua binding solutions to **ZLua**.

> **Background differences:** see [compare/FEATURES.md](/docs/compare/FEATURES/).
> **ZLua status:** Mono (Editor) and Il2Cpp (Player) are **both complete**; migration acceptance follows the [Spec](/docs/spec/00-OVERVIEW/) plus dual-end smoke tests.
> **Adaptor contract (authoritative):** [12-MIGRATION-ADAPTORS.md](/docs/spec/12-MIGRATION-ADAPTORS/).

---

## Per-solution docs

| File | Source | Contents |
|------|----------|------|
| [from-xlua.md](/docs/guides/migration/from-xlua/) | xLua | `CS.*`, Generate, `GetFunction`, **xlua adaptor** |
| [from-tolua.md](/docs/guides/migration/from-tolua/) | toLua / tolua# | Wrap, `UnityEngine.*` namespace chains, **tolua adaptor** |
| [from-slua.md](/docs/guides/migration/from-slua/) | SLua | Export config, namespace chains, **slua adaptor** |

---

## Migration adaptor layer (recommended first)

ZLua’s native type entry is `CSharp[assembly]['Full.Name']`. To reduce rewrite volume, the package ships an **optional** adaptor (`ZLua~/adaptors/`: shared `adaptor.lua` + per-solution `ExportTypes.cs`): it only solves **how Lua→C# type tables are obtained**; it does not change member call / Marshal / C#→Lua semantics.

| Solution | Old syntax (still usable after adaptor) | Actually resolves to |
|------|------------------------|----------|
| xLua | `CS.UnityEngine.GameObject` | `CSharp['UnityEngine.CoreModule']['UnityEngine.GameObject']` |
| toLua | `UnityEngine.GameObject` (namespace chain) | Same |
| SLua | `UnityEngine.GameObject` | Same |

### Enable in five steps

1. In a project that **still has the old framework**, copy `adaptors/{solution}/ExportTypes.cs` → `Editor/`
2. Menu **`ZLua/ExportTypes`** → generates `xlua_export_types.lua` (or `tolua_` / `slua_` prefix)
3. Copy the generated list + **`adaptors/adaptor.lua`** into a directory the ZLua project’s **LuaLoader can `require`**
4. Entry script:

```lua
local export_types = require "xlua_export_types"  -- 与生成文件名一致
local adaptor = require "adaptor"
adaptor.init(export_types)
```

5. Old type paths work **within the whitelist**; rewrite the rest per ZLua Spec (checklist below)

### Capability boundaries (must read)

| Does | Does not |
|----|------|
| Hang `CS.*` / `UnityEngine.*` etc. from the old export whitelist | C#→Lua (`GetFunction` etc. still need changes) |
| List from old Gen / CustomSettings / attributes | Default-scan all public types in every assembly |
| Explicit `require` + `init` | Auto-install with `zlualib` |
| — | xLua-style `List(Int32)` generic construction (use `zlua.make_generic_type`) |

The three solutions’ **ExportTypes must not be mixed** (copy only the current solution); share one `adaptor.lua`. Details: [Spec 12](/docs/spec/12-MIGRATION-ADAPTORS/).

---

## Shared migration checklist

Execute in order; each solution doc has before/after and specific pitfalls.

### 1. Environment and initialization

| Step | Notes |
|------|------|
| Add ZLua package | Replace old plugin asmdef references |
| Initialize | `LuaAppDomain.Initialize(moduleLoader)` replaces `LuaEnv` / `LuaState` / `LuaSvr`; clear after hot reload with `Reset` (**no** public `Shutdown`) |
| Module loader | Wire existing `require` paths; Player needs `.lua.txt` rules |
| Remove old native | Remove libxlua / tolua binding etc. that conflict with ZLua |
| **(Optional) adaptor** | Five steps above; without `init` there is no `CS` / `UnityEngine.*` side effect |

### 2. Type access paths

**Path A — adaptor layer (less rewrite):** keep old paths → [adaptor layer](#migration-adaptor-layer-recommended-first) / [Spec 12](/docs/spec/12-MIGRATION-ADAPTORS/).

**Path B — native ZLua:**

- Global `CS.X` / exported global classes → `CSharp[assembly]['Full.TypeName']`
- **Namespaced types must use bracket keys**
- Assembly alias (optional): `CSharp.AC = CSharp['Assembly-CSharp']`

### 3. Member calls and overloads

- `obj:Method()` syntax mostly stays
- Overload ambiguity → full-signature key `Name(Types…)` / `[LuaAlias]` / `zlua.register_method` short name
- Event → `add_Xxx` / `remove_Xxx` (no xLua-style `obj.Event = fn`)
- **Adaptor does not cover this item**

### 4. C#→Lua / Delegate

- `[CSharpCallLua]` / `LuaFunction` → `LuaAppDomain.GetFunction<T>("mod","fn")` then `Invoke`
- **Bring a Lua function back to C#:** `GetFunction<Action>`/`GetFunction<Func<…>>`; or `GetFunction<Delegate>` + `zlua.to_delegate` (see [Function and Delegate](/docs/guides/functions/))
- Lua function as C# parameter → method parameter `Action`/`Func`/delegate (implicit marshal)
- Remove xLua `DelegateBridge` manual registration (follow ZLua delegate Spec)
- **Adaptor explicitly does not cover C#→Lua**

### 5. Value types, ref, GC-sensitive paths

- struct / `ref` / `out` vs [spec/marshal/](/docs/spec/marshal/)
- C#→Lua `ref` → **OpaqueValue** (not integer)
- On hot paths avoid per-frame new string / relying on cross-frame Opaque

### 6. Retire generate / export config

- Delete XLua Generate, toLua `CustomSettings`, SLua export lists (**no longer access-control whitelists**)
- Sensitive APIs become **non-public** rather than whitelist-gated
- Il2Cpp: ensure test and game assemblies go through ZLua Codegen (Lua→C# stubs)
- Adaptor `*_export_types.lua` is **not** a new whitelist control—only migration-time type-path compatibility; long-term migrate to native `CSharp` and drop the adaptor

### 7. Testing and regression

- Build `Tests/Lua` cases per [TESTING.md](/docs/community/testing/)
- **Editor + Il2Cpp Player** both green
- Check [compare/PERFORMANCE.md](/docs/compare/PERFORMANCE/) for performance expectations
- If using adaptor: spot-check that old paths and `CSharp[asm][full]` point at the same type table

---

## Migration strategy tips

| Strategy | Fits |
|------|------|
| **Adaptor first, then close out** | Large projects; stabilize type access with `adaptor.init`, then per-module switch to `CSharp` / unload adaptor |
| **Module slicing** | Migrate pure Lua modules first, then close paths per assembly |
| **Dual-track parallel** | Cannot go all-in short-term; separate branch + scene isolation (eliminate dual plugins long-term) |
| **Test-driven** | Write `tc_*.lua` for critical old-script APIs; green one, migrate one |

---

## When not to migrate

- Project heavily depends on xLua hot-update toolchain with no replacement
- Team cannot maintain libil2cpp merge
- Interop is not a performance bottleneck and toLua/SLua has been stable for years

---

## Related

| Doc | Contents |
|------|------|
| [spec/12-MIGRATION-ADAPTORS.md](/docs/spec/12-MIGRATION-ADAPTORS/) | Adaptor contract (Spec wins on conflict with this page) |
| [compare/](/docs/compare/) | Four-way comparison index |
| [spec/02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) | ZLua type Spec |
| [CONTRIBUTING.md](/docs/community/contributing/) | Contributing and path rules |
