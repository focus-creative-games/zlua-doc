---
sidebar_position: 12
title: "Class / Interface Marshal"
---

# Class / Interface Marshal

> **Normative:** Default Marshal rules for reference types (`class`, `interface`, `string`, array instances, delegate instances, etc.) between Lua and C#.
> **Related:** Type tables and member access → [`../02-TYPE-SYSTEM.md`](/docs/spec/02-TYPE-SYSTEM/); `ref`/`out`/`in` overview → [`03-BYREF.md`](/docs/spec/marshal/03-BYREF/); `[LuaMarshalAs]` → [`02-MARSHAL-AS.md`](/docs/spec/marshal/02-MARSHAL-AS/); `zlua.cast` → [`../05-LIB.md`](/docs/spec/05-LIB/).

**Platform principle:** Mono and Il2Cpp share the same **Lua-visible semantics**; class instances default to **GCHandle + full userdata** (Il2Cpp: `ObjectRegistry` + `Il2CppObject*`).

## 1. Default Marshal (summary)

Without `[LuaMarshalAs]`, reference types follow the overview matrix in [`01-OVERVIEW.md`](/docs/spec/marshal/01-OVERVIEW/); this section adds class / interface semantics.

| Direction | Lua shape | Notes |
|-----------|-----------|-------|
| **C# → Lua** | **ClassUserData** (ByObj full userdata) | Reference identity; **IMT façade = declared type** (see §2) |
| **Lua → C#** | ClassUserData or **`nil`** | Must be assignable to target **declared type**; `nil` ↔ `null` |
| **`string`** | Lua **`string`** or **`nil`** | **Only when declared type is `string`**; declared as `object` → still Object userdata |
| **`interface`** | Same as class | Façade = **interface declared type** (not implementing class); see §2, §4 |
| **Array** | ByObjUserData | See [`07-ARRAY.md`](/docs/spec/marshal/07-ARRAY/) |
| **Delegate** | function or DelegateUserData | See [`09-FUNCTION.md`](/docs/spec/marshal/09-FUNCTION/) |

