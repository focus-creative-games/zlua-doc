---
title: Extension 方法
description: "[LuaExtension] 与 XML 将 C# extension 挂到被扩展类型的实例方法表。"
---

# Extension 方法

把 C# **extension methods** 挂到被扩展类型的 Lua **实例** methodTable，支持 `obj:ExtFoo(...)`。权威：[13-EXTENSION-METHODS](/docs/spec/13-EXTENSION-METHODS/)。

**不做**全局扫描 `ExtensionAttribute`。配置模型是：**被扩展类型 → 扩展类列表**；Bind 该类型时再反射这些扩展类。

## 配置

| 方式 | 用法 |
|------|------|
| 能改被扩展类型源码（含热更新程序集） | **`[LuaExtension(typeof(FooExt), …)]` 标在被扩展类型上** |
| 第三方 / 预编译、**非热更新**类型 | Settings **`luaExtensionXmlPaths`** + 根元素 **`ZLuaExtensions`** |
| 热更新程序集 | Attribute 或首次绑定前显式注册 XML；见 [InteropMetadata](/docs/reference/csharp/interop-metadata/) |

`[LuaExtension]` **不要**标在扩展类上（否则为发现扩展必须扫全程序集）。

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

第三方 / 无法改源码的类型用 XML（`this` 参数类型须与 `Type/@fullName` 一致）：

```xml
<?xml version="1.0" encoding="utf-8"?>
<!-- 仅非热更新被扩展类型；热更程序集请用 [LuaExtension] -->
<ZLuaExtensions version="1">
  <Assembly name="UnityEngine.CoreModule">
    <Type fullName="UnityEngine.Transform">
      <Extension assembly="Assembly-CSharp" fullName="MyGame.TransformExt"/>
    </Type>
  </Assembly>
</ZLuaExtensions>
```

同一被扩展类型上：Attribute 与 XML 的扩展类列表取 **并集**。Bind **T** 时还会收集 **基类**上的 `[LuaExtension]`。

Settings XML 用于构建期已知的预编译 / AOT 程序集。热更程序集可用 Attribute，或在 Il2Cpp Player 加载程序集后、首次类型绑定前调用对应的 [InteropMetadata.Register*Xml](/docs/reference/csharp/interop-metadata/)；Editor Mono 的注册方法为空实现。

## Lua 用法

```lua
local obj = CSharp.AC.MyClass()
obj:ResetLocal()   -- 冒号；底层是静态扩展方法 MyClassExt.ResetLocal(obj)
```

筛选规则：扩展类上带 `ExtensionAttribute` 的 `public static` 方法，且第一个参数能接住该被扩展类型（含 `this Base` 用于 `Derived`）。开放泛型扩展 **不支持**。

## 与实例方法同名

扩展与真实例 **合并竞争**（同一 overload 组），**无**「实例优先」。消歧用全签名键或 `[LuaAlias]`。见 [方法重载](/docs/guides/overloads/)。

## 常见错误

| 现象 | 原因 |
|------|------|
| `member not found`（`obj:Foo`） | 未在被扩展类型（或基类）配置扩展类；或 Il2Cpp 未重新 Generate |
| 只能 `Ext.Foo(obj)` | 未走 static-as-instance / 未进 IMT（实现须符合规范 §4） |
| 调到错误重载 | 合并竞争；用全签名键或 Alias 消歧 |
| 标在扩展类上的 Attribute 无效 | 发现只扫被扩展类型上的 `[LuaExtension]` |
| 热更新程序集 | Attribute 或首次绑定前显式注册 XML；见 [InteropMetadata](/docs/reference/csharp/interop-metadata/) |

## 相关文档

- [规范 13](/docs/spec/13-EXTENSION-METHODS/)
- [LuaAlias](/docs/guides/lua-alias/)（另一套 XML，勿混用）
- [方法重载](/docs/guides/overloads/)
- [成员绑定](/docs/spec/metatable/03-BINDING/)
