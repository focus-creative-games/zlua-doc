---
sidebar_position: 0
title: "Glossary"
---

# Glossary (GLOSSARY)

> Normative terms follow this table; implementation details are in the “Where implemented” column.

## Core architecture

| Term | Meaning | Where implemented |
|------|------|----------|
| **ZLua** | C# ↔ Lua (PUC-Rio **5.1–5.5**, LuaJIT, [Luau](https://luau.org/), etc.) interop framework for Unity; Editor uses Mono, Player uses Il2Cpp | `Packages/com.code-philosophy.zlua` |
| **Lua-visible semantics** | Observable script-side behavior contract; Mono and Il2Cpp **must match** | `spec/**` |
| **Dual runtime** | `ZLua.Mono` (Editor) + `ZLua.Il2Cpp` (Player); facade `LuaAppDomain` | [spec/00-OVERVIEW.md](/docs/spec/00-OVERVIEW/) |
| **libil2cpp/zlua** | Root of Player-side native implementation | `build-win64/.../libil2cpp/zlua` |
| **GetFunction** | C#→Lua: `LuaAppDomain.GetFunction<T>` binds a Delegate by module and method name | [spec/01-HOST-API.md](/docs/spec/01-HOST-API/) |
| **MethodBridge** | Lua→C# method bridge; Il2Cpp reuses stubs by ReducedType; Mono Emits per member | `impl/codegen/` |

## Types & naming

| Term | Meaning | Where implemented |
|------|------|----------|
| **`CSharp` root table** | Global table; `__index` lazily loads assembly → type | [spec/02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) §2 |
| **Type table (typeTable)** | Static facade table from `CSharp[assembly][typeFullName]` | §3.1 |
| **`typeFullName`** | CLR full name; `.` for namespaces; `+` for nested types | §2.3 |
| **typeArg** | Arg describing a C# type in `zlua` APIs: type table / `zlua.types.*` / mscorlib string | [spec/05-LIB.md](/docs/spec/05-LIB/) §3 |
| **Facade (view)** | **Declared type** exposed by userdata; may differ from runtime concrete type | [spec/marshal/06-CLASS.md](/docs/spec/marshal/06-CLASS/) |
| **`__typeid`** | Type id for closed generics, arrays, etc. that cannot be reverse-looked up from string alone | TypeRegistry |
| **Intern** | Same `make_*_type` args return the same type table on repeated calls | TypeRegistry |

## Metatables & indexing

| Term | Meaning | Where implemented |
|------|------|----------|
| **SMT** | Static Metatable: static metatable on the type table | [spec/metatable/01-LAYOUT.md](/docs/spec/metatable/01-LAYOUT/) |
| **IMT** | Instance Metatable: metatable on instance userdata | same |
| **Three-table indexer** | Dispatch via `methodTable` / `fieldGetterTable` / `fieldSetterTable` (Mono) | [spec/metatable/02-INDEX.md](/docs/spec/metatable/02-INDEX/) |
| **Il2Cpp native indexer** | `Dispatch*` C closures + `NameMetaMap` (`MetaBinding` / `TypeRegistry`) | [impl/metatable/INDEXER-IL2CPP.md](/docs/impl/metatable/INDEXER-IL2CPP/) |
| **`__index` miss** | Unregistered member → **`error`** (`zlua: member not found: …`; no reflection fallback; no silent `nil`) | [spec/metatable/02-INDEX.md](/docs/spec/metatable/02-INDEX/) |
| **`__newindex` miss** | Unregistered / non-writable member → **`error`** | same |
| **Bind-time flattening** | Public members along the inheritance chain are written into the current type’s three tables at `EnsureBinding`; **no** runtime walk upward | [spec/02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) §5 |
| **dispatch closure** | Runtime dispatch closure bound to the default method name when multiple overloads exist | [spec/04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) |
| **direct method closure** | Bridge closure for a single overload, full-signature key, or alias | MetaBinding |
| **Full-signature key** | Auto-attached `Name(Type.FullName,…)` direct key when multiple same-name candidates exist (excludes return type) | [spec/04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §3.7 |

## Marshal shapes

| Term | Meaning | Where implemented |
|------|------|----------|
| **ByVal** | Value-type payload userdata (struct copy semantics) | [spec/marshal/05-STRUCT.md](/docs/spec/marshal/05-STRUCT/) |
| **ByObj** | Managed reference / boxed value userdata via `ObjectRegistry` | [spec/marshal/06-CLASS.md](/docs/spec/marshal/06-CLASS/) |
| **OpaqueValue** | Temporary lightuserdata without metatable (`ref`/`in`/`out` or explicit annotation) | [spec/marshal/04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/) |
| **StructHandle** | Opaque lightuserdata for struct on the default C#→Lua path (valid within the sync call chain) | same + struct booklet |
| **ReducedType** | Key for Il2Cpp bridge stub reuse by simplified signature; Mono does not reuse this way | `impl/codegen/` |
| **`ConversionKind`** | C# implicit conversion category used by overload dispatch | [spec/04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §3.6 |

## Registry & lifetime

| Term | Meaning | Where implemented |
|------|------|----------|
| **ObjectRegistry** | ByObj userdata slots + `(identity, view)` weak cache + GC root | [spec/10-LIFETIME.md](/docs/spec/10-LIFETIME/) |
| **StructRegistry** | non-blittable struct userdata copies and GC scanning (Il2Cpp: `NotBlittableStructRegistry`) | same |
| **OpaqueParameterScope** | Generation domain for opaque handles while C# calls Lua | OpaqueValueMarshal |
| **Single `lua_State`** | Host defaults to one main state; cross-thread must follow frame pump / sync rules | §10 §4 |

## Host API

| Term | Meaning | Where implemented |
|------|------|----------|
| **`GetFunction<T>`** | Formal C#→Lua entry; returns `MulticastDelegate`; caller caches it | [spec/01-HOST-API.md](/docs/spec/01-HOST-API/) |
| **`[LuaMarshalAs]`** | Marshal annotation on params / return values / fields / properties | [spec/marshal/02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/) |
| **`[LuaAlias]`** | Appends a final Lua name for a method; may collide with default/other aliases; grouped into overloads by name | [spec/04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §5 |
| **Delegate bridge** | C#→Lua call path: `GetFunction` binds a function as a closed delegate then `Invoke` | [spec/marshal/09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/) |

## Explicitly unsupported (rewrite rules)

| Term | Meaning |
|------|------|
| **Event-specific metatable** | **No** `{ get, set, fire }` subtable; use ordinary `add_EventName` / `remove_EventName` methods |
| **Runtime inheritance promotion** | Instance members are **not** looked up and cached along the chain on `__index` miss; use Bind-time flattening instead |

## Doc abbreviations

| Abbr | Path |
|------|------|
| SPEC | `Docs/spec/**` |
| IMPL | `Docs/impl/**` |
| MT | `Docs/spec/metatable/**` |
| MAR | `Docs/spec/marshal/**` |