**UserData shape:** ClassUserData is **full userdata** from `lua_newuserdata` + instance metatable `IMT`; scripts access members via `:` / `.`. Differs from OpaqueValue in [`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/) (lightuserdata, no metatable) and Pointer in [`10-POINTER.md`](/docs/spec/marshal/10-POINTER/).

Field, method, and static member access details: [`../02-TYPE-SYSTEM.md`](/docs/spec/02-TYPE-SYSTEM/) and [`../metatable/`](/docs/spec/metatable/).

## 2. Declared-type façade (View vs actual type)

For all **reference type** parameters, return values, and fields/properties (`class` / `interface` / `object` / arrays / delegates, etc.), Marshal distinguishes **Identity** and **View**:

| Concept | Meaning |
|---------|---------|
| **Identity** | Managed object reference in userdata payload (runtime **actual instance**) |
| **View / façade** | **IMT** and member visibility on userdata; default = **declared type of this Marshal**; with return `ActualTypeUserData` = **runtime actual type** |

### 2.1 Rules

1. **C# → Lua (default):** Always choose default marshal shape and ByObj IMT by **declared type**; do **not** reattach a more specific runtime type's mt, and do **not** switch to special Marshal such as `string` (e.g. a `string` instance on an `object` parameter remains Object userdata, not Lua string).
2. **Exception: `[return: LuaMarshalAs(ActualTypeUserData)]`:** Still Push **ByObj UserData**, but **façade / viewKlass = runtime actual type**; actual `string` remains ByObj (not Lua string). See [`02-MARSHAL-AS.md`](/docs/spec/marshal/02-MARSHAL-AS/). No separate dispatch changes: IMT is already on the actual type.
3. **Value types:** No inheritance-façade issue; follow [`05-STRUCT.md`](/docs/spec/marshal/05-STRUCT/) etc.
4. **Virtual methods:** Member lookup uses `MethodInfo` on the **current userdata view (façade type)**; call does **vtable dispatch** on the real `this` (`override` still lands on the implementing class). Default view = declared type; with `ActualTypeUserData`, view = actual type.
5. **Non-virtual / `new` hide:** Use **view**-type slot (calling `new`-hidden `Bar` via `Base` façade yields `Base.Bar`).
6. **Downcast:** [`zlua.cast`](/docs/spec/05-LIB/) (`IsAssignableFrom(targetType, obj.klass)`); returns **new userdata** (same identity, new façade). Complements `ActualTypeUserData`: script-side façade change vs Push-time actual-type façade.
7. **Object cache:** Key is **`(identity, viewType)`**; one instance may have multiple view userdata.

### 2.2 Example

```csharp
Base CreateChild() => new Child();

[return: LuaMarshalAs(LuaMarshalType.ActualTypeUserData)]
Base CreateChildActual() => new Child();
```

```lua
local o = ObjectFactory.CreateChild()         -- façade Base: Child.y invisible; new Bar → Base.Bar
local c = zlua.cast(o, Child)                 -- façade Child (requires IsAssignableFrom)
local a = ObjectFactory.CreateChildActual()   -- façade already Child (ActualTypeUserData)
```

Virtual methods look up `MethodInfo` via the current façade, then **virtual-dispatch** on the real instance.

### 2.3 `object` parameters

| Item | Rules |
|------|-------|
| Push | **ClassUserData**, façade **`System.Object`** |
| Pop | Accepts boolean / number / string / userdata |
| Runtime type | Does **not** rewrite Marshal by runtime type (runtime `string` stays Object userdata) |

For `Nullable<T>` where `T` is a reference type, `null` ↔ `nil`; when present, same class rules as `T`. See [`01-OVERVIEW.md`](/docs/spec/marshal/01-OVERVIEW/).

## 3. `Table` / `UnpackedValues` (not for class / interface)

**class** and **interface** **disallow** `[LuaMarshalAs(Table)]` / `[LuaMarshalAs(UnpackedValues)]` (legal set: [`02-MARSHAL-AS.md`](/docs/spec/marshal/02-MARSHAL-AS/) §3). Reference types keep default **ByObjUserData** and member access.

On misuse: **Mono** error-logs and falls back to `Default`; **Il2Cpp Generate / XML** may hard-fail.

## 4. Interface Marshal

| Item | Rules |
|------|-------|
| **Default** C# ↔ Lua | **ByObjUserData** (ClassUserData); façade = **interface declared type** (not implementing class) |
| `nil` | ↔ `null` |
| `[LuaMarshalAs]` | `UserData`, `OpaqueValue`, return-only `ActualTypeUserData` (**no** `Table` / `UnpackedValues`) |
| Member access (default userdata) | Only members visible on the interface + inherited interfaces; implementing-class-only members invisible (after `ActualTypeUserData` return, façade = implementing class, so its members are visible) |

## 5. `ref` / `out` / `in` reference-type parameters (Lua → C#)

Overview: [`03-BYREF.md`](/docs/spec/marshal/03-BYREF/). Reference types (including `string`) points:

| Lua argument | Behavior |
|--------------|----------|
| **OpaqueValue** (compatible with A) | Pass handle address (can write back to original slot) |
| **ByObjUserData** / Lua `string` (only when A is `string`) / `nil` / other Pop-able shapes | Obtain managed pointer (or `null`) → write **stack temporary** → pass temp address |

### 5.1 Write-back: temp slot ⇒ no rebind

| C# operation | Lua side (temp-slot path) |
|--------------|---------------------------|
| `refParam = otherObject` (**rebind**) | **Not visible** |
| In-place mutation of a **mutable object** | **Visible** (same managed object) |
| Assign new string to `ref string` | **Not visible** (same as rebind) |

```lua
local s = "hello"
CS.Demo.ChangeString(s)   -- void ChangeString(ref string s) { s = "world"; }
-- s is still "hello"

local sb = StringBuilder("hi")
CS.Demo.Append(sb, "!")   -- shared reference; content mutable
```

### 5.2 C# → Lua

`ref`/`out`/`in` **default Push OpaqueValue**; see [`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/).

## 6. `string` Marshal notes

| Declared type | C# → Lua | Lua → C# |
|---------------|----------|----------|
| **`string`** | Lua **string** | Lua **string** or **`nil`** |
| **`object`** (runtime `string`) | **Object userdata** (façade `System.Object`) | object Pop rules |
| **`[LuaMarshalAs(UserData)]` on `string`** | **ByObjUserData** (managed `System.String` object) | Force userdata path |

`[LuaMarshalAs(Bytes)]` is for **`byte[]`** ↔ Lua string, not `System.String`; see [`07-ARRAY.md`](/docs/spec/marshal/07-ARRAY/).

## 7. Mono / Il2Cpp consistency

| Item | Requirement |
|------|-------------|
| Default Push / Pop | ClassUserData; `nil` ↔ `null` |
| Façade `(identity, viewType)` | Same on both platforms |
| `zlua.cast` | Same identity, new view |
| C#→Lua byref | OpaqueValue ([`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/)) |
| Error messages | Same or equivalent |

## 8. Related docs

| Doc | Contents |
|-----|----------|
| [`01-OVERVIEW.md`](/docs/spec/marshal/01-OVERVIEW/) | Default Marshal matrix |
| [`03-BYREF.md`](/docs/spec/marshal/03-BYREF/) | `ref` / `in` / `out` overview |
| [`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/) | C#→Lua byref default OpaqueValue |
| [`07-ARRAY.md`](/docs/spec/marshal/07-ARRAY/) | Array ByObjUserData |
| [`09-FUNCTION.md`](/docs/spec/marshal/09-FUNCTION/) | Delegate Marshal |
| [`../02-TYPE-SYSTEM.md`](/docs/spec/02-TYPE-SYSTEM/) | Type tables, IMT, member access |
| [`../05-LIB.md`](/docs/spec/05-LIB/) | `cast`, `box`, `inflate` / GTAP |
