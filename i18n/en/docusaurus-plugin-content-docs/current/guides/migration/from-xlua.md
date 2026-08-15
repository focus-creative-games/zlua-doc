---
sidebar_position: 3
title: "Migrating from xLua"
---

# Migrating from xLua to ZLua

> **Feature background:** [compare/FEATURES.md](/docs/compare/FEATURES/)
> **Performance/GC:** [compare/PERFORMANCE.md](/docs/compare/PERFORMANCE/), [compare/GC.md](/docs/compare/GC/)
> **Type-path adaptor (optional):** [Spec 12 · xlua adaptor](/docs/spec/12-MIGRATION-ADAPTORS/) · [Migration index](/docs/guides/migration/)

---

## 1. Concept mapping

| xLua | ZLua |
|------|------|
| `CS.Namespace.Type` | Native: `CSharp[assembly]['Namespace.Type']`; **or** xlua adaptor keeps `CS.*` |
| `LuaEnv` | `LuaAppDomain` + `moduleLoader` |
| `luaEnv:DoString` / `require` | Same `require`; loader provided by host |
| `[LuaCallCSharp]` + Generate | **None**; public types **lazy Bind** (adaptor list is migration-only path compatibility) |
| `[CSharpCallLua]` | `LuaAppDomain.GetFunction<T>("module","func")` (**adaptor does not cover**) |
| `LuaFunction` / `xlua.tofunction` | Call via `GetFunction`, or **implicit param marshal** / `to_delegate` (see [Function](/docs/guides/functions/)) |
| `ObjectTranslator` | `ObjectRegistry` + marshal chapters |
| xLua Event syntax | **None**; `add_Xxx` / `remove_Xxx` |
| `CS.System.Collections.Generic.List(CS.System.Int32)` | `zlua.make_generic_type(...)` (**adaptor incompatible** with old generic construction) |
| struct / `out` | ByVal / Opaque / StructUserData (see spec/marshal) |

---

## 2. Step-by-step migration

### Step 1: Replace host initialization

**Before (xLua):**

```csharp
var luaEnv = new LuaEnv();
luaEnv.AddLoader(customLoader);
luaEnv.DoString("require 'main'");
```

**After (ZLua):**

```csharp
LuaAppDomain.Initialize(moduleName =>
{
    // 返回 Tests/Lua/... 或 StreamingAssets 下源码
    return LoadLuaModuleSource(moduleName);
});
// Lua 侧自行 require('main')
```

Ensure `RuntimeInitializeOnLoadMethod` or a scene entry calls `Initialize` once.

### Step 2: Type paths (pick one)

#### 2A. Use xlua adaptor (less rewrite; recommended transition)

In package: `ZLua~/adaptors/xlua/ExportTypes.cs` + shared `ZLua~/adaptors/adaptor.lua`. Contract: [Spec 12](/docs/spec/12-MIGRATION-ADAPTORS/).

1. In a project that **still has xLua**, copy `ExportTypes.cs` → Editor, menu **`ZLua/ExportTypes`**
2. Output writes `xlua_export_types.lua` from `[LuaCallCSharp]` / existing Gen whitelist (**does not** scan all assemblies)
3. Put `xlua_export_types.lua` and **`adaptor.lua`** in a Lua directory the ZLua project can `require`
4. After `Initialize`, before game scripts:

```lua
local export_types = require "xlua_export_types"
local adaptor = require "adaptor"
adaptor.init(export_types)
-- 此后 CS.UnityEngine.GameObject 等仍可用（清单内）
```

**Still must hand-edit:** `GetFunction`, Event, `ref`/Opaque, and `List(Int32)`-style generic construction → `zlua.make_generic_type`.

#### 2B. Rewrite to native `CSharp` (long-term close-out)

**Before:**

```lua
local GameObject = CS.UnityEngine.GameObject
local Demo = CS.MyGame.Demo
local list = CS.System.Collections.Generic.List(CS.System.Int32)()
```

**After:**

