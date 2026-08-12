---
sidebar_position: 1
title: "Migrating from SLua"
---

# Migrating from SLua to ZLua

> **Feature background:** [compare/FEATURES.md](/docs/compare/FEATURES/)
> SLua is similar to toLua, emphasizing **export config / auto-binding** and `LuaSvr`; the migration path overlaps heavily with toLua—this page highlights SLua-specific items.
> **Type-path adaptor (optional):** [Spec 12 · slua adaptor](/docs/spec/12-MIGRATION-ADAPTORS/) · [Migration index](/docs/guides/migration/)

---

## 1. Concept mapping

| SLua | ZLua |
|------|------|
| `LuaSvr` / `LuaSvrGameObject` | `LuaAppDomain.Initialize` |
| `LuaState` | Built into the ZLua host; not exposed directly |
| `[CustomLuaClass]` / export XML | **No** access-control whitelist; public lazy Bind (adaptor list is migration-only) |
| `LuaFunction` / `LuaTable` | `GetFunction`, implicit param marshal, `require` modules (**adaptor does not cover**) |
| `SLua.LuaObject` binding | ObjectRegistry + marshal |
| `UnityEngine.GameObject` namespace chain | Native: `CSharp[asm][full]`; **or** slua adaptor keeps `_G.UnityEngine.*` |
| Value-type GC opts (version-dependent) | ByVal / Opaque / ObjectRegistry (see [compare/GC.md](/docs/compare/GC/)) |

---

## 2. Step-by-step migration

### Step 1: Remove SLua runtime and generated code

1. Delete the SLua plugin directory and `Slua` namespace references.
2. Delete auto-generated `Assets/Slua/` or `Generated/` binding code.
3. Remove `LuaSvr` / `LuaSvrMain` components from scenes.

### Step 2: Initialization mapping

**Before (SLua):**

```csharp
LuaSvr.mainState.doString("require 'Main'");
// 或 LuaSvrGameObject 启动
```

**After (ZLua):**

```csharp
LuaAppDomain.Initialize(moduleLoader);
// Lua: require 'Main'
```

Call once from `RuntimeInitializeOnLoadMethod` or the game entry.

### Step 3: Type access (pick one)

#### 3A. Use slua adaptor (less rewrite; recommended transition)

In package: `ZLua~/adaptors/slua/ExportTypes.cs` + shared `ZLua~/adaptors/adaptor.lua`. Contract: [Spec 12](/docs/spec/12-MIGRATION-ADAPTORS/).

1. In a project that **still has SLua**, copy `ExportTypes.cs` → Editor, menu **`ZLua/ExportTypes`**
2. Generate `slua_export_types.lua` from `[CustomLuaClass]` and existing export marks
3. Put the list and **`adaptor.lua`** where the ZLua project can `require` them
4. Entry:

```lua
local export_types = require "slua_export_types"
local adaptor = require "adaptor"
adaptor.init(export_types)
-- 此后 UnityEngine.GameObject 等命名空间链可用（清单内；无 CS 前缀）
```

**Still must hand-edit:** generic construction, `GetFunction`, Event, `ref`/Opaque, etc. (adaptor only solves type-table entry).

#### 3B. Rewrite to native `CSharp`

SLua often uses **namespace chains** directly:

**Before:**

```lua
local GameObject = UnityEngine.GameObject
local obj = GameObject.Find("Root")
local list = System.Collections.Generic.List_int()()  -- 视 SLua 导出命名
```

**After:**

```lua
local GameObject = CSharp['UnityEngine.CoreModule']['UnityEngine.GameObject']
local obj = GameObject.Find("Root")

local ListDef = CSharp.mscorlib['System.Collections.Generic.List`1']
local List_int = zlua.make_generic_type(ListDef, zlua.types.int32)
local list = List_int()
```

### Step 4: SLua export config → visibility

**Before:** `CustomExport.cs`, `[CustomLuaClass]`, static export lists

**After:**

- Delete export config.
- APIs Lua must not see → `internal` / `private`.
- **Note:** without a whitelist, Il2Cpp **still links** public metadata; sensitive surface is C# visibility, not SLua-style export trimming.

### Step 5: LuaFunction and delegates

**Before:**

```csharp
LuaFunction laf = (LuaFunction)lua["callback"];
laf.call(1, 2);
```

or SLua’s `LuaDelegation` generation.

**After:**

```csharp
static readonly Action<int, int> InvokeCallback =
    LuaAppDomain.GetFunction<Action<int, int>>("mod", "callback");
InvokeCallback(1, 2);

// 或 Lua function 作参数
public static void SetHandler(Action<int,int> h) { ... }

// 或把 Lua 函数拿回 C#（替代长期持有 LuaFunction）
static readonly Func<Action<int, int>> GetCallback =
    LuaAppDomain.GetFunction<Func<Action<int, int>>>("mod", "get_callback");
```

```lua
mod.SetHandler(function(a,b) end)

-- get_callback 返回 function，由返回值 Marshal 为 Action
local function get_callback()
    return function(a, b) print(a, b) end
