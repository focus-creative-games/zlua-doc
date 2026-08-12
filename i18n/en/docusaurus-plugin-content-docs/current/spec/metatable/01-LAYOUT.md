---
sidebar_position: 18
title: "Metatable layout"
---

# 01 — Metatable layout

This document specifies the structure of the **type table**, **static metatable (SMT)**, and **instance metatable (IMT)** that ZLua exposes on the Lua side. All key names match `LuaConsts.h`. Lua scripts depend on these layouts indirectly through member access, `typeof`, construction, and related APIs, but must not depend on native implementation details (such as Dispatch closures or three-table upvalue layout — see `impl/metatable/`).

**Related docs:** member index algorithm → [02-INDEX.md](/docs/spec/metatable/02-INDEX/); bind-time rules → [03-BINDING.md](/docs/spec/metatable/03-BINDING/); special types → [04-SPECIAL-TYPES.md](/docs/spec/metatable/04-SPECIAL-TYPES/); type resolution and `CSharp` paths → [../02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/).

---

## 1. Overall model

Each bound C# type corresponds to one **type table** `T` in Lua. `T` is the facade for **static members**: when a script writes `Type.StaticField` or `Type.StaticMethod()`, dispatch goes through `__index` / `__newindex` on `T`'s metatable **SMT**.

**Instance members** hang on the userdata's metatable. Reference types (class, interface, array, delegate, boxed enum, and so on) use only **ByObj** userdata and one **ByObj instance metatable**. Value-type structs support both **ByVal** (payload inside the userdata) and **ByObj** (boxed `Il2CppObject*`) userdata, each with its **own** instance metatable; both share the same member-name set, but the bridge resolves `this` differently (summary in [04-SPECIAL-TYPES.md](/docs/spec/metatable/04-SPECIAL-TYPES/), details in [../marshal/05-STRUCT.md](/docs/spec/marshal/05-STRUCT/)).

Static and instance bindings each build **three independent member tables** at bind time (`methodTable`, `fieldGetterTable`, `fieldSetterTable`; see [02-INDEX.md](/docs/spec/metatable/02-INDEX/)). The three tables are held as indexer-closure upvalues or registry references; they are **not** ordinary keys on `T` or `IMT`, so user scripts cannot accidentally mutate the dispatch tables.

Types are fully built on **first access** via `EnsureBinding` (lazy binding), not by registering everything at startup.

---

## 2. Type table `T`

The type table is an ordinary Lua table that carries type-identity metadata and acts as `self` for static member access. The following keys come from `LuaConsts.h` and binding conventions:

| Key | Constant | Description |
|-----|----------|-------------|
| `__fullname` | `LuaConsts::FullName` | Canonical Lua type full name (includes namespace and `+` nesting separators; aligned with CLR `Type.FullName`) |
| `__klass` | `LuaConsts::Klass` | Implementation: pointer to the native type description (`Il2CppClass*` lightuserdata on Il2Cpp; equivalent type id on Mono) |
| `__byval_instance_mt` | `LuaConsts::ByValInstanceMt` | Struct ByVal instance metatable; present **only for structs** |
| `__byobj_instance_mt` | `LuaConsts::ByObjInstanceMt` | ByObj instance metatable: class, boxed struct, boxed enum, array, delegate, etc. |
| `__struct` | `LuaConsts::Struct` | Structs only: `true` |
| `__enum` | `LuaConsts::Enum` | Enums only: `true` |
| `__nullable` | `LuaConsts::Nullable` | Closed `Nullable<T>` only: `true`; **mutually exclusive** with `__struct` / `__enum` |

At most one type-family marker (`__struct` / `__enum` / `__nullable`) is present, so scripts and APIs can distinguish construction entry points and instance shapes.

**Do not** remount method / getter keys on the type table that duplicate the SMT three tables, which would create dual paths of “direct lookup on `T`” vs “via `__index`”. Exceptions include enum public constants and literals written by `RegisterStaticLiteralFields`: those may exist as ordinary keys on `T` (reading `E.Red` does not go through `__index` when the key is already on `T`).

`T`'s metatable is **SMT** (`lua_setmetatable(T, SMT)`). All static member reads/writes go through SMT `__index` / `__newindex`; static members must not be mixed into instance userdata metatables.

**Do not** register a `_ctor` field on `T` equivalent to `SMT.__call`; parameterized constructors for class / struct are triggered only via `Type(...)` → `SMT.__call` (see [04-SPECIAL-TYPES.md](/docs/spec/metatable/04-SPECIAL-TYPES/)).

---

## 3. Static metatable `SMT`

Each type table has exactly one static metatable, fully isolated from instance metatables.

```
SMT
├─ __index      → static member indexer (upvalues: static methodTable, fieldGetterTable)
├─ __newindex   → static member newindexer (upvalue: static fieldSetterTable)
├─ __call       → instance construction dispatch (class / struct; Nullable see §4; enum has **none**)
├─ __tostring   → optional; default returns type __fullname
└─ _default     → optional; **struct only** parameterless default-instance closure (key name LuaConsts::Default)
```

