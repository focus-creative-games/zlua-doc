---
sidebar_position: 20
title: "Member binding (bind-time rules)"
---

# 03 — Member binding (bind-time rules)

This document specifies how the **`EnsureBinding`** phase scans, classifies, and writes C# type members into the static/instance three tables (`methodTable`, `fieldGetterTable`, `fieldSetterTable`). After binding completes, runtime index behavior is fully defined by [02-INDEX.md](/docs/spec/metatable/02-INDEX/); this document does not cover how native code generates bridge closures (see `impl/metatable/`, `impl/codegen/`).

**Related docs:** three-table roles → [02-INDEX.md](/docs/spec/metatable/02-INDEX/); metatable layout → [01-LAYOUT.md](/docs/spec/metatable/01-LAYOUT/); method overloads → [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/); C# extensions → [../13-EXTENSION-METHODS.md](/docs/spec/13-EXTENSION-METHODS/).

---

## 1. Visibility

Only **`public`** members are visible to Lua and enter the binding tables. `internal`, `protected`, `private`, and explicit interface implementations (unless a dedicated spec says otherwise) are **not registered**.

Constructors, `_default`, `SMT.__call`, array `__len`, delegate `__call`, and similar items **do not enter the three tables**; they hang separately on SMT / IMT / the type table per [01-LAYOUT.md](/docs/spec/metatable/01-LAYOUT/) and [04-SPECIAL-TYPES.md](/docs/spec/metatable/04-SPECIAL-TYPES/).

---

## 2. Static / instance isolation

Each `TypeBinding` maintains:

- One **static** three-table set (on the SMT indexer)
- One **instance** three-table set (on the ByObj IMT indexer; structs also get a **ByVal** set with the same member names but closures that resolve `this` as ByVal)

Static members are written **only** into the static three tables; instance members **only** into the instance three tables. **Sharing or mixing upvalues is forbidden.** Scripts must not access static members through an instance userdata's `__index`.

---

## 3. Member classification

At Bind time, each public member is written into a **unique** target table (or into both getter and setter tables as a pair) under the following rules.

### 3.1 Methods

