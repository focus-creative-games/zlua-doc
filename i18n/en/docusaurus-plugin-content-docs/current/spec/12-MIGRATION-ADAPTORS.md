---
sidebar_position: 8
title: "Migration adaptors (xLua / toLua / SLua)"
---

# 12 — Migration adaptors (xLua / toLua / SLua)

> Compatibility layer for **Lua→C# type-access paths** when migrating from **xLua / toLua / SLua** to ZLua.
> This adaptor does **not** change ZLua core semantics; the authoritative type access remains `CSharp[assemblyName][typeFullName]` (see [02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/)).
> Delivery artifacts live in-package under `ZLua~/adaptors/` (this document is the contract).

---

## 1. Goals and non-goals

### 1.1 Goals

| Goal | Notes |
|------|-------|
| **Less rewrite** | Legacy scripts can keep forms like `CS.UnityEngine.GameObject` / `UnityEngine.GameObject` for type access |
| **Whitelist aligned with old frameworks** | Export lists come from the old solution’s export config / attributes, not a full-assembly scan |
| **Non-invasive to ZLua core** | Adaptor is an optional Lua module + one-shot Editor export tool; does not change `CSharp` root semantics |
| **One adaptor + three Export schemes** | Shared `adaptor.lua`; xLua / toLua / SLua each ship one `ExportTypes.cs` producing isomorphic manifests |

### 1.2 Non-goals (explicitly out of scope this phase)

| Item | Notes |
|------|-------|
| **C#→Lua** | `GetFunction` / legacy `LuaFunction` / `[CSharpCallLua]`, etc. are out of adaptor scope |
| **Member-call semantic parity** | Overloads, Event, `ref`/`out`, Marshal, etc. still follow ZLua specs; adaptor only solves **how to obtain type tables** |
| **Generic construction syntax compatibility** | e.g. xLua `CS.System.Collections.Generic.List(CS.System.Int32)` must be rewritten to `zlua.make_generic_type` (see [05-LIB.md](/docs/spec/05-LIB/)) |
| **Shipping adaptor as ZLua default globals** | Developers must explicitly `require` + `init`; not auto-installed by `zlualib.lua` |

### 1.3 Access-form comparison

Using `UnityEngine.GameObject` in `UnityEngine.CoreModule.dll` as an example:

| Scheme | Obtaining the type |
|--------|--------------------|
| **ZLua (native)** | `CSharp['UnityEngine.CoreModule']['UnityEngine.GameObject']` |
| **xLua** | `CS.UnityEngine.GameObject` |
| **toLua** | `UnityEngine.GameObject` (`BeginModule` namespace chain + type short name; **not** only a global `GameObject`) |
| **SLua** | `UnityEngine.GameObject` |

The adaptor layer **redirects** the latter three to the corresponding ZLua type tables. Differences are expressed via `top_namespace` / `export_name` in the manifest — **not** by splitting three adaptor logics.

---

## 2. Deliverables and deployment model

### 2.1 In-package authoritative sources (read-only templates)

```
Packages/com.code-philosophy.zlua/ZLua~/adaptors/
├── README.md
├── adaptor.lua               -- sole Lua adaptor implementation
├── xlua/
│   └── ExportTypes.cs        -- menu ZLua/ExportTypes (for xLua projects)
├── tolua/
│   └── ExportTypes.cs
└── slua/
    └── ExportTypes.cs
```

### 2.2 Developer-side deployment (must copy)

| File | Deployment |
|------|------------|
| `adaptors/adaptor.lua` | Copy into a business Lua source dir that the LuaLoader / moduleLoader can **`require`** |
| `adaptors/{scheme}/ExportTypes.cs` | Copy into the corresponding legacy framework project’s **Editor** directory |
| Generated `*_export_types.lua` | Place into business Lua sources after menu generation (prefer committing to VCS) |

### 2.3 Recommended entry script

```lua
local export_types = require "xlua_export_types"  -- or tolua_ / slua_
local adaptor = require "adaptor"

adaptor.init(export_types)
```

---

## 3. Export manifest format (`export_types`)

### 3.1 Sole shape

```lua
return {
  top_namespace = "CS",  -- optional; missing / "" / nil → hang on _G
  types = {
    ["UnityEngine.CoreModule"] = {
      { full_name = "UnityEngine.GameObject" },
      { full_name = "UnityEngine.Transform" },
    },
    ["Assembly-CSharp"] = {
      { full_name = "Demo.Foo" },
      { full_name = "Bar" },
      -- Nested types: write export_name only when it differs from full_name
      { full_name = "Ns.Outer+Inner", export_name = "Ns.Outer.Inner" },
    },
  },
}
```

| Field | Notes |
|-------|-------|
| `top_namespace` | **Single-segment** root table name (e.g. `"CS"`). Omit → root is `_G`. **Multi-segment forbidden** (e.g. `Foo.Bar`) |
| `types` | Assembly name → **entry array** |
| `full_name` | CLR `Type.FullName` (not AQN; nested uses `+`), used for `CSharp[asm][full_name]` |
| `export_name` | Dot path relative to the root (**without** `top_namespace` prefix). **When omitted, equals `full_name`**; write only when different (e.g. nested `+`→`.`, toLua `SetLibName` aliases) |

`export_name` is filled by each scheme’s `ExportTypes` (omit when equal); adaptor defaults to `full_name` and does **not** guess other mount rules.

