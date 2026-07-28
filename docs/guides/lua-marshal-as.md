---
sidebar_position: 11
title: LuaMarshalAs 与高级 0GC
description: 覆盖默认 Marshal；OpaqueValue / UnpackedValues / Table；简单 XML 规则。
---

# LuaMarshalAs 与高级 0GC

当默认 Marshal（见 [速查表](/docs/reference/marshal-cheatsheet/)）不够用时，用 **`[LuaMarshalAs]`** 或 **XML** 覆盖。权威全文：[02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/)。本篇只讲常用场景。

## 何时需要

- 希望 `byte[]` ↔ Lua string（`Bytes`）
- 用 **多栈槽** 或 **单 table** 组装 / 拆开 class/struct（`UnpackedValues` / `Table`）
- C#→Lua 强制 **Opaque**（轻量、可写回；`ref`/`out`/`in` **默认已是**）
- 预编译 DLL 无法改源码 → Settings 挂 XML

可标注：**参数 / 返回值 / 字段 / 属性 / 类型（class、struct）**。  
**不可**标在方法上；**不可**标在仍含未绑定泛型形参的槽位。

## 常用 `LuaMarshalType`

| 值 | 用途（教程级） |
|----|----------------|
| `Default` | 不覆盖 |
| `Bytes` | `byte[]` ↔ Lua string（octet） |
| `OpaqueValue` | **仅 C#→Lua**；Push Opaque；`ref`/`out`/`in` 默认已是 |
| `UnpackedValues` | 多连续栈槽 ↔ `Members` 列出的字段/属性（**0GC 友好**的展开传递） |
| `Table` | 单个 Lua table ↔ `Members` |
| `ParamsTable` | 仅 `params T[]`：强制顺序 table；**无** Members |
| `UserData` | 实质几乎只对 `string` 有意义（改走 ByObj） |

`Table` / `UnpackedValues` **必须**配置 `Members`；名字以 `?` 结尾表示 Table 侧缺键不赋值。

## 示例

### Bytes

```csharp
public void Send([LuaMarshalAs(LuaMarshalType.Bytes)] byte[] payload) { }
```

Lua 传 **string**（原始字节语义），不要传 `byte[]` userdata。

### UnpackedValues（多槽，少 table 分配）

```csharp
public void Foo(
    [LuaMarshalAs(LuaMarshalType.UnpackedValues, Members = new[] { "X", "Y" })]
    Vector2 v) { }
```

```lua
host:Foo(2.0, 1.0)   -- 两槽 → X, Y
```

### Table

```csharp
public void Bar(
    [LuaMarshalAs(LuaMarshalType.Table, Members = new[] { "X", "Y", "Tag?" })]
    MyPacket p) { }
```

```lua
host:Bar({ X = 1, Y = 2 })   -- Tag 可选
```

### OpaqueValue 与 0GC

- **值类型 / 引用类型** 在 C#→Lua byref 路径上默认 Opaque：脚本用 `get_opaquevalue` / `set_opaquevalue` 读写，避免无谓装箱或多余 userdata  
- by-val 也可显式标 `OpaqueValue` 强制轻量 Push（基元上通常无实质收益）  
- **不要**把 Opaque 句柄存到跨帧全局表；见 [ref/out/in](/docs/guides/ref-out-in/)  

### params 陷阱

默认 **不能** `Sum(1,2,3)` 多槽隐式收集；须传 table / 数组 userdata / `nil`。需要强制 table 时用 `ParamsTable`。

## 优先级（口诀）

**槽位 Attribute → XML → 类型级 Attribute → 内置默认**；Attribute 胜 XML。

非法类型/方向标注 → 回退 `Default` + Editor 日志；缺 `Members` 等配置错误 → **绑定期 / Generate 失败**。

## 简单 XML 规则

预编译程序集：在 Settings **MarshalAs Xml Paths** 列出 XML。Mono 运行时解析；Il2Cpp 在 **Generate** 时写入表，**Player 不读 XML**。

```xml
<?xml version="1.0" encoding="utf-8"?>
<ZLuaMarshalAs version="1">
  <Assembly name="UnityEngine.CoreModule">
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
  </Assembly>
</ZLuaMarshalAs>
```

要点：

- `Param` 用 **`index`（0-based，不含 this）**，禁止用参数名  
- `type` 用 **`OpaqueValue`**，不要用废弃名 `OpaqueLightUserData`  
- 无「方法级」MarshalAs；嵌套类型 `Outer+Inner`；泛型容器写开放定义 ``Foo`1``  

完整 schema 见 [规范 §9](/docs/spec/marshal/02-MARSHAL-AS/)。







## 学习路径

| | |
|---|---|
| **上一篇** | [ref / in / out](/docs/guides/ref-out-in/) |
| **下一篇** | [方法重载](/docs/guides/overloads/) |

## 相关文档

- [02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/)  
- [OPAQUE](/docs/spec/marshal/04-OPAQUE/)  
- [ref / out / in](/docs/guides/ref-out-in/)  
- [Marshal 速查表](/docs/reference/marshal-cheatsheet/)