end
```

Dynamic by-name / arbitrary delegate types: see [Function and Delegate](/docs/guides/functions/).

### Step 6: Replace SLua-specific APIs

| SLua | ZLua |
|------|------|
| `LuaVar` / `LuaArray` | Native Lua table or C# array marshal |
| `checkVar` / manual type checks | Marshal errors thrown by ZLua |
| `Slua.CreateClass` | **None**; use C# types + constructors |
| `LuaSvr.doUpdate` | Delegate from `GetFunction` inside C# `Update` |

### Step 7: Value types

Some SLua versions optimize Vector3 etc.; on ZLua:

```lua
-- Unity Vector3 经程序集类型表
local Vector3 = CSharp['UnityEngine.CoreModule']['UnityEngine.Vector3']
local v = Vector3(1, 2, 3)
-- struct ByVal；见 tc_marshal_unity_vector
```

`ref` / `out` / C#→Lua Opaque rules match [from-xlua.md](/docs/guides/migration/from-xlua/) §Step 7.

### Step 8: Testing

- Move critical SLua cases into `Tests/Lua/cases/`
- Run dual-end manifest per [TESTING.md](/docs/community/testing/)

---

## 3. Common pitfalls

| Pitfall | Notes |
|----|------|
| Global `UnityEngine.X` missing | Use **slua adaptor**, or `CSharp[assembly]['UnityEngine.X']` |
| Depend on SLua auto-export order | ZLua lazy Bind; no order dependency |
| `[CustomLuaClass]` subclass export | Use public inheritance + normal type access |
| Multiple `LuaSvr` states | ZLua defaults to a **single main** `lua_State` |
| Hotfix DLL + SLua | Rebuild ZLua Codegen / assembly load strategy |
| Editor vs Player differences | SLua is more uniform; ZLua **must** verify Player |
| Assume “no export = no package cost” | See [compare/BRIDGE.md](/docs/compare/BRIDGE/) trimming section |

---

## 4. Before / After examples

### 4.1 Component script (Lua calling Unity)

**Before (SLua):**

```lua
function OnEnable()
    self.transform = self.gameObject.transform
    self.timer = 0
end

function Update()
    self.timer = self.timer + UnityEngine.Time.deltaTime
end
```

**After (ZLua):**

```lua
local Time = CSharp['UnityEngine.CoreModule']['UnityEngine.Time']

function OnEnable()
    self.transform = self.gameObject.transform
    self.timer = 0
end

function Update()
    self.timer = self.timer + Time.deltaTime
end
```

(If MonoBehaviour scripts are still driven by SLua, switch to the ZLua host + module loading first; exact host integration varies by project.)

### 4.2 Static utility class

**Before:**

```lua
local util = Slua.CreateClass("MyUtil")
function util.foo() return 1 end
```

**After:** define `public static class MyUtil` in C#, Lua:

```lua
local MyUtil = CSharp['Assembly-CSharp']['MyUtil']
MyUtil.Foo()
```

### 4.3 Events (no SLua/xLua sugar)

**Before (if using SLua delegate binding):**

```csharp
// SLua 生成或手动 Bind
```

**After:**

```lua
obj:add_Click(function() end)
obj:remove_Click(fn)
```

---

## 5. API quick reference

| Capability | SLua | ZLua |
|------|------|------|
| Start VM | `LuaSvr.init` | `LuaAppDomain.Initialize` |
| Run file | `doFile` | `require` + loader |
| Call C# static | Exported class | `CSharp[asm][type].Method` |
| Call C# instance | `:` | `:` (same Lua semantics) |
| C# call Lua | `LuaFunction` | `GetFunction<T>` |
| Create delegate | SLua gen / `LuaFunction` | Implicit param marshal, or `GetFunction` / `to_delegate` |
| Generic List | Export closed type | `zlua.make_generic_type` |
| Arrays | Export | `zlua.make_szarray_type` / `new_*array*` |
| Reflection | Partial SLua support | `zlua.typeof` / `CSharp` lazy Bind |

---

## 6. Relation to the toLua migration doc

| Topic | See |
|------|------|
| Delete Wrap, global classes | [from-tolua.md](/docs/guides/migration/from-tolua/) |
| GetFunction, Opaque | [from-xlua.md](/docs/guides/migration/from-xlua/) |
| Performance/GC | [compare/](/docs/compare/) |

---

## 7. Acceptance checklist

- [ ] No `Slua` / `LuaSvr` references
- [ ] No SLua generated binding directories
- [ ] Type entry: `adaptor.init` **or** scripts use `CSharp[asm][full]` (no surprise global pollution)
- [ ] Il2Cpp Player full tests pass
- [ ] Performance profiling (if migrating from SLua for perf) — see [PERFORMANCE](/docs/compare/PERFORMANCE/)

---

## Related

| Doc | Contents |
|------|------|
| [migration/](/docs/guides/migration/) | Shared checklist and adaptor overview |
| [spec/12-MIGRATION-ADAPTORS.md](/docs/spec/12-MIGRATION-ADAPTORS/) | slua adaptor contract |
| [spec/02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) | Type naming |
| [compare/GC.md](/docs/compare/GC/) | GC boundaries |
