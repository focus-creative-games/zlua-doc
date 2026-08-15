---
sidebar_position: 3
title: "Type system"
---

# 02 — Type system

> Spec for Lua-side access to C# **types, members, and construction**. Applies to **Il2Cpp (Player)** and **Mono (Editor)**.
> **Member indexing (`__index` / `__newindex`)** → [metatable/](/docs/spec/metatable/)
> **Parameter Marshal (Push/Pop)** → [marshal/](/docs/spec/marshal/)

**Platform principle:** Il2Cpp emphasizes zero GC and direct `methodPointer`; Mono may use reflection / Emit, but **Lua-visible semantics must match Il2Cpp**.

---

## 1. Design goals

| Goal | Notes |
|------|-------|
| Unified entry | Ordinary types lazy-load via the `CSharp` root table |
| C#-like semantics | `Type.Static()`, `obj:Instance()`, construct with `Type()` |
| Static/instance isolation | Static and instance use **independent** metadata and three tables |
| Public only | Lua can access only `public` members |
| Bind-time flattening | Static/instance members are written into the current type’s three tables at **EnsureBinding**; **no** runtime walk of the inheritance chain |
| Index miss | `__index` / `__newindex` → **`error`** (see [metatable/02-INDEX.md](/docs/spec/metatable/02-INDEX/)) |

---

## 2. Type naming and resolution

### 2.1 `CSharp` root table

```
CSharp                          -- global table, __index → lazy-load assembly
  └─ {assemblyName}             -- assembly table
       └─ {typeFullName}         -- type table (§3)
```

**Assembly names** are simple names (no `.dll`), e.g. `Assembly-CSharp`, `mscorlib`.

```lua
CSharp.AC = CSharp['Assembly-CSharp']   -- optional alias
```

### 2.2 Type access syntax

#### No namespace (global namespace)

Dot access is fine when the identifier is legal:

```lua
CSharp.AC.Demo
CSharp['Assembly-CSharp'].Demo
```

#### With namespace (brackets required)

**Forbidden:** `CSharp.AC.MyGame.UI.Panel`; the whole `typeFullName` must be a key:

```lua
CSharp.AC['MyGame.UI.Panel']
CSharp['Assembly-CSharp']['MyGame.UI.Panel']
```

**Rule:** `.` inside a namespace belongs to the **string key**, not a Lua table path.

#### Assembly names with special characters

```lua
CSharp['Assembly-CSharp']['MyGame.UI.Panel']
```

| Scenario | Syntax |
|----------|--------|
| No namespace + legal identifier | `CSharp.{asm}.{TypeName}` |
| **Has namespace** | `CSharp.{asm}['Ns.Type']` **required** |
| **Nested type** | `CSharp.{asm}['Outer+Inner']` **required** (`+` separator) |
| Contains `-`, `+`, `` ` ``, etc. | Use `['...']` for that segment |

### 2.3 Namespaces and nested types

- **Namespace:** `MyGame.UI.Panel` → namespace `MyGame.UI`, class name `Panel`
- **Nested type:** `{OuterFullName}+{NestedClassName}`, same as `Type.FullName`

```lua
CSharp.AC['TopClass+NestedClass']
CSharp.AC['MyGame.UI.Outer+Inner']

-- Do not join nested layers with '.':
-- CSharp.AC['Outer.Inner']   ✗
```

The type table’s `__fullname` stores the string above; native does **not** convert `.` ↔ `+`.

### 2.4 Type arguments (`typeArg`)

Used by `zlua.make_generic_type`, `make_szarray_type`, etc. (see [05-LIB.md](/docs/spec/05-LIB/)).

| Form | Notes |
|------|-------|
| `CSharp[assembly][typeFullName]` | Type table |
| Return of `zlua.make_generic_type` / `make_szarray_type` / `make_mdarray_type` | Interned type table |
| mscorlib **string** | e.g. `"System.Int32"`; **corlib only** |
| `zlua.types.*` | mscorlib full-name constants |

**Forbidden:** arbitrary Lua tables, non-ZLua userdata, or `zlua.typeof(...)` return values as `make_*_type` typeArgs (`typeof` is for signatures etc.; see §2.7).

### 2.5 Generic types

```lua
local ListDef = CSharp.mscorlib['System.Collections.Generic.List`1']
local List_int = zlua.make_generic_type(ListDef, zlua.types.int32)

