---
sidebar_position: 2
title: "Host API"
---

# 01 — Host API

> `LuaAppDomain` (including **`GetFunction`**), **`[LuaMarshalAs]`**, **`[LuaAlias]`**.
> C#→Lua / Lua→C# Marshal details: [marshal/](/docs/spec/marshal/).

---

## 1. `LuaAppDomain`

### 1.1 Responsibilities

`ZLua.LuaAppDomain` is the only recommended host initialization façade. Common does **not** reference Mono/Il2Cpp; on `Initialize` / `GetFunction` it **reflectively creates** the backend nested type `Runtime : ILuaRuntime` for the current environment:

| Environment | Backend host type | Assembly | Creation |
|-------------|-------------------|----------|----------|
| Editor | `LuaMonoAppDomain` | `ZLua.Mono` | `Activator.CreateInstance(…+Runtime)` |
| Player | `LuaIl2CppAppDomain` | `ZLua.Il2Cpp` | Same (`#if !UNITY_EDITOR` branch) |

```csharp
public interface ILuaRuntime
{
    void Initialize(Func<string, object> moduleLoader);
    void ProcessPendingRefReleases();
    Delegate GetFunction(Type delegateType, string luaModule, string luaMethodName);
}

public static class LuaAppDomain
{
    public static void Initialize(Func<string, object> moduleLoader);

    public static T GetFunction<T>(string luaModule, string luaMethodName)
        where T : MulticastDelegate;

    internal static void ProcessPendingRefReleases(); // Driven by LuaFramePump
}
```

Does **not** use `RuntimeInitializeOnLoadMethod` / `SetRuntime` for implicit registration; the backend is resolved on the first `Initialize` (or `GetFunction`).

### 1.2 Module loader

`moduleLoader(moduleName)` is provided by the host and returns Lua module source (usually a `string`). Native integrates it with `__zlua_load_module` and package.searchers.

**Conventions:**

- Module names match the `luaModule` string passed to `GetFunction`
- Loader failures should throw a clear exception; avoid silent nil

### 1.3 Frame pump

`LuaAppDomain.Initialize` registers `LuaFramePump`, which calls `ProcessPendingRefReleases` on Unity `Update` (and similar) to handle deferred release of delegates / Lua refs. See [10-LIFETIME.md](/docs/spec/10-LIFETIME/).

### 1.4 Editor debugger (optional)

**Editor Mono only:** if Settings `enableDebugger` is true, `LuaMonoAppDomain.Initialize` calls `LuaEnv.StartDebugger` after the normal init completes (inject `emmy_core`, `tcpListen`, optional `waitIDE`). Spec: [build/04-EMMYLUA-DEBUGGER.md](/docs/spec/build/04-EMMYLUA-DEBUGGER/). Does **not** change `GetFunction` / Marshal semantics; Il2Cpp Player does **not** use this entry point.

---

## 2. `GetFunction` — C# calling Lua

The **only formal entry** for C#→Lua: obtain a bound **Delegate** by module and method name, then the caller `Invoke`s (or calls it directly).

### 2.1 Signature

```csharp
public static T GetFunction<T>(string luaModule, string luaMethodName)
    where T : MulticastDelegate;
```

| Parameter | Description |
|-----------|-------------|
| `luaModule` | Non-empty; module name passed to `moduleLoader` / `require` |
| `luaMethodName` | Non-empty; key in the module’s `return { ... }` table |
| `T` | Concrete delegate type (e.g. `Action`, `Action<float>`, `Func<int,int,int>`) |

### 2.2 Behavior

1. Load (or hit cache for) the module table for `luaModule`
2. Read `module[luaMethodName]`; must be a Lua `function`
3. **Marshal** the function to a closed delegate matching `T`’s signature (same rules as [marshal/09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/))
4. Return that `T` instance

**Caching:** The API does **not** guarantee reusing the same delegate instance across calls; hot paths should cache locally (field / local). Call only **after** `Initialize` (e.g. `Awake`); do **not** put it in a static field initializer of the same kind as `RuntimeInitializeOnLoadMethod`.

### 2.3 Examples

```csharp
// One-shot / startup obtain
var add = LuaAppDomain.GetFunction<Func<int, int, int>>("app", "add");
int sum = add(10, 20);

var onTick = LuaAppDomain.GetFunction<Action<float>>("game", "OnTick");
onTick(0.016f);
```

```lua
-- app.lua
local function add(a, b) return a + b end
return { add = add }
```

### 2.4 Errors

| Condition | Behavior |
|-----------|----------|
| Not `Initialize`d / loader not configured | Throw C# exception |
| Module load failure / missing key / not a function | Throw C# exception (with diagnostic info) |
| `T` cannot bind from that function (incompatible signature, etc.) | Throw C# exception |

### 2.5 Invoke and Marshal

When `Invoke`ing the returned delegate:

- Argument / return Marshal matches ordinary **C#→Lua (delegate bridge)**; see [marshal/01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/)
- **`ref` / `in` / `out` default to Push OpaqueValue** ([marshal/04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/))

### 2.6 Flow (conceptual)

```
GetFunction<T>(module, method)
  → require / get module table
  → get Lua function
  → Marshal to T
  → return T

Thereafter: T.Invoke(...)
  → marshal args (including ref → OpaqueValue)
  → lua_pcall
  → marshal returns / write back refs
  → exception boundary translation (§6)
```

Il2Cpp C# init remains a thin shell (unrelated to `GetFunction`):