`__call` and `_default` hang on the **SMT object itself**, not in the three tables. When the three tables miss, static `__index` must fall back to `rawget` on SMT (for example to fetch the `_default` closure), and return `nil` if still missing (see [02-INDEX.md](/docs/spec/metatable/02-INDEX/)).

Enum SMT has **no** `__call`. Nullable SMT has **only** `__call` (construct a value of element type `T`) and **no** `__index` / `__newindex` (see [04-SPECIAL-TYPES.md](/docs/spec/metatable/04-SPECIAL-TYPES/)).

---

## 4. Instance metatable (IMT)

An instance userdata's `metatable` points at the instance metatable for the declared type (or view type). Layout (all key names from `LuaConsts.h`):

```
IMT (ByVal or ByObj)
├─ __index      → instance indexer (upvalues: instance methodTable, fieldGetterTable)
├─ __newindex   → instance newindexer (upvalue: instance fieldSetterTable)
├─ __gc         → release userdata lifetime tracking (non-blittable ByVal structs, ByObj references, etc.)
├─ __type       → back-reference to type table T (static ↔ instance cross-lookup)
├─ __zlua_ud_kind → "byval" | "byobj" (LuaConsts::UdKindByVal / UdKindByObj)
├─ __tostring   → optional (e.g. boxed struct / enum via Object.ToString)
├─ __len        → optional (**arrays** szarray / mdarray; see [04-SPECIAL-TYPES.md](/docs/spec/metatable/04-SPECIAL-TYPES/))
└─ __call       → optional (**delegates only** ByObj userdata; see [04-SPECIAL-TYPES.md](/docs/spec/metatable/04-SPECIAL-TYPES/))
```

### 4.1 ByVal instance metatable (`T.__byval_instance_mt`)

- Applies to struct **ByValUserData** (payload embedded in full userdata).
- `__zlua_ud_kind` is `"byval"`.
- The `fieldGetterTable` / `fieldSetterTable` / `methodTable` used by the instance indexer have the **same member-name set** as the ByObj side, but getter / setter / method closures resolve `this` as ByVal (pointing at the payload, without an object header).
- Blittable structs may omit `__gc`; structs that contain managed reference fields must register `__gc`.

### 4.2 ByObj instance metatable (`T.__byobj_instance_mt`)

- Applies to: class instances, boxed struct instances, boxed enums, `System.Array`-derived arrays, delegates, etc.
- `__zlua_ud_kind` is `"byobj"`.
- The indexer resolves `this` under ByObj rules (`Il2CppObject*` / equivalent GCHandle).
- Classes attach only this one IMT (**no** `__byval_instance_mt`).
- Structs get a **separate** ByObj IMT in addition to ByVal IMT; enums have only ByObj IMT (for `zlua.box` products).
- Delegates additionally hang `__call` on the ByObj IMT so `delegate(arg1, …)` invokes directly.

**Do not** remount member keys on the IMT root that duplicate the three tables. Instance userdata **must not** implicitly access static members via `__index`; use type table `T` (see [../02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) §3.3).

---

## 5. Static ↔ instance cross-lookup

On first bind, the following references are established and then remain fixed:

| Reference | Purpose |
|-----------|---------|
| `T.__byval_instance_mt` → ByVal IMT | Attach metatable when constructing / pushing ByVal struct userdata |
| `T.__byobj_instance_mt` → ByObj IMT | Attach metatable when constructing class, boxed struct, boxed enum, array, etc. |
| `IMT.__type` → `T` | Resolve type from instance, `zlua.typeof`, overload registration, etc. |

The same managed object may map to different `T` / IMT values under different **view types**, while identity remains the same instance; `zlua.cast` switches the facade (Marshal: [../marshal/06-CLASS.md](/docs/spec/marshal/06-CLASS/)).

---

## 6. Registration order

When creating a type table, the native side must follow this order so that writing instance-metatable fields after `setmetatable(T, SMT)` does not trigger static `__newindex`:

1. Create empty type table `T`; write `__fullname`, `__klass`, and type-family markers.
2. Build **ByVal IMT** (if applicable) and its instance three tables; write `T.__byval_instance_mt`.
3. Build **ByObj IMT** and its instance three tables; write `T.__byobj_instance_mt`.
4. Build **SMT** and the static three tables; call `lua_setmetatable(T, SMT)`.

Steps that write enum constants and similar keys directly onto `T` may run before or after attaching SMT, but must finish before the type table becomes visible to scripts.

---

## 7. Instance metatable keys (current)

The spec distinguishes struct dual forms with **`__byval_instance_mt` / `__byobj_instance_mt`**; reference types expose only `__byobj_instance_mt`. `Nullable<T>` attaches **no** instance-metatable fields. Key names are defined by `LuaConsts.h`.

---

## 8. Lazy binding `EnsureBinding`

`EnsureBinding(klass)` runs the first time a type needs member dispatch or metatable construction: scan public members, flatten along the inheritance chain into static/instance three tables (see [03-BINDING.md](/docs/spec/metatable/03-BINDING/)), create SMT / IMT, and establish the §5 cross-lookup references. Binding policy for open generic definitions and types with unbound generic parameters is specified in the type-system volume; this directory only requires that **once binding completes, the Lua-visible layout and index semantics are stable and match this document**.
