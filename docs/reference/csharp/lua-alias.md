---
sidebar_position: 4
title: LuaAlias
description: "[LuaAlias] 方法重载别名属性说明。"
---

# LuaAlias

为 C# 方法重载提供 **Lua 侧额外键名**，O(1) 绑定到单一重载，绕过运行时分派（dispatch）。

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

`[LuaAlias]` 在 Bind 期 **允许**与默认方法名或其它别名重复；重复则并入同一 overload 组（走 dispatch）。若别名下 **仅一个** 候选，则为 direct，热路径首选。

完整规则见 [重载规范 §5](/docs/spec/04-METHOD-OVERLOAD/)。同名多候选时还会自动挂全签名键（§3.7）。

```csharp
[LuaAlias("run_i32")]   // 通常单候选 → direct
public void Run(int value) { }

public void Run(string value) { }  // 默认名仍进 "Run" 组
```

## XML 配置（不可改源码时）

```xml
<Type fullName="Demo">
  <Method name="Run" signature="(System.Int32)" alias="run_i32"/>
</Type>
```

| 字段 | 说明 |
|------|------|
| `fullName` | 类型全名 |
| `name` | C# 方法名 |
| `signature` | 仅参数部分，如 `(System.Int32)` |
| `alias` | Lua 侧键名 |

优先级：**Attribute > XML**。合并后执行与 § 键空间相同的校验。

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
