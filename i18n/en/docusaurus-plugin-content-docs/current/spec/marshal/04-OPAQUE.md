---
sidebar_position: 10
title: "OpaqueValue (Temporary Opaque Parameter)"
---

# OpaqueValue (Temporary Opaque Parameter)

> **Normative:** When C# calls Lua, a temporary token exposing a parameter/local storage address on the C# call stack to script; and the forced path via `[LuaMarshalAs(OpaqueValue)]`.
> **byref default (C#→Lua):** `ref`/`in`/`out` parameters **default** to OpaqueValue; see [03-BYREF.md §2](/docs/spec/marshal/03-BYREF/).
> **API:** `zlua.get_opaquevalue` / `zlua.set_opaquevalue` (native: `__zlua_get_opaquevalue` / `__zlua_set_opaquevalue`); signatures in [../05-LIB.md](/docs/spec/05-LIB/).

## 1. Definition

OpaqueValue is a temporary token that, when **C# calls Lua**, exposes a **parameter/local storage address on the C# call stack** to script. Within **this call's lifetime**, the script may read and write back; when the **target parameter type allows**, the handle may also be passed **as-is** as a **Lua→C#** argument (§6). It must **not** be persisted across calls.

Annotating a parameter/return with **`[LuaMarshalAs(LuaMarshalType.OpaqueValue)]`** **forces** Push OpaqueValue ([02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/); **`ref` / `out` / `in`** parameters on the C#→Lua path **default** to OpaqueValue (§3).

## 2. Lua-visible shape

| Item | Rules |
|------|-------|
| Lua type | **lightuserdata** |
| Payload | **handle** (encodes `generation + index`); same as `lua_pushlightuserdata` / `lua_touserdata` |
| Platform | Pack into `void*` with 32/64-bit width; do **not** assume fixed 64-bit |
| metatable | **None**; cannot access members with `:` / `.` |

Scripts treat it as a **temporary handle that cannot self-dereference**; R/W must go through `zlua.get_opaquevalue` / `zlua.set_opaquevalue` (§5).

Unlike long-lived **ByObjUserData / StructUserData**, OpaqueValue does **not** register in the object table or copy into separate userdata; it only exposes “the parameter location on the current call stack”.

## 3. Production direction and expressible types

| Rule | Notes |
|------|-------|
| **Created only on C# → Lua** | Pushed only by native on the C#→Lua marshal path; **no** Lua API to forge a valid handle |
| **Parameters that can produce OpaqueValue** | ① **`ref` / `in` / `out T`** (**any** `T`) — **default** OpaqueValue (§3.1); ② **by-val** types in the legal set of [02-MARSHAL-AS.md §3](/docs/spec/marshal/02-MARSHAL-AS/) — annotate `[LuaMarshalAs(OpaqueValue)]` to Push Opaque. **Primitives** and **`IntPtr` / `UIntPtr` / `nint` / `nuint`** **must not** use by-val `OpaqueValue` (`Default` only) |
| **Direction limit** | `OpaqueValue` annotation is **C#→Lua only**; on a pure Lua→C# parameter it is illegal (see [02-MARSHAL-AS.md §3.1](/docs/spec/marshal/02-MARSHAL-AS/)) |
| Slot meaning | `valueAddress` points at that argument's storage on the **current C# stack frame** (by-val = value slot; `ref`/`in`/`out` = **pointer slot**) |

### 3.1 `ref` / `out` / `in` default to OpaqueValue

| Direction | Rules |
|-----------|-------|
| **C# → Lua** | When parameter is **`ref` / `out` / `in T`**, **default** Push **OpaqueValue** (register byref type + pointer-slot address); **no** need to annotate `OpaqueValue` again |
| **Non-byref** | Default follows [01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/); Push Opaque only when the type allows `OpaqueValue` per [02-MARSHAL-AS.md §3](/docs/spec/marshal/02-MARSHAL-AS/). **Primitives / `IntPtr` family by-val must not annotate** |

Thus a Lua callback receiving `ref int x` gets a **lightuserdata handle**, not an integer; use §5 APIs to read/write. When passing to another C# method: for **struct / managed reference** parameters, pass the handle **as-is** (§6); for **simple types like `int`**, you **must** `get_opaquevalue` first (§6).

## 4. Lifetime and no persistence

| Rule | Notes |
|------|-------|
| Validity | **Only** while the producing **C#→Lua** call has not returned (synced with OpaqueParameterScope / generation) |
| Usable inside callback | Within the same callback: `get` / `set`; and as **Lua→C#** args per §6 |
| **Must not save** | Must **not** write to globals, upvalues, or table fields and then use in **async**, **later pcall**, or **after C# returned** |
| After invalidation | `get` / `set` / Pop as argument (auto-unwrap path) → **error** (`invalid opaque parameter handle`) |

```lua
-- During C#→Lua callback:
function OnTick(h)                      -- h = OpaqueValue (e.g. ref int)
    local v = zlua.get_opaquevalue(h)   -- OK
    zlua.set_opaquevalue(h, v + 1)      -- OK
    CS.Demo.UseInt(v)                   -- OK: simple types must unwrap first
    -- CS.Demo.UseInt(h)                -- illegal: int param does not auto-recognize OpaqueValue
end

function OnPoint(h)                     -- h = OpaqueValue (e.g. Point2D / ref Point2D)
    CS.Demo.UsePoint(h)                 -- OK: struct param auto-unwraps OpaqueValue (§6)
    local p = zlua.get_opaquevalue(h)   -- or unwrap then pass / access members
    print(p:GetSum())
end
-- Holding h after C# returns → error on next use
```

**Long lifetime:** Use **`zlua.to_user_data(opaque)`** (**copy** to StructUserData / ClassUserData) or the C#→Lua default StructUserData Push path; see [05-STRUCT.md](/docs/spec/marshal/05-STRUCT/).

## 5. R/W API: `get_opaquevalue` / `set_opaquevalue`

OpaqueValue has **no** member access; script R/W of pointed memory goes through these APIs.

### 5.1 `zlua.get_opaquevalue(opaque_handle) → value`

Push the parameter pointed to by the handle using **default C#→Lua** rules and return it (Lua wrappers usually return a single value):

| Handle points to | Behavior |
|------------------|----------|
| **Not** `ref`/`in`/`out` | Default marshal Push of the slot value per [01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/) (e.g. `int` → integer, `string` → string) |
| **`ref` / `in` / `out T`** | **Dereference** the pointer slot first, then default Push of **`T`** (byref stripped). Example: `ref int` → **integer**, **not** a pointer / lightuserdata |

### 5.2 `zlua.set_opaquevalue(opaque_handle, new_value)`

Update the parameter pointed to by the handle with `new_value`:

| Handle points to | Behavior |
|------------------|----------|
| **Not** `ref`/`in`/`out` | Write slot via [01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/) **default Lua→C#** marshal |
| **`ref` / `in` / `out T`** | **Dereference** first, then write target memory with **`T`** default Lua→C# rules. Example: `ref int` ← integer |

```lua
function OnRefInt(h)
    local x = zlua.get_opaquevalue(h)   -- integer
    zlua.set_opaquevalue(h, x + 10)
end
```

Expired / non-lightuserdata / corrupted handle → `luaL_error`.

## 6. Passing back as Lua→C# arguments (split by target type)

While the handle is **still valid** in a sync chain, scripts may use OpaqueValue for **Lua→C#** parameters. To keep hot paths cheap, **not** every target type probes lightuserdata for OpaqueValue on Pop:

| Target C# parameter type (element after stripping byref) | Auto-unwrap OpaqueValue on Lua→C#? | Script practice |
|----------------------------------------------------------|------------------------------------|-----------------|
| **Managed reference types:** ordinary `class`, `string`, `delegate`, arrays, boxed struct (`object` / ByObj boxed value types), etc. | **Yes** | Pass handle **as-is**; after check + type compatibility, **copy / bind** from registered `valueAddress` into target slot |
| **`struct` (ordinary value-type struct, not enum)** | **Yes** | Same; typical zero-copy / same-slot pass-back |
| **Simple types:** `bool`, `char`, integers, `float`/`double`, `IntPtr`/`UIntPtr`, **enum**, etc. | **No** | Pop does **not** check OpaqueValue. Must `zlua.get_opaquevalue(h)` first to get the default-marshaled Lua value (e.g. integer), then pass |

```lua
-- struct / class: auto-unwrap
function OnOpaquePoint(h)
    CS.Demo.AcceptPoint(h)                          -- OK
end

-- int / enum etc.: no auto-unwrap
function OnOpaqueInt(h)
    CS.Demo.AcceptInt(zlua.get_opaquevalue(h))      -- OK
    -- CS.Demo.AcceptInt(h)                         -- fails
end
```

| Detail | Notes |
|--------|-------|
| **Performance motive** | Primitive Pop is extremely hot; probing OpaqueValue every time would slow all `int`/`float` Marshal |
| **byref** (`ref`/`in`/`out` A) | **Always** follow [03-BYREF.md](/docs/spec/marshal/03-BYREF/): recognize OpaqueValue **first**; if type-compatible, **pass address** (including `ref int`); do **not** apply the “simple types no auto-unwrap” row above |
| **by-val simple types** | “No” in the table: must `get_opaquevalue` then pass |
| **Type compatibility** | Opaque→byref / auto-unwrap must be compatible with target type, else error (forbid `ref object` Opaque → `ref int`) |
| **Expired handle** | OpaqueValue validation runs only on paths that **auto-unwrap** |
| **Member access** | APIs expecting **ByObjUserData / StructUserData** must **not** use `:` / `.` on opaque; `get_opaquevalue` first, or pass to a C# parameter of that type so the binder auto-unwraps |

## 7. Relation to struct Handle path

The default C#→Lua by-val path for structs may also produce OpaqueValue (lightuserdata handle) within a sync call chain, same shape as §2. Scripts **must not** field/method-access opaque; they must:

- `zlua.get_opaquevalue` / `zlua.set_opaquevalue`; or
- `zlua.to_user_data(opaque)` **copy** to StructUserData then `:` / `.`; or
- Pass **as-is** to C# parameters of types allowed by §6.

Struct shapes: [05-STRUCT.md](/docs/spec/marshal/05-STRUCT/).

## 8. Design summary

| Dimension | Conclusion |
|-----------|------------|
| Created only C#→Lua | Address comes from C# call stack; Lua cannot forge a valid slot |
| Who can be Opaque | **`ref`/`in`/`out` (any T)** by default; by-val per [02-MARSHAL-AS.md §3](/docs/spec/marshal/02-MARSHAL-AS/) (**primitives / `IntPtr` family forbid** by-val `OpaqueValue`) |
| No metatable | Avoid mistaken userdata member access; force get/set |
| No cross-call save | `generation` blocks expired use-after-return |
| get dereferences byref | `ref int` appears as int to script, matching default-marshal mental model |
| Lua→C# auto-unwrap split | **Only** struct / managed reference Pop recognizes OpaqueValue; simple types need `get_opaquevalue` first |

## 9. Related docs

| Topic | Doc |
|-------|-----|
| Lua→C# byref | [03-BYREF.md](/docs/spec/marshal/03-BYREF/) (Opaque / ByValUserData pass address; others temp slot) |
| `[LuaMarshalAs(OpaqueValue)]` | [02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/) |
| struct ByVal / StructUserData | [05-STRUCT.md](/docs/spec/marshal/05-STRUCT/) |
| `zlua.*` signatures | [../05-LIB.md](/docs/spec/05-LIB/) |
| Implementation | [../../impl/marshal/](/docs/impl/marshal/) |
