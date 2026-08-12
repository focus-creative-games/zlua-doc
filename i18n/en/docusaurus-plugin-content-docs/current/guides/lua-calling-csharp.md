---
sidebar_position: 4
title: Lua calling C#
description: Access types, static/instance members, construction, and Event (add_/remove_).
---

# Lua calling C#

Access public types and members through the global **`CSharp`** root table. Semantics stay close to C#: `Type()` constructs, `obj:Method()` calls instance methods, statics go through the type table. Namespaced types need bracket keys.

Canonical: [app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua), [Demo.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Demo.cs)

Resolving same-name multiple signatures: [Method overloads](/docs/guides/overloads/) (preview at the end of this chapter).

## 1. Accessing types

```
CSharp
  └─ Assembly-CSharp
       └─ Demo
       └─ ['MyGame.UI.Panel']
```

```lua
CSharp['AC'] = CSharp['Assembly-CSharp']   -- 推荐短别名

local Demo = CSharp.AC.Demo
local Panel = CSharp.AC['MyGame.UI.Panel']
local Nested = CSharp.AC['Outer+Nested']   -- 嵌套类型用 +
```

| Type | Lua access |
|------|----------|
| No namespace | `CSharp.AC.Demo` |
| With namespace | `CSharp.AC['MyGame.UI.Panel']` |
| Nested | `CSharp.AC['Outer+Nested']` |
| BCL | `CSharp.mscorlib['System.Int32']`, etc. |

:::warning
Namespaced types with dots **cannot** be opened as `CSharp.AC.MyGame.UI.Panel` with chained dots; use a string key.
:::

- Types are **lazy-loaded**; only **public** is visible
- Static and instance metadata are **separate**; do not mix them

## 2. Static members (fields, properties, methods)

```lua
-- 静态方法
print(CSharp.AC.Demo.Add(3, 5))

-- 静态字段 / 无参 Property
CSharp.AC.Demo.s_x = 10
print(CSharp.AC.Demo.GetSX())
```

| C# | Lua read | Lua write |
|----|--------|--------|
| Static field `s_x` | `Type.s_x` | `Type.s_x = v` |
| Static parameterless Property | `Type.Prop` | `Type.Prop = v` |
| Static method | `Type.Add(a, b)` | — |

## 3. Constructing instances

```lua
local demo = CSharp.AC.Demo()   -- ≡ new Demo()
```

Parameterized constructors support default overload dispatch; multiple constructors: [Method overloads](/docs/guides/overloads/).

## 4. Instance members (fields, properties, methods)

```lua
local demo = CSharp.AC.Demo()

demo:SetX(10)          -- 实例方法（冒号传 self）
print(demo:GetX())

demo.x = 20            -- public 字段与无参 Property 写法相同
print(demo.x)
```

| Syntax | Meaning |
|------|------|
| `demo:GetX()` | Instance method |
| `demo.x` | Field or parameterless Property |
| `CSharp.AC.Demo.Add(3,5)` | Static method |

### Fields and properties

- Parameterless `{ get; set; }` matches field syntax; on Il2Cpp Player, simple int properties may use an offset fast path—prefer `demo.x` over `GetX()` on hot paths
- Parameterized indexers (`this[int]`) dispatch as **methods**; you cannot freely write `obj[i]` (szarray etc. have special rules — see [Arrays](/docs/guides/arrays/))
- Unregistered members are a **strict miss** → `error`, with no reflection fallback

### Inheritance

Subclass instances can call public instance members from base types; static members go through the **declaring type**’s type table.

### nil and null

- Lua `nil` ↔ C# reference-type `null` and vice versa
- Value-type structs **cannot** be nil (unless `Nullable<T>` — see [Value types](/docs/guides/value-types/))

## 5. Event (`add_` / `remove_`)

ZLua has **no** Event-specific metatable (no `.get` / `.set` / assignment sugar). Use the compiler-generated ordinary methods:

```lua
local function onChanged(v)
    print("hp", v)
end

host:add_OnHealthChanged(onChanged)
-- ...
host:remove_OnHealthChanged(onChanged)  -- 须同一 function 引用
```

Static events: `Type.add_Foo(handler)`. The handler is a Lua `function`, implicitly marshaled per [Function](/docs/guides/functions/).

If you see `OnX.get is nil`, you are still using xLua-style sugar; switch to `add_` / `remove_`.

## Full example (from Demo)

```lua
local function test_call_static_method()
    print("Demo.Add:", CSharp.AC.Demo.Add(3, 5))
end

local function test_call_instance_method()
    local demo = CSharp.AC.Demo()
    print("Demo:GetX():", demo:GetX())
end

local function test_access_instance_field()
    local demo = CSharp.AC.Demo()
    demo:SetX(10)
    assert(demo.x == 10)
    demo.x = 20
    assert(demo:GetX() == 20)
end
```

## Method overloads preview

`demo:Run(10)` and `demo:Run("hi")` use runtime dispatch when there are multiple overloads. Exact picks use full-signature keys `demo['Run(System.Int32)'](demo, 10)` (automatic at Bind; no API); short hot-path names use `[LuaAlias]` or `register_method`. See [Method overloads](/docs/guides/overloads/).

## Common mistakes

| Symptom | Fix |
|------|------|
| `type not found` | Assembly name, namespace brackets, whether public |
| `static member not found` | Do not access statics via instances; use the type table |
| `instance member not found` | Spelling / visibility |
| `member not writable` | Read-only Property |
| Event `.get` is nil | Use `add_` / `remove_` |

## Learning path

| | |
|---|---|
| **Previous** | [EmmyLua debugger](/docs/guides/debugger/) |
| **Next** | [C# calling Lua](/docs/guides/csharp-calling-lua/) |

## Related

- [Type system Spec](/docs/spec/02-TYPE-SYSTEM/)
- [CSharp root table reference](/docs/reference/lua/csharp-root/)
- [Metatable model](/docs/concepts/metatable-model/)
- [Method overloads](/docs/guides/overloads/)
