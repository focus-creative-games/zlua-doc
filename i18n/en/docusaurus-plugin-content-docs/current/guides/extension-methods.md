---
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
| Hot-update assemblies | Attributes or explicit XML registration before first binding; see [InteropMetadata](/docs/reference/csharp/interop-metadata/) |

**Do not** put `[LuaExtension]` on the extension class (that would require scanning every assembly to discover extensions).

```csharp
using ZLua;

public static class MyClassExt
{
    public static void ResetLocal(this MyClass self)
    {
        // ...
    }
}

[LuaExtension(typeof(MyClassExt))]
public class MyClass { }
```

For third-party / uneditable types, use XML (`this` parameter type must match `Type/@fullName`):

```xml
<?xml version="1.0" encoding="utf-8"?>
<!-- Hot-update XML requires explicit registration before binding. -->
<ZLuaExtensions version="1">
  <Assembly name="UnityEngine.CoreModule">
    <Type fullName="UnityEngine.Transform">
      <Extension assembly="Assembly-CSharp" fullName="MyGame.TransformExt"/>
    </Type>
  </Assembly>
</ZLuaExtensions>
```

For the same extended type, Attribute and XML extension-class lists are **unioned**. Binding **T** also collects `[LuaExtension]` from **base types**.

Settings XML configures precompiled / AOT assemblies known at build time. For hot-update assemblies, use Attributes or call the corresponding [InteropMetadata.Register*Xml](/docs/reference/csharp/interop-metadata/) in Il2Cpp Player after loading the assembly and before first type binding. Editor Mono registration is a no-op.

## Lua usage

```lua
local obj = CSharp.AC.MyClass()
obj:ResetLocal()   -- colon call; underlying static extension MyClassExt.ResetLocal(obj)
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
| Hot-update assemblies | Attributes or explicit XML registration before first binding; see [InteropMetadata](/docs/reference/csharp/interop-metadata/) |

## Related

- [Spec 13](/docs/spec/13-EXTENSION-METHODS/)
- [LuaAlias](/docs/guides/lua-alias/) (a separate XML scheme; do not mix)
- [Method overloads](/docs/guides/overloads/)
- [Member binding](/docs/spec/metatable/03-BINDING/)
