---
sidebar_position: 17
title: "Marshal Spec (`spec/marshal/`)"
---

# Marshal Spec (`spec/marshal/`)

> **Normative:** C# ↔ Lua value shapes on the stack and conversion rules.
> **Implementation:** → [../../impl/marshal/](/docs/impl/marshal/).

## This directory

| File | Contents |
|------|----------|
| [01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/) | Default marshal matrix, integer/number, array summary, reference façade summary |
| [02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/) | `[LuaMarshalAs]`, `LuaMarshalType` (incl. **`ActualTypeUserData`**), legal sets, Table/Unpacked/Params/Bytes/UserData/Opaque, **XML external config** |
| [03-BYREF.md](/docs/spec/marshal/03-BYREF/) | `ref` / `in` / `out` (C#→Lua Opaque; Lua→C#: Opaque/ByVal pass address; otherwise temp slots) |
| [04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/) | OpaqueValue, `get_opaquevalue` / `set_opaquevalue`, lifetime, pass-back split |
| [05-STRUCT.md](/docs/spec/marshal/05-STRUCT/) | struct ByVal / ByObj / Handle, `box`/`unbox` |
| [06-CLASS.md](/docs/spec/marshal/06-CLASS/) | class / interface / declared-type façade |
| [07-ARRAY.md](/docs/spec/marshal/07-ARRAY/) | szarray / mdarray / `Bytes` |
| [08-ENUM.md](/docs/spec/marshal/08-ENUM/) | Default integer + `zlua.box` |
| [09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/) | Delegate ↔ Lua function |
| [10-POINTER.md](/docs/spec/marshal/10-POINTER/) | `T*`, function pointers, unsupported types |

## Reading order

1. **[01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/)** — default behavior overview
2. **[02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/)** — when to override defaults; how to configure Table/Unpacked/Params
3. **By type:** [05-STRUCT](/docs/spec/marshal/05-STRUCT/) / [06-CLASS](/docs/spec/marshal/06-CLASS/) / [07-ARRAY](/docs/spec/marshal/07-ARRAY/) / [08-ENUM](/docs/spec/marshal/08-ENUM/) / [09-FUNCTION](/docs/spec/marshal/09-FUNCTION/)
4. **Bidirectional byref fork:** Lua→C# → [03-BYREF.md](/docs/spec/marshal/03-BYREF/); C#→Lua → [04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/)

## Cross-references

| Topic | Other specs |
|-------|-------------|
| `CSharp` type tables, construction entry | [../02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) |
| Overloads and argument matching | [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) |
| `zlua.box` / `unbox` / `cast` / `inflate` / GTAP / `get_opaquevalue` / `set_opaquevalue` | [../05-LIB.md](/docs/spec/05-LIB/) |
| Metatables and member indexing (not Marshal) | [../metatable/](/docs/spec/metatable/) |

## Platform principles

- **Mono (Editor) and Il2Cpp (Player) share the same Lua-visible Marshal semantics**; differences exist only in `impl/`.
- **No Event-specific support**; use ordinary `add_*` / `remove_*` methods (see [../../README.md](/docs/intro/)).