### 3.2 How each scheme fills fields (ExportTypes duties)

| Scheme | `top_namespace` | Default `export_name` rule |
|--------|-----------------|----------------------------|
| **xLua** | `"CS"` | `FullName` with `+` replaced by `.` |
| **toLua** | Omit | Matches runtime registration path: with namespace → `nameSpace .. "." .. libName` (e.g. `UnityEngine.GameObject`); `SetNameSpace(null)` → `libName` only; `SetLibName` overrides `libName` |
| **SLua** | Omit | Same as xLua by default (`FullName`’s `+`→`.`); `OnAddCustomClass(t, typename)` uses that alias when `typename ~= null` (e.g. `"ListInt"`, `"String"`) |

> **toLua correction:** parts of the official README demos misleadingly suggest “global short names”; actual `LuaBinder` / `BeginModule` register by **namespace chain**. Export and adaptor must treat paths like `UnityEngine.GameObject` as authoritative.

### 3.3 Export scope (hard constraints)

| Scheme | Scan source |
|--------|-------------|
| **xLua** | Types covered by `[LuaCallCSharp]` and Gen config (`Generator.LuaCallCSharp`) |
| **toLua** | `CustomSettings.customTypeList` (`BindType`) |
| **SLua** | `[CustomLuaClass]` / custom namespaces / `OnAddCustomClass` (aligned with `LuaCodeGen.Custom`) |

**Forbidden** to default-scan all public types as the primary path.

### 3.4 MVP type scope

| Included | Not included (this phase) |
|----------|---------------------------|
| Whitelisted **non-open-generic** named types | Legacy open-generic call syntax `List(Int32)` |
| Types with no namespace (`export_name` has no `.`) | Special mounting of array types |

Open generics / FullName containing `[`: export may **skip and warn**.

### 3.5 Output paths

| Item | Spec |
|------|------|
| **Menu** | `ZLua/ExportTypes` (each of the three schemes registers its own; copy only one into a given project) |
| **Default output** | e.g. `Assets/ZLua/xlua_export_types.lua` (constant may change) |
| **Filenames** | `xlua_export_types.lua` / `tolua_export_types.lua` / `slua_export_types.lua` |

---

## 4. Adaptor behavior contract (sole `adaptor.lua`)

### 4.1 Public API

```lua
local M = {}

--- @param export_types table  -- §3.1
function M.init(export_types)
end

return M
```

### 4.2 Root table

- If `top_namespace` is a non-empty string: use that global name as root; if it already exists and is a table → **merge**; else create `{}`.
- Otherwise root is `_G`.

### 4.3 Eager vs lazy (hard constraints)

For each entry: when `export_name` is omitted, use `full_name`.

| Effective `export_name` | Strategy |
|-------------------------|----------|
| **No** `.` | At `init`, immediately `CSharp[asm][full_name]` + `rawset(root, export_name, typeTable)` |
| **Contains** `.` | `init` **only** builds intermediate namespace tables and registers pending; **forbid** pre-resolve. First leaf access via `__index` → resolve → `rawset` cache |

Identical `export_name` prefixes across assemblies must merge into **one** namespace tree.

### 4.4 Failure and conflicts

- Resolve failure → **`error`** (include asm + full_name).
- Same path pointing at different `(asm, full_name)`, or leaf colliding with a namespace → **`error`**.
- Unexported names: `__index` returns **`nil`**.

### 4.5 Idempotence

Repeated `init`: same path to same target is allowed; conflicts still error.

---

## 5. Editor export-tool contract

### 5.1 Three independent scripts

| In-package path | Target project |
|-----------------|----------------|
| `adaptors/xlua/ExportTypes.cs` | xLua |
| `adaptors/tolua/ExportTypes.cs` | toLua |
| `adaptors/slua/ExportTypes.cs` | SLua |

Must be copied into an Editor that already references the corresponding framework before use.

### 5.2 Generation steps

1. Collect types per §3.3 (and toLua/SLua alias info).
2. Write §3.1 shape (`top_namespace` / `full_name`; write `export_name` only when `export_name ≠ full_name`).
3. Write UTF-8; print path; Reveal when not batch.
4. Key / array order: stable sort by assembly name, `full_name`.

---

## 6. Usage flow

```text
1. Copy matching ExportTypes.cs → legacy project Editor
2. ZLua/ExportTypes → xxx_export_types.lua
3. Copy adaptor.lua + manifest into ZLua project Lua dirs
4. require both and adaptor.init(export_types)
```

---

## 7. Relation to other docs

| Topic | Doc |
|-------|-----|
| `CSharp` / type tables | [02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) |
| Migration guides | [guides/migration/](/docs/guides/migration/) |
| Feature comparison (non-normative) | [compare/FEATURES.md](/docs/compare/FEATURES/) |

**Conflict resolution:** **this document** wins. If guides / README demos claim toLua “global short names only,” corrections in §1.3 / §3.2 here prevail.

---

## 8. Acceptance criteria

| # | Criterion |
|---|-----------|
| 1 | One `adaptor.lua` + scheme manifest restores xLua `CS.*`, toLua/SLua namespace chains (and toLua `SetNameSpace(null)` root names) |
| 2 | `export_name` with `.` is lazy; without `.` is eager |
| 3 | Conflicts / misses raise clear `error` |
| 4 | No extra global side effects before `init` |
| 5 | ExportTypes are three independent schemes; adaptor has no scheme-switch branch table |