```lua
local GameObject = CSharp['UnityEngine.CoreModule']['UnityEngine.GameObject']
-- 或若类型在 Assembly-CSharp：
local Demo = CSharp['Assembly-CSharp']['MyGame.Demo']

local ListDef = CSharp.mscorlib['System.Collections.Generic.List`1']
local List_int = zlua.make_generic_type(ListDef, zlua.types.int32)
local list = List_int()
```

**Alias (optional):**

```lua
CSharp.AC = CSharp['Assembly-CSharp']
local Demo = CSharp.AC['MyGame.Demo']
```

### Step 3: Remove the Generate pipeline

1. Remove `XLuaGenConfig`, `[LuaCallCSharp]`, `[CSharpCallLua]`, `[ReflectionUse]`, and other Generate inputs.
2. Delete generated Wrap under `Assets/XLua/Gen/` (or the whole xLua package).
3. **Access control:** do not rely on whitelists; APIs you do not want Lua to see become `internal` / `private`.

### Step 4: C# calling Lua

**Before:**

```csharp
[LuaCallCSharp]
public class LuaBridge {
    public static Action<float> onTick;
}
// 或 luaEnv.Global.Get<Action<float>>("onTick")
```

**After:**

```csharp
static readonly Action<float> OnTick =
    LuaAppDomain.GetFunction<Action<float>>("game", "OnTick");

void Update() => OnTick(Time.deltaTime);
```

Lua module `game.lua` must **return a table** containing the global function name `OnTick` (matching GetFunction’s method argument).

### Step 5: Lua function → C# delegate (including “bring the function back to C#”)

ZLua **supports** C# holding and repeatedly calling Lua functions—do not assume you can only “one-shot `GetFunction`”.

#### A. Lua as a C# method parameter (implicit marshal)

**Before:**

```csharp
luaEnv.Global.Get<LuaFunction>("callback"):Call(1);
// 或 CSharpCallLua 生成 delegate
```

**After:**

```csharp
// C# 方法接收 delegate，Lua 传 function 即可
public static void Register(Action<int> cb) { ... }
```

```lua
obj:Register(function(x) print(x) end)
```

#### B. `GetFunction` by name (replaces `Get<Action>` / `LuaFunction`)

**Before (xLua):**

```csharp
Action<float> onTick = luaEnv.Global.Get<Action<float>>("OnTick");
onTick(dt);
```

**After:**

```csharp
static readonly Action<float> onTick =
    LuaAppDomain.GetFunction<Action<float>>("game", "OnTick");
onTick(dt);
```

```lua
-- game.lua
local function OnTick(dt) print(dt) end
return { OnTick = OnTick }
```

Any signature works by swapping the corresponding `T`. When Lua already has a function and you need an explicit type, use `zlua.to_delegate` (see [Function and Delegate](/docs/guides/functions/)).

Details: [spec/marshal/09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/), [Function and Delegate](/docs/guides/functions/).

### Step 6: Event

**Before (xLua):**

```lua
obj.SomeEvent = function() end
-- 或 += 风格（视版本）
```

**After:**

```lua
obj:add_SomeEvent(function() end)
obj:remove_SomeEvent(handler)
```

### Step 7: struct / ref / out

**Before:**

```lua
local ok, outVal = cs_obj:TryParse(s)
```

**After (Lua→C# ref / out):**

```lua
-- struct ref/out：Type(...) 构造 StructUserData
local outPoint = Point2D()
local ok = obj:TryGetPoint(outPoint)

