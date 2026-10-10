---
sidebar_position: 12.6
title: Extension methods
description: "[LuaExtension] and XML attach C# extensions to the extended type's instance method table."
---

# Extension methods

Attach C# **extension methods** to the extended type’s Lua **instance** methodTable so you can write `obj:ExtFoo(...)`. Authoritative: [13-EXTENSION-METHODS](/docs/spec/13-EXTENSION-METHODS/).

There is **no** global scan for `ExtensionAttribute`. The model is **extended type → list of extension classes**; those classes are reflected when that type is Bound.

## Configuration

| Approach | Usage |
|------|------|
| You can edit the extended type’s source (including hot-update assemblies) | Put **`[LuaExtension(typeof(FooExt), …)]` on the extended type** |
| Third-party / precompiled, **non–hot-update** types | Settings **`luaExtensionXmlPaths`** + root element **`ZLuaExtensions`** |
| Types in **hot-update assemblies** (including HybridCLR) | **Only** in-code `[LuaExtension]`; XML is **not** supported |

**Do not** put `[LuaExtension]` on the extension class (that would require scanning every assembly to discover extensions).

```csharp
using ZLua;

public static class TransformExt
{
    public static void ResetLocal(this UnityEngine.Transform t)
    {
        t.localPosition = UnityEngine.Vector3.zero;
    }
}

[LuaExtension(typeof(TransformExt))]
public class PlayerView : MonoBehaviour { }
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<!-- Non–hot-update extended types only; use [LuaExtension] on hot-update assemblies -->
<ZLuaExtensions version="1">
  <Assembly name="UnityEngine.CoreModule">
    <Type fullName="UnityEngine.Transform">
      <Extension assembly="Assembly-CSharp" fullName="MyGame.TransformExt"/>
    </Type>
  </Assembly>
</ZLuaExtensions>
```

For the same extended type, Attribute and XML extension-class lists are **unioned**. Binding **T** also collects `[LuaExtension]` from **base types**.

Il2Cpp: XML is written into static tables at **Generate** time; the Player does **not** read XML (re-Generate after changes). **XML does not apply to hot-update assemblies.**

## Lua usage

```lua
local t = go.transform
t:ResetLocal()   -- 冒号；底层是静态扩展方法
```

Filter rules: `public static` methods on the extension class that have `ExtensionAttribute`, whose first parameter can accept the extended type (including `this Base` for `Derived`). Open generic extensions are **not** supported.

## Same name as an instance method

Extensions and real instance methods **compete in the same overload group**; there is **no** “instance wins” rule. Disambiguate with full-signature keys or `[LuaAlias]`. See [Method overloads](/docs/guides/overloads/).

## Common mistakes

| Symptom | Cause |
|------|------|
| `member not found` (`obj:Foo`) | Extension class not configured on the extended type (or base); or Il2Cpp not re-Generated |
| Only `Ext.Foo(obj)` works | Not wired as static-as-instance / not in IMT (implementation must follow Spec §4) |
| Wrong overload called | Merged competition; use full-signature keys or Alias |
| Attribute on the extension class has no effect | Discovery only scans `[LuaExtension]` on the extended type |
| XML on hot-update types ignored / unsupported | Hot-update assemblies must use `[LuaExtension]`, not XML |

## Learning path

| | |
|---|---|
| **Previous** | [LuaAlias](/docs/guides/lua-alias/) |
| **Next** | [Common zlua APIs](/docs/guides/zlua-lib/) |

## Related

- [Spec 13](/docs/spec/13-EXTENSION-METHODS/)
- [LuaAlias](/docs/guides/lua-alias/) (a separate XML scheme; do not mix)
- [Method overloads](/docs/guides/overloads/)
- [Member binding](/docs/spec/metatable/03-BINDING/)
