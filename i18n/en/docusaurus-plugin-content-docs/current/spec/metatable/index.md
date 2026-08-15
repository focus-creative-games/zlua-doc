---
sidebar_position: 22
title: "Metatable Spec (`spec/metatable/`)"
---

# Metatable Spec (`spec/metatable/`)

This directory defines the Lua-visible layout of ZLua **type tables**, **static metatables (SMT)**, and **instance metatables (IMT)**, plus **`__index` / `__newindex`** member-dispatch semantics. Content is **normative**: Mono and Il2Cpp runtimes must behave the same; concrete implementations (Mono three-table Lua indexer, Il2Cpp native `Dispatch*`, etc.) live under `impl/metatable/`.

## Document index

| File | Content |
|------|------|
| [01-LAYOUT.md](/docs/spec/metatable/01-LAYOUT/) | SMT / IMT, ByVal·ByObj dual instance metatables, type-table keys (`LuaConsts.h`) |
| [02-INDEX.md](/docs/spec/metatable/02-INDEX/) | `__index` / `__newindex` algorithm, three-table roles, miss semantics |
| [03-BINDING.md](/docs/spec/metatable/03-BINDING/) | public visibility, Bind-time inheritance flattening, member classification |
| [04-SPECIAL-TYPES.md](/docs/spec/metatable/04-SPECIAL-TYPES/) | enum, Nullable, struct, array, delegate special cases |

## Boundaries with other specs

- Type naming, `CSharp` paths, generic/array type entry points → [../02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/)
- C# ↔ Lua value shapes and Push/Pop → [../marshal/](/docs/spec/marshal/)
- Method overload dispatch, `register_method` → [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/)
- **Event: no dedicated metatable subtable**; scripts use ordinary methods `add_EventName` / `remove_EventName` (see [03-BINDING.md](/docs/spec/metatable/03-BINDING/))

## Core semantics (quick view)

- Static and instance each have a **three-table** set (method / fieldGetter / fieldSetter), held by the indexer closure.
- **`__index` / `__newindex` miss → error`** (`zlua:` messages including the key name); no C# reflection fallback.
- Inheritance is **flattened into the three tables at EnsureBinding**; runtime does not walk the chain.
- structs provide both **`__byval_instance_mt`** and **`__byobj_instance_mt`**; reference types are ByObj only.