```csharp
public static class LuaIl2CppAppDomain
{
    [MethodImpl(MethodImplOptions.InternalCall)]
    private static extern void InitializeInternal(Func<string, object> moduleLoader);

    public static void Initialize(Func<string, object> moduleLoader)
        => InitializeInternal(moduleLoader);
}
```

---

## 3. `[LuaMarshalAs]` — Marshal annotation

### 3.1 Scope

| Annotatable site | Description |
|------------------|-------------|
| **Parameter** | Controls Push/Pop for that formal parameter Lua↔C# |
| **Return value** | Controls C#→Lua return Push |
| **Field / property** | Controls marshal on member read/write (consumed by codegen) |

**Forbidden** on **methods** (`LuaMarshalAsConfigurationException` at bind time).

Full options: [marshal/02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/).

### 3.2 Common options (summary)

| `LuaMarshalType` | Use |
|------------------|-----|
| `Default` | Type default rules |
| `OpaqueValue` | Force opaque lightuserdata C#→Lua (by-val reference types / struct) |
| `Table` / `UnpackedValues` | **struct / closed generic struct** only; `Table` also allows **`Nullable<struct>`** (requires `Members`) |

**Default rules summary:**

- C#→Lua **`ref`/`in`/`out`** → **OpaqueValue** (no attribute needed)
- by-val primitives / enum → Lua boolean / integer / number / string
- class → ByObj userdata; struct → ByVal or Handle (see struct volumes)
- **`params T[]`** → same as szarray **single stack slot** (table / userdata / `nil`); does **not** collect trailing multi-slot args; **no** dedicated `LuaMarshalType`

### 3.3 Validation timing

- **Mono Attribute:** illegal combinations → **error log + fall back to `Default`** (see [marshal/02-MARSHAL-AS.md §4.1](/docs/spec/marshal/02-MARSHAL-AS/)); does not fail the bind.
- **Il2Cpp Generate / MarshalAs XML:** configuration errors may **hard-fail** (§4.2).

---

## 4. `[LuaAlias]` — method Lua aliases

```csharp
[LuaAlias("run_i32")]
public void Run(int value) { ... }

[LuaAlias("Foo")]   // Allowed to collide with existing method names / other aliases
public void Bar(string s) { ... }
```

- Defined in `ZLua.Common`
- **Equivalent to** using that string as the method’s **sole final Lua name** (**replaces** the default `MethodInfo.Name`; not dual-registered)
- Prebuilt DLLs may use a **separate** XML (Settings **`luaAliasXmlPaths`**, root element `ZLuaAlias`); must **not** be written into MarshalAs XML. See [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §5.4
- **Allowed** to collide with other aliases or existing method names; on collision, multiple candidates share that final name and calls use **overload dispatch** (see [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §5)
- If a final name has only this one candidate (e.g. a unique `run_i32`), it is a **direct closure**

Full rules: [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §3, §5.

---

## 5. Lua→C#: no `[MonoLuaCallback]` required

When Lua calls C# members, native generates bridge closures for each public member during **EnsureBinding** and writes them into the three tables. App code does **not** need and is **not** given a `[MonoLuaCallback]` marker.

Each **ReducedType (Il2Cpp)** or **full signature (Mono Emit)** maps to a unique bridge entry.

---

## 6. Exception boundary

### 6.1 C# calling Lua

| Direction | Behavior |
|-----------|----------|
| Lua `error()` | Caught as a C# exception (`LuaException` or wrapper); does **not** leak unhandled native longjmp past the managed stack |
| C# exception entering native | Converted at the boundary to a Lua error or recorded then rethrown (implementation is unified) |

Scripts should **not** depend on the exact type string of a C# exception caught inside pcall; only “failure is detectable” is guaranteed.

### 6.2 Lua calling C#

| Direction | Behavior |
|-----------|----------|
| C# throws | Converted to a **`luaL_error`**-equivalent message; Mono / Il2Cpp wording is identical or equivalent |
| Lua side | Use `pcall` to catch the error string |

### 6.3 Opaque and the boundary

An Opaque handle is valid **only** until the C#→Lua call that produced it returns; saving it across `pcall` and reusing it → error. See [marshal/04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/), [10-LIFETIME.md](/docs/spec/10-LIFETIME/).

---

## 7. Codegen constraints (summary)

| Item | Constraint |
|------|------------|
| `[LuaAlias]` | May collide with default names / other aliases; group by final name (see overload §5) |
| `[LuaMarshalAs]` | Forbidden at method level; illegal `Members` → bind failure |
| Mono Emit | Signatures that cannot Emit **must fail explicitly**; silent `Method.Invoke` on the hot path is forbidden |
| Il2Cpp stub | Uncovered signatures → build-time or first-bind failure (MethodBridge, etc.; see `impl/codegen/`) |

C#→Lua does **not** rely on IL weave / dedicated stubs: it goes through `GetFunction` → Delegate bridge.

---

## 8. Related docs

| Doc | Content |
|-----|---------|
| [00-OVERVIEW.md](/docs/spec/00-OVERVIEW/) | Dual runtime, initialization |
| [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) | dispatch, `register_method` |
| [marshal/01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/) | Marshal overview |
| [marshal/09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/) | Delegate ↔ Lua function |
| [10-LIFETIME.md](/docs/spec/10-LIFETIME/) | GC, single lua_State |
| [reference/csharp/lua-app-domain.md](/docs/reference/csharp/lua-app-domain/) | Programmer API page |