local Dict_str_int = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.Dictionary`2'],
    zlua.types.string,
    zlua.types.int32
)
```

- `genericBaseType`: open definition (includes `` ` `` and arity)
- Argument count must match arity; same arguments **intern** to the same type table

### 2.6 Array types

```lua
local int_arr = zlua.make_szarray_type(zlua.types.int32)      -- int[]
local md_type = zlua.make_mdarray_type(zlua.types.int32, 2)   -- int[,]
```

`rank ≥ 1`; szarray and mdarray are distinct types.

### 2.7 `zlua.typeof`

```lua
-- Equivalent to C# typeof(Demo) / typeof(List<int>)
local t = zlua.typeof(CSharp.AC.Demo)
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32
)
local t2 = zlua.typeof(ListInt)   -- closed generic / array / any type table
```

`typeTable` is **any** ZLua type table (`CSharp` base tables, or results of `make_generic_type` / `make_*array_type` / `get_type_from_name`, etc.). The **return value** is that type’s **`System.Type` reflection object** (class userdata), matching C# `typeof(T)`. Usable where APIs / signatures need `System.Type`; **not** a §2.4 typeArg (typeArg wants a type table, not a `Type` instance).

### 2.8 `zlua.types` / `zlua.get_type_from_name`

See [05-LIB.md](/docs/spec/05-LIB/) §4.2, §4.3. `get_type_from_name(typeFullName)` mirrors `System.Type.GetType(string)` and returns a type table (supports AQN, generics, arrays).

### 2.9 Ways to obtain types

| Path | Use | Example |
|------|-----|---------|
| `CSharp[assembly][typeFullName]` | class, struct, enum, delegate, interface, nested, **open generic definitions** | `CSharp.AC['Outer+Inner']` |
| `zlua.get_type_from_name` | Single-string resolve (AQN / generic / array) | `zlua.get_type_from_name("System.Int32[]")` |
| `zlua.make_generic_type` | **Closed generic** | `List<int>` |
| `zlua.make_szarray_type` | `T[]` | |
| `zlua.make_mdarray_type` | `T[,…]` | |

**Not** resolved directly via `CSharp[...]`: closed generics, array types (use `make_*` or `get_type_from_name`).

#### Lazy loading

```
CSharp.__index(asmName) → rawget or create assembly table → rawset
assembly.__index(typeFullName) → resolve Type → EnsureBinding → rawset
```

| Miss | Behavior |
|------|----------|
| Assembly does not exist | **`error`**: `zlua: assembly not found: {assemblyName}` |
| Type does not exist | **`error`**: `zlua: type not found: {typeFullName}` |

**Do not** return `nil` for a missing assembly / type.

`EnsureCSharpRoot` runs **once at startup**; afterward C# obtains the root with `lua_getglobal("CSharp")`.

### 2.10 Type-table metadata (for resolution)

| Field | Notes |
|-------|-------|
| `__typeid` | Id for reverse lookup of closed generics / arrays, etc. |
| `__assembly` | Assembly simple name |
| `__fullname` | Canonical full name per §2.3 |
| `__name` | Short name |
| `__struct` | struct: `true` |
| `__enum` | enum: `true` |
| `__nullable` | closed `Nullable<T>`: `true` |
| `__instance_mt` | Instance metatable (Nullable has **none**) |
| `__klass` | native: `Il2CppClass*` / Mono typeId |

---

## 3. Type table and metatable layout

> Three-table layout and `__index` algorithm: [metatable/01-LAYOUT.md](/docs/spec/metatable/01-LAYOUT/), [metatable/02-INDEX.md](/docs/spec/metatable/02-INDEX/)

### 3.1 Type table (static façade)

Each C# type has type table `T` + static metatable `SMT`:

```
T  (type table)
├─ __assembly / __fullname / __name / __typeid / __instance_mt / __klass
├─ StaticField / StaticMethod closure (or three-table dispatch via SMT.__index)
└─ ...

