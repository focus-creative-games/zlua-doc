---
sidebar_position: 11.5
title: 0GC Marshal
description: OpaqueValue、UnpackedValues、string UserData 等少分配 Marshal 套路。
---

# 0GC Marshal

本篇只谈 **少分配 / 零额外托管分配** 的常用 Marshal 手段。默认规则见 [速查表](/docs/reference/marshal-cheatsheet/)；特性语法见 [LuaMarshalAs](/docs/guides/lua-marshal-as/)。权威：[04-OPAQUE](/docs/spec/marshal/04-OPAQUE/)、[02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/)。

> 「0GC」指热路径上 **尽量不** 为这次互调新建 Lua table / Lua string / ByVal userdata / 装箱对象。并非整个程序永不 GC。

## 1. OpaqueValue：引用类型与 struct

**OpaqueValue** 是 lightuserdata 句柄（无 metatable），Push 时不建 ByObj/ByVal userdata。

| 场景 | 行为 |
|------|------|
| `ref` / `out` / `in T`（任意 T） | C#→Lua **默认** Opaque，无需标注 |
| by-val 任意 CLR 类型 | 可显式 `[LuaMarshalAs(OpaqueValue)]`（**仅 C#→Lua**） |

```csharp
public void Touch(ref Transform t) { }           // 默认 Opaque
public void Peek([LuaMarshalAs(LuaMarshalType.OpaqueValue)] MyClass obj) { }
public void PeekStruct([LuaMarshalAs(LuaMarshalType.OpaqueValue)] Vector3 v) { }
```

```lua
-- 在同一次 C#→Lua 同步调用链内
local v = zlua.get_opaquevalue(slot)
zlua.set_opaquevalue(slot, newValue)
-- 需要 userdata 门面时：zlua.to_user_data(slot)（会产生 userdata，见规范）
```

要点：

- **引用类型**与 **struct** 都可走 Opaque，避免为本帧临时对象建完整 userdata  
- **不可**把 Opaque 存进跨 `pcall` / 跨帧的全局表  
- Lua→C# 单独形参上标 `OpaqueValue` **非法**；写回规则见 [ref/out/in](/docs/guides/ref-out-in/)  

## 2. UnpackedValues：struct 多槽展开

对 **普通 struct / 闭合泛型 struct**，用多连续栈槽 ↔ `Members`，**不**创建 Lua table，也 **不**创建 ByVal userdata：

```csharp
public void ApplyForce(
    [LuaMarshalAs(LuaMarshalType.UnpackedValues, Members = new[] { "x", "y", "z" })]
    Vector3 force) { }
```

```lua
rb:ApplyForce(0, 9.8, 0)   -- 三槽；Lua 侧只有 number
```

| 适用 | 不适用 |
|------|--------|
| `struct` / closed generic struct | **`Nullable<T>`**（规范禁止；无法用多槽表达「无值」） |
| 热路径 `Vector2` / `Vector3` / 自定义 blittable 小结构 | class / interface |

`Nullable<struct>` 需要「可空」语义时用 **`Table`**（`nil`↔无值），但 table 本身有 Lua 分配，**不算**本节意义下的 0GC；C#→Lua 临时可空值也可考虑 **Opaque**。

返回值同样可展开为多返回值：

```csharp
[return: LuaMarshalAs(LuaMarshalType.UnpackedValues, Members = new[] { "X", "Y" })]
public Vec2 GetDelta() => ...;
```

```lua
local dx, dy = host:GetDelta()
```

## 3. UserData：巨大 `string` 走 ByObj

默认：`string` ↔ Lua **string**（按内容拷贝）。对超大文本 / 二进制当文本的缓冲，拷贝成本高：

```csharp
public void ProcessHuge(
    [LuaMarshalAs(LuaMarshalType.UserData)] string payload) { }
```

标注后强制 **ByObjUserData**（托管 `System.String` 对象），**不再**生成对应内容的 Lua string。

:::warning 并不少见地「更省」
ByObjUserData **仍会**在 Lua 侧分配 **userdata**，参与 Lua GC。只是避免「再复制一整份 Lua string」。日常短字符串继续用默认即可；本用法 **不常见**。
:::

对 `byte[]` 若要 octet 语义，用 `Bytes`（↔ Lua string），与本节目标不同。

## 对照速记

| 手段 | 典型目标 | Lua 侧额外分配 |
|------|----------|----------------|
| **OpaqueValue** | C#→Lua 的 class / struct / byref | 无 userdata/table（仅 lightuserdata 句柄） |
| **UnpackedValues** | Lua↔C# 的 struct 字段展开 | 无（只用栈上 number 等） |
| **Table** | struct / `Nullable<struct>` 键值 | **有** table |
| **UserData** on `string` | 巨大 string 避免 Lua string 拷贝 | **有** ByObj userdata |








## 学习路径

| | |
|---|---|
| **上一篇** | [LuaMarshalAs](/docs/guides/lua-marshal-as/) |
| **下一篇** | [方法重载](/docs/guides/overloads/) |

## 相关文档

- [LuaMarshalAs](/docs/guides/lua-marshal-as/)  
- [值类型](/docs/guides/value-types/)  
- [ref / out / in](/docs/guides/ref-out-in/)  
- [GC 对比](/docs/compare/GC/)  
- [02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/) · [04-OPAQUE](/docs/spec/marshal/04-OPAQUE/)
