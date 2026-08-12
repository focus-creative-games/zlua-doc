---
sidebar_position: 2
title: "Migrating from toLua"
---

# Migrating from toLua (tolua#) to ZLua

> **Feature background:** [compare/FEATURES.md](/docs/compare/FEATURES/)
> toLua / tolua# is characterized by **pre-generated Wrap**, **LuaState**, and globally exported classes; ZLua by **lazy binding**, the **CSharp root table**, and an **Il2Cpp-embedded bridge**.
> **Type-path adaptor (optional):** [Spec 12 · tolua adaptor](/docs/spec/12-MIGRATION-ADAPTORS/) · [Migration index](/docs/guides/migration/)

---

## 1. Concept mapping

| toLua / tolua# | ZLua |
|----------------|------|
| `LuaState` / `ToLua` | `LuaAppDomain` |
| `*.Wrap.cs` export classes | **No Wrap**; `EnsureBinding` writes three tables |
| `CustomSettings.cs` export list | **No** access-control whitelist; public lazy Bind (adaptor list is migration-only) |
| Global / namespace `UnityEngine.GameObject` | Native: `CSharp[asm][full]`; **or** adaptor hangs `_G.UnityEngine.GameObject` |
| `LuaFunction` / `LuaTable` | `GetFunction`, implicit param marshal, `require` module tables (**adaptor does not cover**) |
| `ToLua.Push` / manual bind | Automatic marshal (spec/marshal) |
| `out` multi-return | StructUserData (`Type(...)`) / copy semantics (depends on signature) |
| Binder registration | `CSharp` lazy load + Codegen (Il2Cpp) |

---

## 2. Step-by-step migration

### Step 1: Remove toLua generated artifacts

1. Delete `Source/Generate/` or all `*Wrap.cs` / `*Binder.cs` in the project.
2. Remove toLua `#if` macros, `LuaClient`, `LuaState` singletons.
3. Uninstall tolua# plugin dlls (if separate native).

### Step 2: Initialization