SMT
├─ __index / __newindex  → three-table dispatch (method / fieldGetter / fieldSetter)
└─ __call                → instance constructor dispatch (enums have none)
```

**Only static members** are accessed through the type table; the **sole exception** is `T(...)` / `SMT.__call` to construct instances.

### 3.2 Instance metatable `IMT`

Fully **independent** of `SMT`:

```
IMT
├─ __index / __newindex  → three tables (Bind already includes inherited members)
├─ __gc                  → ByObj: ObjectRegistry; ByVal: struct release
├─ __len                 → arrays (§7.3)
└─ __type                → back to type table T
```

```
instance userdata
  metatable = IMT     -- façade = declared type / view
  payload     = object pointer or struct copy
```

The same managed object may have multiple userdata (different views); `zlua.cast` switches the façade ([marshal/06-CLASS.md](/docs/spec/marshal/06-CLASS/)).

**Forbidden** to access static members **implicitly** via instance `__index`; use type table `T` for statics (see §3.3).

### 3.3 Cross-references static ↔ instance

| Reference | Use |
|-----------|-----|
| `T.__instance_mt` → `IMT` | Attach at construction |
| `IMT.__type` → `T` | `typeof`, register_method domain inference |
| `TypeBinding` | Holds staticMap, byval/byobj instance maps |

### 3.4 Deferred init (EnsureBinding)

On a type’s **first access**, fully build (**public only**):

- Fields, parameterless/parameterized properties, methods, constructors
- **Public members from the inheritance chain flattened** into the current type’s three tables (§5)
- Final names after `[LuaAlias]` renames (may collide with other methods’ default names/aliases; see overload §5)

### 3.5 Enums

Via `CSharp[...]` you get type table `E`:

- Bind time: **public static literal** → type-table key or fieldGetter, value is **integer** (preferred on Lua 5.4+)
- **No** `SMT.__call` / `_default` / `_ctor`
- Default across the boundary: **integer/number** ([marshal/08-ENUM.md](/docs/spec/marshal/08-ENUM/))
- Boxed instances: **only** `zlua.box(E, value)` → ByObj

```lua
local Color = CSharp.AC['MyGame.Color']
assert(Color.Red == 0)
local redBox = zlua.box(Color, Color.Red)
```

### 3.6 Nullable\<T\>

Closed `Nullable<T>` type table `N`:

- `__nullable : true`; **no** `__instance_mt` / `IMT`
- `SMT` has **only** `__call` → constructs a valued argument of **element type `T`** (not a Nullable wrapper instance)
- `null` → Lua **`nil`** ([marshal/06-CLASS.md](/docs/spec/marshal/06-CLASS/) Nullable section)

```lua
local NullableInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Nullable`1'],
    zlua.types.int32
)
CS.Service.Take(NullableInt(42))   -- has value
CS.Service.Take(nil)              -- null
```

### 3.7 struct

Type table has `__struct : true`:

```
SMT.__call     → parameterized constructor dispatch → ByVal userdata
SMT._default   → parameterless default(T) userdata (struct only)
```

```lua
local Point = CSharp.AC['MyGame.Point2D']
local zero = Point._default()
local p = Point(3, 4)
```

- Instances: **ByVal userdata** ([marshal/05-STRUCT.md](/docs/spec/marshal/05-STRUCT/))
- **No inheritance**; static members do not look upward (value types have no derived-static scenario)

---

