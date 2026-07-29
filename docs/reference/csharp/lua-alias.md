---
sidebar_position: 4
title: LuaAlias
description: "[LuaAlias] 方法重载别名属性说明。"
---

# LuaAlias

为 C# 方法重载提供 **Lua 侧换名键**，O(1) 绑定到单一重载，绕过运行时分派（dispatch）。有别名时 **不再**注册 C# 默认方法名。

```csharp
using ZLua;

public class Demo
{
    [LuaAlias("run_i32")]
    public void Run(int value) { x = value; }

    public void Run(string value) { x = value?.Length ?? 0; }
}
```

```lua
local demo = CSharp.AC.Demo()
demo:run_i32(10)   -- 直接命中 Run(int)
demo:Run("hi")     -- 仍走 Run 的 dispatch
```

## 属性定义

```csharp
[AttributeUsage(AttributeTargets.Method, AllowMultiple = false, Inherited = false)]
public sealed class LuaAliasAttribute : Attribute
{
    public string Alias { get; }
    public LuaAliasAttribute(string alias);
}
```

| 项 | 说明 |
|----|------|
| 目标 | 仅 **Method** |
| 多重 | 每个方法最多一个别名 |
| 继承 | **不**继承到子类重写 |

## 键空间规则

`[LuaAlias]` 在 Bind 期 **替换**该方法的默认 Lua 键；并 **允许**与其它方法的默认名或其它别名重复（重复则并入同一 overload 组，走 dispatch）。若别名下 **仅一个** 候选，则为 direct，热路径首选。

完整规则见 [重载规范 §5](/docs/spec/04-METHOD-OVERLOAD/)。同名多候选时还会自动挂全签名键（§3.7）。

```csharp
[LuaAlias("run_i32")]   // 通常单候选 → direct
public void Run(int value) { }

public void Run(string value) { }  // 默认名仍进 "Run" 组
```

## XML 配置（不可改源码时）

与 `[LuaMarshalAs]` **分开配置**：Settings 使用独立字段 **`luaAliasXmlPaths`**，根元素 **`ZLuaAlias`**。

```xml
<?xml version="1.0" encoding="utf-8"?>
<ZLuaAlias version="1">
  <Assembly name="Assembly-CSharp">
    <Type fullName="Demo">
      <Method name="Run" signature="(System.Int32)" alias="run_i32"/>
    </Type>
  </Assembly>
</ZLuaAlias>
```

| 字段 | 说明 |
|------|------|
| `Assembly/@name` | 程序集短名 |
| `Type/@fullName` | 类型全名 |
| `Method/@name` | C# 方法名 |
| `Method/@signature` | 仅参数部分，如 `(System.Int32)` |
| `Method/@alias` | Lua 侧最终键名（必填；**替换**默认名） |

优先级：**Attribute > XML**。有别名则 **不**再挂 `MethodInfo.Name`。权威全文：[重载规范 §5.4](/docs/spec/04-METHOD-OVERLOAD/)。

## 静态 / 实例

| 方法种类 | 别名写入位置 | Lua 调用 |
|----------|--------------|----------|
| 实例方法 | 实例 `methodTable` | `obj:alias(...)` |
| 静态方法 | 类型表 `methodTable` | `TypeTable.alias(...)` |

## 与全签名键 / `register_method` 的关系

| 方式 | 时机 | 适用 |
|------|------|------|
| 全签名键 `Run(System.Int32)` | Bind 期自动（同名多候选） | 精确点名，无需改 C#、无需 API |
| `[LuaAlias]` / XML | 类型 `EnsureBinding` 时 | 编译期固定短名、热路径首选 |
| `zlua.register_method` | Lua 运行时 | 把 direct（常来自全签名键）挂成自定义短名，便于 `obj:alias(...)` |

`[LuaAlias]` 与 `register_method` 都是 methodTable 上的 **额外短名**；全签名键解决「点名哪一个重载」，短名解决「好读 + 冒号」。

## Mono / Il2Cpp 支持

| 运行时 | 支持 |
|--------|:----:|
| Mono (Editor) | ✅ |
| Il2Cpp (Player) | ✅ |

## 相关文档

- [方法重载指南](/docs/guides/overloads/)
- [方法重载规范](/docs/spec/04-METHOD-OVERLOAD/) §5
- [LuaAlias 源码](https://github.com/focus-creative-games/zlua/blob/main/Runtime/Common/LuaAliasAttribute.cs)