-- 基元 ref：裸值走拷贝语义（C# 内可变，Lua local 不变）
local x = 0
obj:Increment(x)   -- x 仍为 0
```

**C#→Lua `ref` (Opaque; easy to trip on):**

```lua
-- C# GetFunction 取得的 delegate 上 void Foo(ref int x) 推到 Lua 的不是 number
local h = ... -- OpaqueValue from invoke
local v = zlua.get_opaquevalue(h, zlua.types.int32)
zlua.set_opaquevalue(h, v + 1)
-- 勿跨 pcall 保存 h
```

### Step 8: Testing and Player verification

- Add `tc_*.lua` per [TESTING.md](/docs/community/testing/)
- Run full manifest on **Il2Cpp Player** (xLua and ZLua dual-end behavior must be verified separately)

---

## 3. Common pitfalls

| Pitfall | Notes | Fix |
|----|------|------|
| `CSharp.AC.MyGame.Demo` | `.` parsed as nested tables | Use `CSharp.AC['MyGame.Demo']` |
| Nested type `Outer.Inner` | Wrong key | Use `Outer+Inner` |
| Assume Generate whitelist still applies | ZLua has no LuaCall list | Control APIs with visibility |
| Treat `ref` as integer | C#→Lua Opaque | `zlua.get_opaquevalue` |
| Opaque across frames | Forbidden by Spec | Use only within a single C#→Lua call |
| Inherited member not found | Flattened at Bind | Confirm member is on declaring type’s public API |
| `__index` missing member | ZLua **always errors** (`zlua: member not found: …`), **does not** return `nil` | Probe members with `rawget` / `pcall`; do not rely on silent `nil` |
| Some Editor API is nil | Type unbound / not public / wrong usage | Check [Spec](/docs/spec/00-OVERVIEW/) and [impl/MONO.md](/docs/impl/MONO/) |
| Performance expectations | xLua and ZLua architectures differ | See [compare/PERFORMANCE.md](/docs/compare/PERFORMANCE/) |
| libil2cpp merge | Unity upgrade cost | Assess tech debt before migrating |

---

## 4. Error message mapping (typical)

| xLua symptom | Possible ZLua behavior |
|-----------|---------------|
| `cannot find wrapper` | Type not loaded / not public / typo → clear errors such as `type not found` / `member not found` |
| `invalid lua stack` | Marshal type mismatch → Lua error with ZLua prefix |
| Generate missed a type | xLua missing Wrap at compile time | ZLua Binds on first access; Il2Cpp missing stub should be covered at Codegen |

---

## 5. Before / After mini scripts

### 5.1 Game entry

**Before (xLua):**

```lua
-- main.lua
local CS = CS
local Demo = CS.MyGame.Demo

function start()
    local d = Demo()
    d.Name = "test"
    print(d:GetName())
end

start()
```

**After (ZLua):**

```lua
-- main.lua
local Demo = CSharp['Assembly-CSharp']['MyGame.Demo']

local function start()
    local d = Demo()
    d.Name = "test"
    print(d:GetName())
end

start()
```

### 5.2 Overloads

**Before:**

```lua
obj:Foo(1)      -- xLua Generate 已分派
obj:Foo("a")
```

**After:**

```lua
obj:Foo(1)      -- 默认最佳匹配，多数情况可直接用
obj:Foo("a")

-- 歧义时：全签名键（Bind 自动，无需 API）
obj['Foo(System.Int32)'](obj, 1)
obj['Foo(System.String)'](obj, "a")

-- 或 Bind 期 [LuaAlias] 短名
obj:foo_str("a")

-- 或 register_method 挂自定义短名后冒号调用
local foo_i32 = obj['Foo(System.Int32)']
zlua.register_method("foo_i32", foo_i32)
obj:foo_i32(1)
```

### 5.3 C# main loop calling Lua

**Before:**

```csharp
void Update() {
    luaEnv.Global.Get<Action<float>>("update")(Time.deltaTime);
}
```

**After:**

```csharp
static readonly Action<float> LuaUpdate =
    LuaAppDomain.GetFunction<Action<float>>("game", "update");

void Update() => LuaUpdate(Time.deltaTime);
```

---

## 6. Suggested migration timeline

| Phase | Work |
|------|------|
| W1 | Initialize; **xlua adaptor** or `CSharp` path tooling; remove xLua package |
| W2 | Core gameplay (delegate / GetFunction); gradually close out `CS.*` |
| W3 | struct/ref/Event focus + `Tests/Lua` |
| W4 | Il2Cpp Player full regression + performance profiling; optionally drop adaptor |

---

## Related

| Doc | Contents |
|------|------|
| [migration/](/docs/guides/migration/) | Shared checklist and adaptor overview |
| [spec/12-MIGRATION-ADAPTORS.md](/docs/spec/12-MIGRATION-ADAPTORS/) | xlua adaptor contract |
| [spec/02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) | Type syntax |
| [spec/01-HOST-API.md](/docs/spec/01-HOST-API/) | GetFunction |
