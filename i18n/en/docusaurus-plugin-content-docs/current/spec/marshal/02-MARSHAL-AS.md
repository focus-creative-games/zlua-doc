---
sidebar_position: 8
title: "`[LuaMarshalAs]` and `LuaMarshalType`"
---

# `[LuaMarshalAs]` and `LuaMarshalType`

> **Normative:** Marshal override rules on parameters, return values, fields, properties, and types (`class` / `struct`).
> **Default matrix:** When not overridden, see [01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/).
> **Source:** `LuaMarshalAsAttribute`, `LuaMarshalType` in `ZLua.Common` (enum names in this doc, including **`OpaqueValue`**).
> **External config:** Precompiled assemblies can use equivalent XML rules; see **§9**.

## 1. Overview

`[LuaMarshalAs]` may annotate:

- **Parameters**, **return values**, **fields**, **properties**
- **Types** (type-level defaults on `class` / `struct`)

Must **not** annotate **methods** (annotate each parameter/return separately).

Must **not** apply to **undetermined (open / containing generic parameters) CLR type positions** (§1.1); may apply to **closed** generic type positions (e.g. `List<int>` parameters). XML rules share the **same constraints** as Attribute (§9.3.1).

Overrides must be in the **§3 legal set**; otherwise **§4.1** falls back to `Default` and logs an error in the Editor.

```csharp
public enum LuaMarshalType
{
    Default,
    UserData,
    Bytes,
    OpaqueValue,
    UnpackedValues,   // struct / closed generic struct: multi Lua stack slots ↔ listed members (excl. Nullable)
    Table,            // struct / closed generic struct / Nullable<struct>: single Lua table ↔ listed members
}

[AttributeUsage(
    AttributeTargets.Parameter | AttributeTargets.ReturnValue |
    AttributeTargets.Field | AttributeTargets.Property |
    AttributeTargets.Class | AttributeTargets.Struct)]
public sealed class LuaMarshalAsAttribute : Attribute
{
    public LuaMarshalType LuaMarshalType { get; }

    /// <summary>
    /// Required for <see cref="LuaMarshalType.Table"/> / <see cref="LuaMarshalType.UnpackedValues"/>.
    /// Elements are CLR field or property names (mixed OK); order is UnpackedValues stack order / Table R/W order.
    /// Names ending in '?' mean optional keys for Table, Lua→C# (§6).
    /// </summary>
    public string[] Members { get; set; }

    public LuaMarshalAsAttribute(LuaMarshalType luaMarshalType = LuaMarshalType.Default);
}
```

### 1.1 Generics: only “determined” type positions

`[LuaMarshalAs]` (and equivalent XML) must **not** be used on types that still contain unbound generic parameters:

| Forbidden | Allowed |
|-----------|---------|
| Type-level on open definitions: `[LuaMarshalAs] class MyList<T>` / ``struct Foo`1`` | Type-level on **non-generic** `class` / `struct` |
| Parameter/return/field/property CLR type is a generic parameter or open construction: `void Foo([LuaMarshalAs] T a)`, `List<T> items` | Closed construction: `void Foo([LuaMarshalAs] List<int> arr)`, field `List<int> Body` |
| Undetermined slots on generic methods (including ordinary methods on generic classes while the slot still contains `T`) | Slots on the same method whose types are already closed |

Notes:

- C# **cannot** put type-level attributes on closed instances like `List<int>`; type-level exists only on type definitions. Thus **generic types (open definitions) forbid type-level** `[LuaMarshalAs]` / XML type-level `MarshalAs`; closed instances also do **not** inherit type-level rules by “normalizing to the open definition”.
- Member rules may still hang under an open generic **declaring type** XML `Type` (``MyList`1``) as long as the target Field/Property/Param/Return CLR type is **determined**.

Violations → **Il2Cpp Generate / XML fail**; **Mono Attribute** path: **§4.1** (log + fall back to Default).

## 2. `LuaMarshalType` enum notes