## 4. Member exposure rules

### 4.1 Visibility

Only `public` enters binding tables. `internal` / `protected` / `private` are invisible to Lua.

### 4.2 Fields

| Access | Instance | Static |
|--------|----------|--------|
| Read | `obj.field` | `Type.field` |
| Write | `obj.field = v` | `Type.field = v` |

Assigning a readonly field → `__newindex` error.

### 4.3 Properties

| Kind | Lua access |
|------|------------|
| Parameterless property | `obj.prop` / `Type.prop` (getter/setter via three tables) |
| Parameterized property (including indexers) | **`get_PropName(...)` / `set_PropName(...)`** method form |

**Array** elements: **`get` / `set` instance methods** (§7.4), not `get_Item` naming, and not `arr[i]` metamethods.

### 4.4 Methods

See [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/): single candidate → direct closure; multiple → dispatch; `[LuaAlias]` / `register_method`.

### 4.5 Events (no dedicated metatable)

**No** Event subtable `{ get, set, fire }`.

C# `event` is exposed on Lua as ordinary **add / remove** methods (same names as the compiler generates):

```lua
demo:add_ValueChanged(function(v) print(v) end)
demo:remove_ValueChanged(handler)
```

If the type exposes public `raise`/`invoke` methods, they bind as ordinary methods; there is **no** special `fire` key.

### 4.6 Constructors

| Kind | Construction entry |
|------|--------------------|
| class / struct | `Type(...)` → `SMT.__call`; struct also has `Type._default()` |
| enum | **None**; use `zlua.box` |
| Nullable\<T\> | `N(...)` → value of element `T`; null uses `nil` |
| Abstract class / interface | No public ctor → `__call` error |

- Construction does **not** participate in inheritance; only **public instance constructors declared on the current type**
- **Forbidden** to hang a `_ctor` field on the type table equivalent to `__call` (except struct `_default`)

---

## 5. Inheritance (Bind-time flattening)

### 5.1 Static members

`SMT.__index` does **not** recursively look at base types when `staticMap` misses.

To match C# “inherited static members accessible via the derived type name,” **EnsureBinding** **flat-copies** base public static members into the derived `staticMap` (derived same-name wins).

### 5.2 Instance members (Bind-time flattening; no runtime promotion)

**Not used:** on `__index` miss, walk the inheritance chain and **promote** into the member table. After binding, miss is **error**.

**Current spec:** same as static — at **Bind time**, flat-write base public instance members (fields, parameterless properties, methods) into the derived type’s `byvalInstanceMap` / `byobjInstanceMap` three tables; derived declarations **override** same-name base entries.

Runtime `__index` / `__newindex`:

```
1. rawget methodTable / fieldGetterTable / fieldSetterTable (plus SMT fallback)
2. hit → return or call
3. miss → both __index and __newindex error (see metatable/02-INDEX.md)
```

**No** step “walk inheritance” or “promote into instanceMap”.

**Virtual methods:** still virtually dispatch on the **real instance** through the bridge; Bind table entries point at subclass override bridges so C# semantics hold.

### 5.3 Methods and dispatch under inheritance