**Before (tolua#):**

```csharp
LuaState lua = new LuaState();
lua.Start();
LuaBinder.Bind(lua);
lua.DoFile("Main.lua");
```

**After (ZLua):**

```csharp
LuaAppDomain.Initialize(LoadModule);
// bootstrap + require 由 ZLua 与宿主 loader 负责
```

### Step 3: Types and calls (pick one)

#### 3A. Use tolua adaptor (less rewrite; recommended transition)

In package: `ZLua~/adaptors/tolua/ExportTypes.cs` + shared `ZLua~/adaptors/adaptor.lua`. Contract: [Spec 12](/docs/spec/12-MIGRATION-ADAPTORS/).

1. In a project that **still has toLua**, copy `ExportTypes.cs` → Editor, menu **`ZLua/ExportTypes`**
2. Generate `tolua_export_types.lua` from `CustomSettings.customTypeList` (`export_name` is a namespace path like `UnityEngine.GameObject`)
3. Put the list and **`adaptor.lua`** where the ZLua project can `require` them
4. Entry:

```lua
local export_types = require "tolua_export_types"
local adaptor = require "adaptor"
adaptor.init(export_types)
-- 此后 UnityEngine.GameObject 等可用（清单内；冲突会 fail-fast）
```

**Note:** Consistent with runtime `BeginModule`, defaults hang a **namespace chain**, not “global short names only”. `SetNameSpace(null)` / `SetLibName` are reflected in `export_name`. Member calls still follow ZLua semantics.

#### 3B. Rewrite to native `CSharp`

toLua often uses **flat globals**; native ZLua requires **assembly + full name**.

**Before:**

```lua
local go = GameObject.Find("Player")
local demo = Demo.New()
demo:SetValue(10)
local x = demo.x
```

**After:**

```lua
local GameObject = CSharp['UnityEngine.CoreModule']['UnityEngine.GameObject']
local Demo = CSharp['Assembly-CSharp']['Demo']

local go = GameObject.Find("Player")
local demo = Demo()           -- 构造：Type()，非 Demo.New()（除非静态方法名如此）
demo:SetValue(10)
local x = demo.x
```

**Note:** toLua’s `Type.New()` is usually **`Type()`** in ZLua (type-table `__call` → constructor). If C# only has a static factory, keep `Demo.New()`.

### Step 4: Custom loader

**Before:** `LuaState.AddSearchPath` / custom `LuaFileUtils`

**After:** `LuaAppDomain.Initialize(moduleLoader)` resolves uniformly:

```csharp
Func<string, object> loader = module =>
{
    var path = Path.Combine(projectRoot, "Lua", module.Replace('.', '/') + ".lua");
    return File.ReadAllText(path);
};
```

Player path rules: [TESTING.md](/docs/community/testing/) §5.

### Step 5: C# calling Lua

**Before:**

```csharp
LuaFunction func = lua.GetFunction("Update");
func.Call(Time.deltaTime);
func.Dispose();
```

**After:**

```csharp
static readonly Action<float> LuaUpdate =
    LuaAppDomain.GetFunction<Action<float>>("game", "Update");
```

### Step 6: Delegates and tolua events

toLua projects often use **LuaFunction.ToDelegate** / long-lived `LuaFunction`:

**Before:**

```csharp
LuaFunction lf = lua.GetFunction("onClick");
Button.onClick.AddListener(lf.ToDelegate<Action>());
```

**After (recommended: Lua passes function to C#):**

```csharp
public static void SetClickHandler(Action cb) { button.onClick.AddListener(() => cb()); }
```

```lua
ui:SetClickHandler(function() print("click") end)
```

**After (C# actively fetches a Lua function then calls):** use `GetFunction<Action>`/`GetFunction<Func<…>>`, or `GetFunction<Delegate>` + `zlua.to_delegate`. See [Function and Delegate](/docs/guides/functions/), [from-xlua Step 5](/docs/guides/migration/from-xlua/).

```csharp
static readonly Func<Action> GetOnClick =
    LuaAppDomain.GetFunction<Func<Action>>("ui", "get_on_click");

button.onClick.AddListener(GetOnClick());
```

### Step 7: Value types and out

toLua often uses **multi-return out**:

**Before:**

```lua
local ok, result = luaObj:TryParse(str)
```

**After:**

```lua
-- struct out：Type(...) 构造 StructUserData
local outPoint = Point2D()
local ok = obj:TryGetPoint(outPoint)

-- 基元 out：裸实参走拷贝/default 分支；须 observable 写回时用 struct 形参或 C# 多返回值
```

Structs default to **ByVal userdata**; observable `ref`/`out` write-back needs `Type(...)` StructUserData; boxed cases use `zlua.box`.

### Step 8: Unity engine APIs

toLua pre-exports many `UnityEngine.*` Wrap. When migrating:

1. Change to `CSharp[assembly][typeFullName]` **as actually used** (assembly names from `.asmdef` / Inspector).
2. Do not rewrite every engine API at once; migrate by module.
3. Il2Cpp Player needs the assembly in Codegen inputs.

---

## 3. Common pitfalls

| Pitfall | Notes |
|----|------|
| Depend on global class names | `Demo` undefined → **tolua adaptor** (`Namespace.Demo`), `CSharp[...]['Demo']`, or local alias |
| `Demo.New()` vs `Demo()` | Prefer `Type()` for ZLua construction |
| Link errors after deleting Wrap | C# still references `LuaInterface` types → delete those too |
| tolua `#if UNITY_EDITOR` dual logic | Merge to one Lua set for both ZLua ends |
| Export list as security boundary | Make APIs **non-public** |
| Strong `LuaTable` dependency | Use Lua module return table + `require` |
| Performance assumptions | toLua like xLua goes through Wrap; ZLua Player path differs — see [compare/PERFORMANCE.md](/docs/compare/PERFORMANCE/) |

---

## 4. Before / After examples

### 4.1 Module organization

**Before (toLua + globals):**

```lua
-- Main.lua
UpdateBeat = UpdateBeat or {}
function UpdateBeat.OnUpdate(dt)
    -- ...
end
```

**After (ZLua module):**

```lua
-- game.lua
local M = {}

function M.OnUpdate(dt)
    -- ...
end

return M
```

```csharp
static readonly Action<float> OnUpdate =
    LuaAppDomain.GetFunction<Action<float>>("game", "OnUpdate");
```

### 4.2 Arrays

**Before:**

```lua
local arr = System.Array.CreateInstance(typeof(int), 10)
```

**After:**

```lua
local arr = zlua.new_szarray_by_element_type(zlua.types.int32, 10)
-- 或
local intArrType = zlua.make_szarray_type(zlua.types.int32)
local arr2 = zlua.new_szarray_by_szarray_type(intArrType, 10)
```

### 4.3 Clean Wrap references (C#)

**Before:**

```csharp
DemoWrap.Register(L);
```

**After:** delete; auto-Bind on first `CSharp[...]['Demo']` access.

---

## 5. CustomSettings migration map

| toLua CustomSettings | ZLua |
|----------------------|------|
| `customTypeList` | Delete; hide with `internal` as needed |
| `staticClassList` | Not needed; statics on type table |
| `dynamicList` | Not needed |
| `outList` | Follow C# signature + marshal Spec |
| `sealedList` | No counterpart; inheritance rules in type system |

---

## 6. Acceptance

- [ ] No leftover `LuaInterface` / `ToLua` / `*Wrap`
- [ ] `Tests/Lua` covers critical former toLua APIs
- [ ] Editor + Il2Cpp Player manifest all green
- [ ] After removing toLua, package/startup has no lib conflicts
- [ ] (If using adaptor) after `tolua_export_types` + `adaptor.init`, namespace paths like `UnityEngine.GameObject` work; conflicts/missing types have clear errors

---

## Related

| Doc | Contents |
|------|------|
| [migration/](/docs/guides/migration/) | Shared checklist and adaptor overview |
| [spec/12-MIGRATION-ADAPTORS.md](/docs/spec/12-MIGRATION-ADAPTORS/) | tolua adaptor contract |
| [from-xlua.md](/docs/guides/migration/from-xlua/) | xLua comparison (more detail on C#→Lua) |
| [spec/05-LIB.md](/docs/spec/05-LIB/) | `zlua.*` API |
| [TESTING.md](/docs/community/testing/) | Regression testing |