| Value | Direction | Notes |
|-------|-----------|-------|
| **`Default`** | Bidirectional | Use [01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/) defaults; no extra conversion. |
| **`UserData`** | Bidirectional | **Only** on **managed reference types** and **struct** (§3); **not** for primitives / `enum` / `IntPtr`, etc. Semantics: force **UserData shape** (ByObjUserData / ByValUserData / ClassUserData, etc.).<br>• **Substantively useful mainly for `string`:** default C#↔Lua is Lua **string**; with annotation → **ByObjUserData** (managed `System.String` object)<br>• **class / interface / arrays / ordinary struct / object:** default marshal **already** UserData; annotation ≡ `Default`<br>• **`Delegate`:** may annotate but **no real effect**—still marshals as **Lua function** or existing bridge per [09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/) |
| **`Bytes`** | Bidirectional | **Force** conversion between C# **`byte[]`** and Lua **`string`**.<br>• C# **`byte[]`:** default ByObjUserData → Lua **string** (raw octets, not UTF-8 text semantics)<br>• On **`byte[]` parameters/returns**, Lua must pass **string**; Pop does **not** accept ByObjUserData / table<br>• On **`string`** parameters/returns, dual **`byte[]` ↔ string** rules apply |
| **`OpaqueValue`** | **C# → Lua only** | Push **OpaqueValue** (lightuserdata, no metatable); see [04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/).<br>• **`ref` / `out` / `in T`** (any `T`) **default** to this shape (no annotation needed)<br>• **by-val** may explicitly annotate for **struct / managed references / enum / pointers**, etc. (see §3) to force Opaque Push; **primitives** and **`IntPtr` / `UIntPtr` / `nint` / `nuint`** **must not** annotate ( **`Default` only**, §3)—already integer/number, no real need, and this enables hot-path optimization<br>• Scripts R/W via `zlua.get_opaquevalue` / `zlua.set_opaquevalue`; pass-back to C# follows [04-OPAQUE.md §6](/docs/spec/marshal/04-OPAQUE/)<br>• Must **not** persist across calls; annotating this on a **Lua → C#**-only parameter is **illegal** (§3.1) |
| **`UnpackedValues`** | **Bidirectional** | **Ordinary struct / closed generic struct** (§3; **excludes** `Nullable` / class / interface). Convert members listed in **§5** `Members` with **multiple contiguous Lua stack slots**:<br>• **Lua → C#:** Pop N values from the stack in list **order**, write corresponding fields/properties<br>• **C# → Lua:** Push N values in list **order** (multi-return or expanded push)<br>Requires **`Members`**; missing or illegal target → **§4**. That parameter/return occupies **N** Lua stack slots (§5.6) |
| **`Table`** | **Bidirectional** | **Ordinary struct / closed generic struct / `Nullable<struct>`** (§3; **excludes** class / interface). Convert members listed in **§5** `Members` with a **single Lua table**:<br>• **Lua → C#:** Pop one table (or for `Nullable` allow `nil`→no value); read by **key name** and write fields/properties<br>• **C# → Lua:** Push one table (`Nullable` no value → `nil`)<br>Requires **`Members`** (resolved on the **underlying struct**); missing or illegal → **§4**. Occupies **1** Lua stack slot |

## 3. Legal `LuaMarshalType` sets per type

Each CLR parameter/return/field type may only bind a `LuaMarshalType` from **§2** that is compatible with its semantics (**`Default` is legal for all types**). Codegen / Mono reflection must consult the table when **parsing annotations**; annotations **outside the legal set** are **invalid** (§4).

The “legal set” column lists values that may be annotated **besides `Default`**; unlisted `LuaMarshalType` values are **illegal** for that type.

**`OpaqueValue`:** Only types listed in the §3 table may legally annotate it for **C#→Lua** (§3.1); it is **not** “any by-val type”. **Primitives** and **`IntPtr` / `UIntPtr` / `nint` / `nuint`** allow **`Default` only** (no `OpaqueValue` / `UserData`, etc.), so hot paths can omit Opaque branches. `ref`/`in`/`out` (including `ref int`) already default to Opaque—**no** need to annotate again; see the “byref” row.

