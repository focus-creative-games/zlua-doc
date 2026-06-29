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

## 键空间规则（注册期强制）

对同一类型、同一静态/实例域：

```text
{ 默认 C# 方法名 } ∩ { 别名 } = ∅
```

| 约束 | 说明 |
|------|------|
| 别名 ≠ 已有默认方法名 | 含继承链上已注册到该元表的方法名 |
| 别名之间唯一 | 同类型内不得重复 |
| 默认名不得占用别名 | 例如不能同时存在 `run_i32()` 方法与 `[LuaAlias("run_i32")]` |

**禁止示例：**

```csharp
[LuaAlias("Run")]           // 错误：与 dispatch 键 Run 冲突
public void Run(int value) { }

[LuaAlias("GetValue")]      // 错误：与已有方法 GetValue 冲突
public void Run(int value) { }
public int GetValue() => 0;
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

## 与 `get_method` / `register_method` 的关系

| 方式 | 时机 | 适用 |
|------|------|------|
| `[LuaAlias]` / XML | 类型 `EnsureBinding` 时 | 编译期固定、热路径首选 |
| `zlua.get_method` + `register_method` | Lua 运行时 | 无法改 C#、或动态绑定 |

二者语义等价：均为 methodTable 上的 **额外键**，不替换默认方法名的 dispatch。

## Mono / Il2Cpp 支持

| 运行时 | 支持 |
|--------|:----:|
| Mono (Editor) | ✅ |
| Il2Cpp (Player) | ❌（MVP 未实现） |

## 相关文档

- [方法重载指南](../../guides/methods-and-overloads)
- [方法重载规范](../../spec/method-overload-spec) §5
- [LuaAlias 源码](https://github.com/focus-creative-games/zlua/blob/main/Runtime/Common/LuaAliasAttribute.cs)
