---
sidebar_position: 11
title: LuaMarshalAs
description: 覆盖默认 Marshal；Bytes / Opaque / UnpackedValues / Table / UserData 与 XML。
---

# LuaMarshalAs

当默认 Marshal（见 [速查表](/docs/reference/marshal-cheatsheet/)）不够用时，用 **`[LuaMarshalAs]`** 或 **XML** 覆盖。权威全文：[02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/)。0GC 专题见 [0GC Marshal](/docs/guides/zero-gc-marshal/)。

## 何时需要

- `byte[]` ↔ Lua string（`Bytes`）
- struct 用 **多栈槽** 或 **单 table** 组装（`UnpackedValues` / `Table`）
- C#→Lua 强制 **Opaque**（`ref`/`out`/`in` **默认已是**）
- 巨大 `string` 不想拷成 Lua string（`UserData` → ByObj）
- 预编译 DLL 无法改源码 → Settings 挂 XML

可标注：**参数 / 返回值 / 字段 / 属性 / 类型（class、struct）**。  
**不可**标在方法上；**不可**标在仍含未绑定泛型形参的槽位。

## 常用 `LuaMarshalType`

| 值 | 适用（摘要） | 用途 |
|----|--------------|------|
| `Default` | 全部 | 不覆盖 |
| `Bytes` | `byte[]` / `string` | octet ↔ Lua string |
| `OpaqueValue` | **仅 C#→Lua** | Push Opaque；byref 默认已是 |
| `UnpackedValues` | **struct**（**不含** Nullable / class） | 多连续栈槽 ↔ `Members` |
| `Table` | **struct** / **`Nullable<struct>`**（不含 class） | 单 table ↔ `Members` |
| `UserData` | 实质几乎只对 **`string`** | 强制 ByObjUserData |

`Table` / `UnpackedValues` **必须**配置 `Members`；名字以 `?` 结尾表示 Table 侧缺键不赋值。

## 用例

### Bytes

```csharp
public void Send([LuaMarshalAs(LuaMarshalType.Bytes)] byte[] payload) { }
```

```lua
host:Send("\0\1\2\3")   -- Lua string，原始字节语义
```

### UnpackedValues（struct 多槽）

形参占用 **N 个** Lua 栈位（N = `Members` 长度），热路径常用：

```csharp
using ZLua;

public struct Vec2 { public float X, Y; }

public class Mover
{
    public void Move(
        [LuaMarshalAs(LuaMarshalType.UnpackedValues, Members = new[] { "X", "Y" })]
        Vec2 delta) { /* ... */ }

    [return: LuaMarshalAs(LuaMarshalType.UnpackedValues, Members = new[] { "X", "Y" })]
    public Vec2 Origin() => new Vec2 { X = 0, Y = 0 };
}
```

```lua
local m = CSharp.AC.Mover()
m:Move(3.0, 4.0)           -- 两槽 → X, Y

local x, y = m:Origin()    -- C#→Lua 展开多返回值
print(x, y)
```

类型级标注（该类型所有默认 Marshal 槽位）：

```csharp
[LuaMarshalAs(LuaMarshalType.UnpackedValues, Members = new[] { "x", "y", "z" })]
public struct Vector3 { public float x, y, z; }
```

### Table（struct / Nullable\<struct\>）

占用 **1** 个栈槽；可读性更好，但 Lua 侧有 table 分配：

```csharp
public struct Packet
{
    public int Id;
    public float X, Y;
    public string Tag;   // 可选键见 Members "?"
}

public void Submit(
    [LuaMarshalAs(LuaMarshalType.Table, Members = new[] { "Id", "X", "Y", "Tag?" })]
    Packet p) { }

public void TryPlace(
    [LuaMarshalAs(LuaMarshalType.Table, Members = new[] { "X", "Y" })]
    Vector2? pos) { }
```

```lua
host:Submit({ Id = 1, X = 2, Y = 3 })   -- Tag 可省略
host:TryPlace({ X = 1, Y = 2 })
host:TryPlace(nil)                      -- Nullable 无值
```

XML 等价（预编译程序集）：

```xml
<Type fullName="UnityEngine.Vector3">
  <MarshalAs type="Table" members="x,y,z" />
</Type>
<Type fullName="UnityEngine.Transform">
  <Method name="LookAt" signature="(UnityEngine.Vector3)">
    <Param index="0">
      <MarshalAs type="UnpackedValues" members="x,y,z" />
    </Param>
  </Method>
</Type>
```

### OpaqueValue

```csharp
// by-val 强制 Opaque（C#→Lua）；ref/out/in 无需再标
public void PushPos([LuaMarshalAs(LuaMarshalType.OpaqueValue)] Vector3 p) { }
```

Lua 侧用 `zlua.get_opaquevalue` / `set_opaquevalue`；**不可**跨帧保存。见 [0GC Marshal](/docs/guides/zero-gc-marshal/)、[ref/out/in](/docs/guides/ref-out-in/)。

### UserData（巨大 string）

默认 `string` ↔ Lua string（会拷贝）。标 `UserData` 后走 **ByObjUserData**（托管 `System.String`），避免生成巨大 Lua 字符串：

```csharp
public void HandleHuge(
    [LuaMarshalAs(LuaMarshalType.UserData)] string payload) { }
```

仍会产生 **Lua userdata** GC；并不常见，见 [0GC Marshal](/docs/guides/zero-gc-marshal/)。

### params 陷阱

默认 **不能** `Sum(1,2,3)` 多槽隐式收集；须传 **单个** table / 数组 userdata / `nil`。

## 优先级（口诀）

**槽位 Attribute → XML → 类型级 Attribute → 内置默认**；Attribute 胜 XML。

非法类型/方向 → 回退 `Default` + Editor 日志；缺 `Members` 等 → **绑定期 / Generate 失败**。

## 简单 XML 规则

Settings **MarshalAs Xml Paths**；Mono 运行时解析；Il2Cpp 在 **Generate** 写入表，**Player 不读 XML**。

要点：`Param` 用 **`index`（0-based，不含 this）**；`type` 用 **`OpaqueValue`**（勿用废弃名）；别名走独立 `luaAliasXmlPaths`。完整 schema 见 [规范 §9](/docs/spec/marshal/02-MARSHAL-AS/)。








## 学习路径

| | |
|---|---|
| **上一篇** | [ref / in / out](/docs/guides/ref-out-in/) |
| **下一篇** | [0GC Marshal](/docs/guides/zero-gc-marshal/) |

## 相关文档

- [0GC Marshal](/docs/guides/zero-gc-marshal/)  
- [值类型](/docs/guides/value-types/)  
- [02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/)  
- [OPAQUE](/docs/spec/marshal/04-OPAQUE/)  
- [Marshal 速查表](/docs/reference/marshal-cheatsheet/)