| C# type (category) | Legal `LuaMarshalType` (excl. `Default`) | Notes |
|--------------------|------------------------------------------|-------|
| **Primitives** (`bool`, `char`, `byte`…`ulong`, `float`, `double`) | (none; **`Default` only**) | **`UserData` / `OpaqueValue` both illegal**. Default is already integer/boolean/number; forbidding `OpaqueValue` enables optimization. **`ref`/`in`/`out` primitives** → already Opaque (see “byref” row)—that is **not** by-val `[OpaqueValue]` |
| **`IntPtr` / `UIntPtr` / `nint` / `nuint`** | (none; **`Default` only**) | Same as primitives: `Default` only (integer numeric Marshal); **no** `OpaqueValue` / `UserData` |
| **`string`** | `UserData`, `Bytes`, `OpaqueValue` | `UserData`: force ByObjUserData; `Bytes`: octet string; `OpaqueValue`: **C#→Lua only** |
| **`byte[]`** | `Bytes`, `UserData`, `OpaqueValue` | `Bytes`: ↔ Lua string; `UserData` ≡ default; `OpaqueValue`: **C#→Lua only** |
| **`T[]` (szarray)** | `UserData`, `OpaqueValue` | `UserData` ≡ default; `OpaqueValue`: **C#→Lua only** |
| **`T[,…]` (mdarray)** | `UserData`, `OpaqueValue` | Same; Lua→C# does **not** accept table because of annotation |
| **`enum`** | `OpaqueValue` | by-val **cannot** `UserData`; boxed via `zlua.box` ([08-ENUM.md](/docs/spec/marshal/08-ENUM/). `OpaqueValue` legal but usually unnecessary. **`ref`/`in`/`out` enum** → see “byref” |
| **`struct`** (ordinary value type / **closed** generic struct; not ref struct) | `UserData`, `OpaqueValue`, `Table`, `UnpackedValues` | `UserData` ≡ default; `OpaqueValue`: **C#→Lua only**; `Table` / `UnpackedValues` need member list |
| **`class`** | `UserData`, `OpaqueValue` | `UserData` ≡ default; `OpaqueValue`: **C#→Lua only**; **no** `Table` / `UnpackedValues` |
| **`interface`** | `UserData`, `OpaqueValue` | Default ByObjUserData; `UserData` ≡ default; **no** `Table` / `UnpackedValues` |
| **`Delegate` and subclasses** | `UserData`, `OpaqueValue` | `UserData` has no real effect; `OpaqueValue`: **C#→Lua only** |
| **`object`** | `UserData`, `OpaqueValue` | `OpaqueValue`: **C#→Lua only** |
| **`ref` / `in` / `out T` (any T)** | (usually no annotation) | C#→Lua **defaults** to OpaqueValue ([04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/). Explicit `[OpaqueValue]` **legal** |
| **`Nullable<T>`** (`T` is struct) | `UserData`, `OpaqueValue`, **`Table`** | Legal set does **not** include `UnpackedValues` (multi-slot cannot distinguish `nil`=no value). `Table` `Members` target **underlying `T`**; `nil`↔no value, table↔has value. When `T` is primitive/enum, usually no `Table` beyond `Default`/`OpaqueValue`/`UserData` (if applicable) |
| **Unmanaged pointers** (`T*`, `void*`, etc.) | `OpaqueValue` | Default may be `Default` (Pointer pass-through; [10-POINTER.md](/docs/spec/marshal/10-POINTER/); may also annotate `OpaqueValue` (C#→Lua) |
| **Function pointers** (`delegate*<…>`) | `OpaqueValue` | Same as unmanaged pointers |
| **`TypedReference`** | (usually no annotation) | **Default is OpaqueValue** (bidirectional **only** this shape; [10-POINTER.md](/docs/spec/marshal/10-POINTER/). Explicit `[OpaqueValue]` legal and equivalent; `UserData` / `Table` etc. **illegal** |
| **`decimal`** | `OpaqueValue` | v1 default by-val may still be unsupported; `OpaqueValue` (C#→Lua) legal |
| **`ref struct`** (`Span<T>`, etc.) | `OpaqueValue` | Cannot use ordinary by-val default marshal; `OpaqueValue` (C#→Lua) legal |
| **`params T[]` parameters** | `OpaqueValue` | Same default as szarray (§7); **no** dedicated `LuaMarshalType`; `OpaqueValue`: **C#→Lua only** |

### 3.1 Direction filter (stacked on the table above)

| `LuaMarshalType` | Allowed annotation direction |
|------------------|------------------------------|
| `UserData`, `Bytes`, `Table`, `UnpackedValues` | **Bidirectional** (Pop / Push may apply; depends on parameter/return direction) |
| `OpaqueValue` | **C# → Lua only** (returns, or push args when C# calls Lua); on a **pure Lua→C# parameter** → **illegal** |

## 4. Illegal annotations and config errors

### 4.1 Mono Attribute: always log + fall back to Default

When **Mono** runtime parses **Attribute** (including type-level), these cases do **not** abort binding:

| Behavior | Notes |
|----------|-------|
| **Marshal** | **Treat as `Default`**—same as unannotated |
| **Log** | **Editor only** emits **error-level** logs (member signature, CLR type, reason, fall back to Default) |
| **Player (Mono)** | Silent fall back to Default |

Coverage includes but is not limited to:

- Type / direction outside §3 legal set (e.g. `Table` on class, `OpaqueValue` on a Lua→C# parameter)
- `Table` / `UnpackedValues`: missing/empty **Members**, nonexistent member names, R/W permission mismatch, `?` used outside Table, **`UnpackedValues` on `Nullable<T>`**
- Attribute on undetermined generic positions (§1.1) also falls back on Mono Attribute path (distinct from hard fail on XML/Generate)

**Example:**

```text
[ZLua] Invalid LuaMarshalAs: ...EchoInt(int value)
  parameter 'value' (System.Int32): LuaMarshalType.UserData is not allowed; falling back to Default.
```

### 4.2 Il2Cpp Generate / XML load: config errors may hard-fail

**Il2Cpp Codegen (Generate)** and **MarshalAs XML load** may **fail and abort** on §4.1-class errors (visible in CI / Editor); they do **not** silently write into Player binding tables. Typical text:

```text
[ZLua] LuaMarshalAs configuration error: ...Foo(MyStruct v)
  LuaMarshalType.Table requires non-empty Members.
```

Runtime arity errors (`UnpackedValues` arg slots ≠ list length) remain **`luaL_error`**, unrelated to config fall-back.

## 5. `Table` and `UnpackedValues` (value types)

**Scope:**

| Target | `Table` | `UnpackedValues` |
|--------|---------|------------------|
| Ordinary struct / closed generic struct (not ref struct) | ✓ | ✓ |
| `Nullable<T>` where `T` is such a struct | ✓ (`Members` relative to `T`) | ✗ |
| class / interface / ref struct / primitives / enum | ✗ | ✗ |

**Default behavior:** Does **not** accept Lua tables or multi-stack args to assemble a whole object; must annotate explicitly and provide **`Members`**.

### 5.1 Member list

- Type **`string[]`**; elements are CLR **field names** or **property names**, **mixed OK**.
- **`Nullable<T>` + `Table`:** List resolves on **`T`**, not the `Nullable` wrapper.
- **Order** is semantic order: UnpackedValues stack-slot order; Table R/W traversal order (keys still looked up by **member name**, independent of order).
- Validate: name exists; R/W permissions match current Pop/Push direction (Mono §4.1 / Generate §4.2).

### 5.2 `UnpackedValues` example

```csharp
void Foo([LuaMarshalAs(LuaMarshalType.UnpackedValues, Members = new[] { "Y", "X" })] Vector2 v);
```

```lua
Foo(2.0, 1.0)   -- first slot → Y, second → X; not a table
```

```csharp
[return: LuaMarshalAs(LuaMarshalType.UnpackedValues, Members = new[] { "X", "Y" })]
Vector2 GetPos();
-- Lua: local x, y = CS.Demo.GetPos()
```

### 5.3 `Table` example

```csharp
void Foo([LuaMarshalAs(LuaMarshalType.Table, Members = new[] { "X", "Y" })] Vector2 v);
```

```lua
Foo({ X = 1, Y = 2 })
```

```csharp
void Bar([LuaMarshalAs(LuaMarshalType.Table, Members = new[] { "X", "Y" })] Vector2? v);
```

```lua
Bar(nil)                 -- null Nullable
Bar({ X = 1, Y = 2 })    -- has value
```

### 5.4 (Removed) class assembly

**No longer** supports Table / UnpackedValues for class / interface (see §3).

### 5.5 Nesting limits

If a listed member is itself a struct, it is **not** auto-expanded to table/multi-slot by default; that member type must annotate itself or use the default userdata path (v1 may restrict lists to scalars / enum / string, etc.).

### 5.6 Stack-slot occupancy and calling convention

| `LuaMarshalType` | Lua stack slots occupied by this parameter/return |
|------------------|---------------------------------------------------|
| **`Table`** (and all types except `UnpackedValues`) | **1** |
| **`UnpackedValues`** | **N** (`N = Members.Length`; `?` not applicable) |

- **Lua → C#:** Call bridge advances by **stack cursor**: after reading a parameter, `slot += that parameter's slot count`; must **not** assume “ith CLR parameter ≡ `argStart + i`”.
- **Overload dispatch:** Candidate “Lua argument count” is the sum of each parameter's slot counts (see [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/), **not** raw `parameters_count`).
- **Bind time:** `Members` must resolve to accessible public fields/properties; hot path **forbids** runtime name-based reflection.
- **C# → Lua returns:** `Table` → Push **1** table (`Nullable` no value → `nil`); `UnpackedValues` → Push **N** values in list order (multi-return).

## 6. Optional Table members: `?` suffix

Only when **`LuaMarshalType.Table`** and direction is **Lua → C#**:

- A `Members` element ending in **`?`** (e.g. `"OptionalTag?"`) means an **optional key**.
- Strip trailing `?` to get the CLR member name; if the Lua table **lacks that key**, **skip assignment** (no error).
- struct / valued `Nullable` are **zero-initialized / default** before writes; skipping keeps the **default**; whole `Nullable` as `nil` skips member writes.
- Members **without `?`**: missing key → `luaL_error`.
- **`UnpackedValues` does not support `?`**; missing slots are arity errors.

```csharp
[LuaMarshalAs(LuaMarshalType.Table, Members = new[] { "X", "Y", "Tag?" })]
public struct MyDto { public int X; public int Y; public string Tag; }
```

```lua
Foo({ X = 1, Y = 2 })              -- OK; Tag stays null
Foo({ X = 1, Y = 2, Tag = "a" })   -- OK
Foo({ X = 1 })                     -- missing Y → error
```

## 7. `params T[]` parameters

**Scope:** Only one-dimensional array parameters with **`params`** on **ordinary C# methods / constructors**. `params` on **GetFunction-obtained delegate calls / delegate bridges** remains **unsupported** (see [09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/).

**Relation to szarray:** `params T[]` Marshal matches [01-OVERVIEW.md §4](/docs/spec/marshal/01-OVERVIEW/) szarray (C#→Lua **ByObjUserData**; Lua→C# **ByObjUserData** or **array-shaped table**). Differences are **Lua call shape** and **empty / null semantics**.

**No dedicated `LuaMarshalType`:** No “table-only” or “tail multi-slot collect” annotation; when a table is needed, scripts pass an array-shaped table (same as ordinary szarray).

### 7.1 Behavior (unannotated or `Default`; `OpaqueValue` only affects C#→Lua Push)

| Direction | Rules |
|-----------|-------|
| **C# → Lua** | Same as szarray: Push **`T[]`** as **ByObjUserData** (do **not** unpack to multi slots; do **not** default Push table) |
| **Lua → C#** | **`params` occupies a single stack slot**; Pop **ByObjUserData** or **array-shaped table**, construct / pass **`T[]`** |

**No C#-style implicit expand:** Lua does **not** support auto-collecting **multiple contiguous args after** the `params` parameter into `T[]`. Must pass **exactly one** argument in the `params` position:

| Passed | C# receives |
|--------|-------------|
| **ByObjUserData** (`T[]` instance) | That array reference |
| **table `{}`** (empty array shape) | **`T[0]`** (zero-length) |
| **table `{ … }`** (contiguous keys `1…n`) | **`T[n]`** built from elements |
| **`nil`** | **`null`** (**not** empty array) |

**Examples:**

```csharp
static void Sum(params int[] values) { /* … */ }
static void Prefix(int head, params int[] tail) { /* … */ }
```

```lua
-- ✅ Legal: explicit array userdata
CS.Demo.Sum(arr)                    -- arr is int[] ByObjUserData

-- ✅ Legal: explicit table
CS.Demo.Sum({ 1, 2, 3 })
CS.Demo.Sum({})                     -- zero elements → T[0]
CS.Demo.Prefix(0, { 1, 2 })         -- tail = {1,2}

-- ✅ nil → null (not empty array)
CS.Demo.Sum(nil)

-- ❌ Illegal: multi-slot implicit collect (unsupported)
-- CS.Demo.Sum(1, 2, 3)
-- CS.Demo.Prefix(0, 1, 2)
```

**With overload dispatch:** `params` still counts as **one** parameter slot (stack slots = 1); does **not** fold later slots into the `params` segment (see [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/).

**Vs struct `Table`:** `Table` / `UnpackedValues` assemble members of a **single** value-type parameter (§5); **not** for `params T[]`. The `params` table shape is the **szarray array segment** (integer keys `1…n`); see [07-ARRAY.md](/docs/spec/marshal/07-ARRAY/).

## 8. Resolution priority

Codegen / Mono reflection resolve Pop / Push **fine → coarse**; when Attribute and XML both target the **same** site, **Attribute wins**:

1. **Parameter / return**
   1. `[LuaMarshalAs]` on that slot (if `≠ Default`)
   2. Else corresponding XML `Method` / `Param` or `Return` rule (§9)
2. **Field / property**
   1. `[LuaMarshalAs]` on the member (if `≠ Default`)
   2. Else corresponding XML `Field` / `Property` rule (§9)
3. **Declared type** (`class` / `struct` type-level; **non-generic only**, §1.1)
   1. Type-level `[LuaMarshalAs]` (if `≠ Default`)
   2. Else direct child `MarshalAs` under that XML `Type` (§9)
4. **Built-in defaults in [01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/)**

**No** method-level `[LuaMarshalAs]` / method-level XML `MarshalAs`; configure each parameter/return. If the attribute appears on a method: **Mono** ignores and warns (§4.1); **Il2Cpp Generate** may hard-fail (§4.2).

When any **parameter / return** (or legal type-level) override is **`≠ Default`**, Il2Cpp Codegen emits **dedicated** push/pcall/pop code for that method (or a path with non-Default writers). `Table` / `UnpackedValues` expand `Members` / XML `members` at bind time; **no** runtime reflection.

If annotation is illegal or config is wrong during resolve: **Mono Attribute** always treats as unset and falls back (§4.1); **Il2Cpp Generate / XML** may fail (§4.2).

| Scenario | Default | `[LuaMarshalAs]` / XML override |
|----------|---------|----------------------------------|
| C# calls Lua, struct parameter | OpaqueValue or userdata depending on context | `OpaqueValue` → force OpaqueValue |
| struct parameter | userdata | `Table` / `UnpackedValues` (`Nullable` only `Table`) |
| C# calls Lua, `ref int` | OpaqueValue (default) | No annotation needed; explicit `[OpaqueValue]` legal (byref row) |
| C# calls Lua, by-val `int` + `OpaqueValue` | integer | **Illegal** (primitives are `Default` only); Mono fallback / Generate fails (§4) |
| Lua calls C#, `string` parameter | Lua string | `UserData` → **ByObjUserData** |
| Lua calls C#, `byte[]` parameter | ByObjUserData or table | `Bytes` → Lua string |
| `params T[]` parameter | Same as szarray (single slot) | **No** dedicated override; may only annotate `OpaqueValue` (C#→Lua) |

## 9. XML external config (precompiled / AOT assemblies)

> **Motive:** Many assemblies are precompiled DLLs and cannot add `[LuaMarshalAs]`. XML provides **equivalent** external Marshal rules.
> **Scope:** XML is **only** for **non–hot-update** assemblies (precompiled / AOT DLLs). **Hot-update assemblies** (including HybridCLR hot-update DLLs) support **only** in-code `[LuaMarshalAs]`; configuring Marshal rules for them via XML is **not** supported.
> **Separate from `[LuaAlias]`:** Method aliases use an **independent** Settings path and root element (see [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §5.4); **do not** mix with this file.
> **Platform:** Mono (Editor) **loads and parses XML at runtime**; Il2Cpp (Player) **forbids** runtime XML parse—build time (`ZLua/Generate/All`, etc.) **generates C++ tables/data** from XML; runtime only looks up tables.
> **Semantics:** Mono and Il2Cpp Lua-visible results must match.

### 9.1 Config entry (Settings)

Path lists live in Editor **`ZLua.Settings`** (`ProjectSettings/ZLua.asset`), e.g.:

- `marshalAsXmlPaths`: relative-to-project-root or absolute paths; files or directories. **Only** carries `ZLuaMarshalAs` rules
- **`luaAliasXmlPaths`:** method-alias path list (**configured separately**); see [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §5.4
- Directories: recursively include `*.xml` under that directory (implementations may use one level only; docs treat “the path set listed in Settings” as authoritative)

No paths configured → no XML Marshal rules (Attribute + defaults only). Missing / unreadable paths → **fail** (clear Editor error; Generate aborts).

### 9.2 File format

Root element:

```xml
<?xml version="1.0" encoding="utf-8"?>
<ZLuaMarshalAs version="1">
  <!-- Assembly / Type / … -->
</ZLuaMarshalAs>
```

| Constraint | Notes |
|------------|-------|
| `version` | Required; currently only `"1"`. Unknown version → **fail** |
| Encoding | UTF-8 |
| Multiple files | All files listed in Settings merge into one rule set; see §9.5 duplicate detection |

### 9.3 Schema (elements)

```xml
<ZLuaMarshalAs version="1">
  <Assembly name="UnityEngine.CoreModule">
    <!-- Type-level: equivalent to [LuaMarshalAs] on the type -->
    <Type fullName="UnityEngine.Vector3">
      <MarshalAs type="Table" members="x,y,z" />
    </Type>

    <Type fullName="UnityEngine.Transform">
      <Method name="LookAt" signature="(UnityEngine.Vector3)">
        <!-- index: 0-based, excludes this; do not use name -->
        <Param index="0">
          <MarshalAs type="UnpackedValues" members="x,y,z" />
        </Param>
      </Method>

      <Method name="get_position" signature="()">
        <Return>
          <MarshalAs type="Table" members="x,y,z" />
        </Return>
      </Method>
    </Type>

    <Type fullName="MyGame.Net.Packet">
      <Field name="Body">
        <MarshalAs type="Bytes" />
      </Field>
      <Property name="Title">
        <MarshalAs type="UserData" />
      </Property>
    </Type>
  </Assembly>
</ZLuaMarshalAs>
```

| Element / attribute | Meaning |
|---------------------|---------|
| `Assembly/@name` | `Assembly.GetName().Name` (not path, not `.dll` filename) |
| `Type/@fullName` | CLR full name: `Namespace.Type`; nested `Outer+Inner`; generic declaring types write **open definition** ``Foo`1`` (member-mount container only; §9.3.1). **Forbid** closed instance names as `Type` containers |
| `Method/@name` | Method name (CLR `Name`, no signature) |
| `Method/@signature` | Parameter type list in **parentheses**, same style as [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §5.4: no-arg `()`; with args `(T1,T2)`; byref types append `&`; arrays `T[]`. **Excludes** return type. Types in the signature must match metadata (closed writes closed full names; parameter `T` only when the method signature itself is that way—but slots with undetermined types must **not** have `MarshalAs`) |
| `Param/@index` | **Required**; `0`-based; **excludes** instance `this`. Must **not** locate by parameter name |
| `Return` | Equivalent to `[return: LuaMarshalAs(...)]` |
| `Field/@name` / `Property/@name` | CLR member names |
| `MarshalAs/@type` | `LuaMarshalType` name: **`Default` / `UserData` / `Bytes` / `OpaqueValue` / `UnpackedValues` / `Table`** (same as §1 enum; **use `OpaqueValue`**, not historical `OpaqueLightUserData`). Unknown or removed type names (e.g. historical **`ParamsTable`**) → **fail** |
| `MarshalAs/@members` | Corresponds to `Members`: comma-separated; `?` suffix for optional Table keys (§5/§6). **Required** for `Table` / `UnpackedValues`; other types omit or ignore with a warning |

**Separate from aliases:** Method aliases live in **`ZLuaAlias` / `luaAliasXmlPaths`** (see [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §5.4), not this file. Root must be **`ZLuaMarshalAs`**.

#### 9.3.1 Generics (same as §1.1)

| Correct | Incorrect |
|---------|-----------|
| `void Foo([LuaMarshalAs(Bytes)] List<int> arr)` / XML Param pointing at that closed parameter | `[LuaMarshalAs] class MyList<T>`; type-level XML `MarshalAs` on ``MyList`1`` |
| XML `Type fullName="MyList`1"` configuring **closed** Field/Param under it | `void Foo([LuaMarshalAs] T a)`; Field type `T` / `List<T>` still with `MarshalAs` |
| Type-level Attribute / XML on non-generic types | Expecting `List<int>` to inherit type-level rules from ``List`1`` |

**Forbidden:**

- Hanging `MarshalAs` directly on `Method` (no “method-level” override)
- Locating `Param` with a `name` attribute
- XML `type` using deprecated `OpaqueLightUserData` string → **fail** (must be `OpaqueValue`)
- XML `Type/@fullName` as a closed generic instance name → **fail** (members hang on open definition / non-generic declaring type)
- Type-level or member-level rules on **undetermined** types → **fail** (§1.1)

### 9.4 Parse and validation

On load (Mono XML parse / Il2Cpp Generate):

1. XML syntax errors, unknown `version`, unknown elements / missing required → **fail**
2. (**Metadata validation timing**) Mono: when that assembly is **first queried** for lazy bind; Il2Cpp: at **Generate** (runtime no longer reports config errors)—`Assembly` / `Type` / `Method` / `Field` / `Property` **unresolvable** → **fail**
3. `Type` resolves to a **closed generic instance** → **fail**
4. Type-level `MarshalAs` on a **generic type** → **fail** (§1.1)
5. Field / Property / Param / Return target CLR type **undetermined** → **fail** (§1.1)
6. `MarshalAs` not in §3 legal set for target CLR type → Generate/XML: **fail**; Mono runtime Attribute path uses §4.1 instead
7. `Table` / `UnpackedValues` missing `members`, or `UnpackedValues`+`Nullable` → Generate/XML: **fail** (§4.2)

> Il2Cpp generated tables contain **names only** (assembly / type / method+signature / param index); do **not** embed metadata tokens (tokens change across stripping).

### 9.5 Duplicate rules (severe error)

After merging all Settings XML, if any **target key** has **two or more** effective `MarshalAs` rules → **entire load / Generate fails** (later files must not override):

| Target key | Composition |
|------------|-------------|
| Type-level | `(assemblyName, typeFullName, kind=Type)` |
| Field | `(assemblyName, typeFullName, kind=Field, memberName)` |
| Property | `(assemblyName, typeFullName, kind=Property, memberName)` |
| Parameter | `(assemblyName, typeFullName, methodName, signature, kind=Param, index)` |
| Return | `(assemblyName, typeFullName, methodName, signature, kind=Return)` |

Duplicates within one file also fail. Error messages must include file path and conflicting key for diagnosis.

> **Note:** Attribute and XML targeting the same site is **not** a “duplicate fail”—§8 **Attribute wins**; that XML entry may be recorded as unused (optional diagnostics) without aborting load.

### 9.6 Mono (Editor) runtime

- **Only load / parse XML** from Settings paths (including §9.5 duplicate detection), group by `Assembly/@name`; do **not** resolve metadata tokens at startup.
- Lookup tables (lazily created and validated on that assembly's **first** query):
  - **Type / Field / Property:** `Assembly` → `memberToken` → `Rule`
  - **Param / Return:** `Assembly` → `(methodDefToken, index)` → `Rule`
    - Param: `index` is XML `@index` (`0`-based)
    - Return: `index = -1`
    - Do **not** depend on ParamDef / ReturnParameter metadata tokens (often absent on Mono)
- Hot path O(1) table lookup; do **not** string-match.
- Lookup API shares resolution layer with Attribute: `TryAttribute` (may still use param token if present) then `TryXml`.
- May provide Editor menu “Reload MarshalAs XML”; changing files does not auto-guarantee hot reload (docs do not require it).

### 9.7 Il2Cpp: XML → C++ (build time)

- **Generate must not write metadata tokens:** DLLs are not stripped yet; tokens would disagree with final AOT metadata; and there is no “post-strip AOT DLL” callback. Artifacts remain name-keyed `LuaMarshalAsXmlEntry` (assembly / type / method+signature / param index, etc.).
- **Build-time validation:** `MarshalAsCodegen` (or equivalent) runs the same resolution checks as Mono bind at Generate (type exists, §1.1 determined, type-level non-generic, etc.) → **fail aborts Generate**. Player **runtime** no longer fails on XML config.
- Runtime: `RegisterMarshalBindingTables()` only registers entries; resolve names **lazily** per assembly into tables isomorphic to Mono (member tokens; Param/Return as `methodDef.token + index`, Return index=-1).
- Player must **not** open or parse XML files.
- Lookup: after Attribute miss, query XML; type-level Attribute/XML **skips** generic types (§1.1).

### 9.8 Sync with source enum names

Docs and XML use **`LuaMarshalType.OpaqueValue`**. If implementation C# enums still use historical `OpaqueLightUserData`, **rename to `OpaqueValue`** and replace references globally to match §1.

## 10. Related docs

| Topic | Doc |
|-------|-----|
| Default matrix | [01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/) |
| OpaqueValue | [04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/) |
| struct Marshal | [05-STRUCT.md](/docs/spec/marshal/05-STRUCT/) |
| Arrays / Bytes | [07-ARRAY.md](/docs/spec/marshal/07-ARRAY/) |
| Enum boxed | [08-ENUM.md](/docs/spec/marshal/08-ENUM/) |
| Method-alias XML (style reference) | [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §5.4 |
