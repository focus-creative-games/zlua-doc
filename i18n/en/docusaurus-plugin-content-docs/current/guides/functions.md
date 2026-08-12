---
sidebar_position: 7
title: Function and Delegate
description: Three paths for Lua function ↔ C# Delegate and important caveats.
---

# Function and Delegate

| Path | Syntax | Notes |
|------|------|------|
| **Lua → C# parameter** | `obj:Foo(function(...) end)` | Implicit `ReadDelegate` |
| **C# → Lua** (callback slot) | `handler(...)` | May be a **function** or DelegateUserData; always use call syntax |
| **C# fetches Lua by name** | `GetFunction<T>(mod, name)` | See [C# calling Lua](/docs/guides/csharp-calling-lua/) |

Authoritative: [Function Marshal](/docs/spec/marshal/09-FUNCTION/), [`to_delegate`](/docs/spec/05-LIB/).

## 1. Lua function as a C# parameter

```csharp
public void RegisterCallback(System.Action<int> onValue)
{
    onValue?.Invoke(42);
}
```

```lua
host:RegisterCallback(function(v)
    print("callback:", v)
end)
```

Day to day you **do not** need to write `to_delegate` by hand: a closed delegate is created automatically from the parameter’s delegate type.

| Lua argument | Result |
|----------|------|
| `function` | Created from the parameter type |
| `nil` | `null` |
| Existing delegate userdata | Passed through |
| Other | Type error |

You can also hang callbacks on properties:

```lua
logic.Combine = function(a, b) return a + b end
print(logic:Run(3, 5))
```

## 2. C# callbacks into Lua

Callback slots retrieved from C# **always** use call syntax:

```lua
local handler = host:GetHandler()
handler(42)
```

| Slot source | `type(handler)` | Notes |
|----------|-----------------|------|
| Native C# delegate | userdata (`__call`) | `handler(...)` is enough |
| Lua function passed through C# and back | **`function`** | Still a Lua function, **not** a delegate |

So **do not** rely on `handler:Invoke(...)`: it does not work on functions, and it conflicts with the “round-trip stays a function” design. Details: [09-FUNCTION](/docs/spec/marshal/09-FUNCTION/).

:::warning
Native **open delegates** (`target == null`) are not supported today.
:::

## 3. When to use GetFunction / to_delegate

| Scenario | Approach |
|------|------|
| Known module + method name + concrete `T` | **`GetFunction<T>`** |
| Lua already has a function; need a specific delegate type | `zlua.to_delegate(fn, closedDelegateType)` |
| C# parameter is already a concrete `Action`/`Func` | Pass `function` directly |

The second argument to `to_delegate` must be a **closed** type (e.g. `Action<int>`), not an open generic.

## 4. Event and lifetime

- Events use `add_` / `remove_` (see [Lua calling C#](/docs/guides/lua-calling-csharp/#5-event-add_--remove_))
- Unsubscribe must use the **same** function reference
- Multicast keeps multicast semantics; Lua functions are held via registry refs—avoid C# holding a delegate long-term while destroying the Lua environment

## Common mistakes

| Symptom | Cause |
|------|------|
| `expects delegate X` | Neither function nor delegate |
| Callback never runs | C# never Invoke’d; or GetFunction result discarded without caching |
| Wrong `to_delegate` type | Second arg is not a closed delegate type |
| remove has no effect | Not the same function reference |

## Learning path

| | |
|---|---|
| **Previous** | [Value types](/docs/guides/value-types/) |
| **Next** | [Arrays](/docs/guides/arrays/) |

## Related

- [C# calling Lua](/docs/guides/csharp-calling-lua/)
- [Function Marshal](/docs/spec/marshal/09-FUNCTION/)
- [Migrating from xLua](/docs/guides/migration/from-xlua/)