If the inheritance tree has multiple public candidates with the same **final name** in the same `is_static` domain (including base flat results and `[LuaAlias]` collisions), after Bind that key binds a **dispatch closure**. At dispatch time the candidate list includes all applicable overloads under that final name; ranking rules: [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §3.6, §5.

---

## 6. Generic methods

For methods that **themselves** have generic parameters, e.g. `void Foo<T>(T a)`. Methods on a closed generic class do **not** use this section.

### 6.1 Calling convention

```lua
-- Type.Foo is a direct generic method closure
local foo_int = zlua.make_generic_method(Type.Foo, zlua.types.int32)
foo_int(obj, value)   -- static: no obj needed
```

Use [05-LIB.md](/docs/spec/05-LIB/) `make_generic_method` to specialize the generic method closure.

### 6.2 Caching

Same `(genericMethodBase, typeArgs…)` **intern**s to one inflated direct closure (Il2Cpp: written under an internal signature key in `NameMetaMap`).

---

## 7. Arrays

### 7.1 Creation

```lua
local arr = zlua.new_szarray_by_element_type(zlua.types.int32, 10)
local arr2 = zlua.new_szarray_by_szarray_type(int_arr_type, 10)
local matrix = zlua.new_mdarray_by_spec(zlua.types.int32, {0,0}, {2,3})
```

### 7.2 `#` (`__len`)

| Shape | `#arr` |
|-------|--------|
| szarray | `Length` |
| mdarray | `∏ GetLength(d)` (total addressable elements) |

Per-dimension lengths still use `GetLength(dimension)`.

### 7.3 Element access: `get` / `set`

Does **not** implement `arr[i]` metamethods.

```lua
arr:set(0, 10)
local v = arr:get(0)

matrix:set(0, 1, 7)
local x = matrix:get(0, 1)
```

| API | Notes |
|-----|-------|
| `get` | Arg count = `rank`; returns Lua form of element type (primitives unboxed) |
| `set` | First `rank` args are **C# indices** (including lower bounds); last arg is value |

Differs from `zlua.to_table`’s **1-based** Lua tables ([05-LIB.md](/docs/spec/05-LIB/) §8.4).

### 7.4 Conversions

| API | Notes |
|-----|-------|
| `zlua.to_bytes` | blittable-element szarray (primitives or structs with no ref fields) → Lua string by memory byte copy |
| `zlua.to_table` | szarray → 1..n Lua table |

---

## 8. Special types summary

| Kind | Notes |
|------|-------|
| Interface | Resolvable; not constructible (no public ctor) |
| Abstract class | `__call` only if public ctor exists |
| Static class | Static members only; no `__call` |
| Enum | §3.5; [marshal/08-ENUM.md](/docs/spec/marshal/08-ENUM/) |
| Nullable\<T\> | §3.6 |
| Delegate | Type table + instance `IMT.__call`; [marshal/09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/) |
| struct | §3.7; [marshal/05-STRUCT.md](/docs/spec/marshal/05-STRUCT/) |
| class | ByObj; [marshal/06-CLASS.md](/docs/spec/marshal/06-CLASS/) |

---

## 9. Mono / Il2Cpp consistency

| Item | Requirement |
|------|-------------|
| `CSharp` path and `typeFullName` | Same |
| Static/instance isolation | Same |
| Bind-time inheritance flattening | Same |
| `__index` / `__newindex` miss → error | Same |
| Event → add_/remove_ | Same |
| Construction, dispatch, generic methods | Same |
| Array `#`, `get`/`set` | Same |
| Error messages | Identical or equivalent |

---

## 10. Examples

```lua
CSharp.AC = CSharp['Assembly-CSharp']

local demo = CSharp.AC.Demo()
local panel = CSharp.AC['MyGame.UI.Panel']()

local Point = CSharp.AC['MyGame.Point2D']
local p = Point(3, 4)
local zero = Point._default()

local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32
)
local list = ListInt()

demo:add_Changed(function() end)

local arr = zlua.new_szarray_by_element_type(zlua.types.int32, 4)
arr:set(0, 42)
```

---

## 11. Implementation touchpoints

| Topic | Il2Cpp | Mono |
|-------|--------|------|
| Type lazy load | `TypeRegistry` | `LuaMonoAppDomain` / MetaBinding |
| Three-table indexer | `MetaBinding` / `Dispatch*` | Lua closure indexer |
| Inheritance flatten | `MetaBinding::EnsureBinding` | `MetaBinding.cs` |
| Array get/set | `ArrayMarshal` + instance map | Equivalent binding |

Details: [impl/IL2CPP.md](/docs/impl/IL2CPP/), [impl/MONO.md](/docs/impl/MONO/).