| C# member | Target table | Value |
|-----------|--------------|-------|
| Instance / static methods | `methodTable` | Single overload: direct bridge closure; **same-name multiple overloads**: default name → dispatch closure, plus a full-signature direct key **`MethodName(ParamTypeFullNames…)`** for each candidate (see [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §3.7) |
| **C# extensions** (configured as visible) | **instance** `methodTable` | CLR marks them `static`, but they are written as **static-as-instance** into the IMT (structs include ByVal/ByObj); same-name real instance methods **compete/merge**. See [../13-EXTENSION-METHODS.md](/docs/spec/13-EXTENSION-METHODS/) |
| Indexer properties | `methodTable` | `get_Item` / `set_Item` or equivalent dispatch closure |
| C# **events** | `methodTable` | **`add_EventName` / `remove_EventName`** method closures; **do not** create an event subtable |
| Generic methods | `methodTable` | By default only full-signature keys; a single generic overload may also occupy the default method name |

Parameterized properties **must not** enter `fieldGetterTable` / `fieldSetterTable`; Lua can only access them via `obj:get_PropName(args)` / `obj:set_PropName(args, value)` or indexer method names (see [../02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) §properties).

Array element read/write is registered uniformly as instance methods **`get` / `set`** (not `get_Item` naming); see [04-SPECIAL-TYPES.md](/docs/spec/metatable/04-SPECIAL-TYPES/).

### 3.2 Fields

| Accessibility | `fieldGetterTable` | `fieldSetterTable` |
|---------------|--------------------|--------------------|
| Readable instance / static field | ✅ getter closure | ✅ setter if writable |
| `readonly` / init-only | ✅ getter | ❌ |
| Compile-time constants only (enum literals, etc.) | optional: write integer directly on type table `T` | ❌ |

Public static enum literals are preferably written **directly onto type table `T`** as the underlying **integer** (prefer Lua 5.4+ `integer`); **do not** create userdata getters for constants.

### 3.3 Parameterless properties

| Property shape | `fieldGetterTable` | `fieldSetterTable` |
|----------------|--------------------|--------------------|
| Readable and writable | ✅ if getter present | ✅ if setter present |
| Read-only | ✅ getter | ❌ |
| Write-only | ❌ | ✅ setter |

Read-only property: `__newindex` errors after a setter-table miss. Write-only property: when `__index` misses both method and getter tables but hits the setter table, raise `zlua: property has no getter: {key}`.

### 3.4 Constructors

Public instance constructors **do not** enter any of the three tables. Binding only collects `.ctor` overloads declared on the current type and configures **`SMT.__call`** dispatch (**does not** merge base-class constructors along the inheritance chain). If there is no public constructor, `Type(...)` errors; structs also provide `SMT._default` (parameterless; see [04-SPECIAL-TYPES.md](/docs/spec/metatable/04-SPECIAL-TYPES/)).

---

## 4. Inheritance: Bind-time flattening

At runtime, **`__index` / `__newindex` do not** walk up the inheritance chain. To match C# (“inherited members are reachable via the derived type name”), **EnsureBinding** must **pre-merge** base public members into the derived type's three tables.

### 4.1 Static members

Collect public static fields / properties / methods from base toward derived, and write them into the derived type's **static three tables**. Same-name members declared on the derived type **override** base entries (including `new static` hide). Runtime `SMT.__index` is only an O(1) lookup of the derived static three tables plus SMT fallback.

### 4.2 Instance members

Collect public instance fields / properties / methods along the base chain and write them into the derived type's **instance three tables** (ByObj; for structs, also the ByVal three tables). Subclass override / new same-name members **override** base entries. Virtual methods still go through generated bridges to CLR virtual dispatch; flattening only affects **Lua key → closure** lookup, not virtual-call semantics.

### 4.3 Items that do not participate in inheritance

- **Constructors:** only public instance constructors declared on the current type.
- **Enums:** no inheritance; do not flatten members from other types.
- **Structs:** value types have no instance inheritance; static members are not merged upward from bases (C# value-type scenarios typically have no derived static inheritance).

### 4.4 No runtime promotion

**The spec uses pure Bind-time flattening:** after first bind, all inherited members are already in the current type's three tables; a runtime miss is **error**. **Do not** walk the inheritance chain on `__index` miss and write results back (promotion). Both Mono and Il2Cpp must follow this ruling.

---

## 5. Struct ByVal / ByObj dual binding

For **structs** that are neither enums nor Nullable:

1. Scan instance members; generate **ByObj** closures (`isByVal = false`) into `byobjInstanceMap` (conceptually the ByObj instance three tables).
2. **Copy** the same member-name set; generate **ByVal** closures (`isByVal = true`) into `byvalInstanceMap` (conceptually the ByVal instance three tables).
3. Static members exist only once and go into the static three tables.

Field offsets and method `this` resolution differences are in [../marshal/05-STRUCT.md](/docs/spec/marshal/05-STRUCT/). **Do not** bind struct instance members on the ByObj side only and omit ByVal.

---

## 6. Method overloads and aliases

Multiple candidate methods under the same **final Lua name**: write a **dispatch closure** into `methodTable`, and write a **full-signature direct key** for each candidate ([../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §3.7). Final names also come from `[LuaAlias]` / XML (same document §3, §5). Runtime `zlua.register_method` **must not** take an existing method name or overload-group name (§6.1); its purpose is to hang an existing direct (including full-signature keys) under a **short name** for colon calls.

`[LuaAlias]` **may** duplicate the default method name or other aliases; duplicates merge into the same overload group.

Overload grouping for static vs instance, and ByVal vs ByObj, is **independent**.

---

## 7. Name conflicts

### 7.1 Method ↔ method

Multiple methods under the same final name are **legal** and go through overload (previous section). Bind **does not** fail merely because method keys “collide”.

### 7.2 Method ↔ field / property

If a field / property shares a name with a method, `methodTable` wins at `__index` time (see [02-INDEX.md](/docs/spec/metatable/02-INDEX/) §2.4).

### 7.3 Inheritance flattening

If at Bind time a key is already occupied by a higher-priority declaration (for example a subclass already overrode a base same-name **member slot** under existing policy), handle base entries per inheritance rules. This does not conflict with “same-name methods enter an overload group”: flattening subclass and base same-name instance methods still aggregates candidates under the final name (details in [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/)).

---

## 8. Event handling

C# `event` is **not** registered as a `{ get, set, fire }` subtable. Compiler-generated **`add_*` / `remove_*`** (and visible `raise_*` if any) enter `methodTable` as ordinary **methods**. Script usage:

```lua
obj:add_SomeEvent(function() ... end)
obj:remove_SomeEvent(handler)
```

**Not supported:** `obj.SomeEvent = handler` or `__newindex` assignment to an event name.

---

## 9. Lazy binding flow (summary)

1. Resolve `Il2CppClass*` / `Type`; return if a `TypeBinding` already exists.
2. Collect public members from the **base chain** and the **current class** (constructors from the current class only).
3. Write static/instance three tables per §3; for structs, run §5 dual instance closures.
4. Configure `SMT.__call`, struct `_default`, Nullable special SMT, etc. ([04-SPECIAL-TYPES.md](/docs/spec/metatable/04-SPECIAL-TYPES/)).
5. Create SMT / IMT, attach indexers, establish `T` ↔ IMT cross-lookup ([01-LAYOUT.md](/docs/spec/metatable/01-LAYOUT/) §5–§6).

Binding scope for generic definition types and types with open generic parameters is specified in [../02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/); once visible to scripts, bound members must follow this document's classification and flattening rules.

---

## 10. Acceptance criteria (semantics)

- Registered methods / fields / properties / `add_*` / `remove_*`: the index hot path does not depend on C# string reflection table lookup.
- Unregistered keys: `__index` / `__newindex` → error (see [02-INDEX.md](/docs/spec/metatable/02-INDEX/)).
- Static/instance three tables are isolated; inherited members are Bind-time flattened; no runtime chain lookup.
- **No** event subtable; **no** reflection fallback.
- Mono and Il2Cpp agree on the member set and read/write semantics.
