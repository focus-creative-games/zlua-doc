---
sidebar_position: 3
title: LuaMarshalAs
description: "[LuaMarshalAs] 属性与 LuaMarshalType 枚举。"
---

# LuaMarshalAs

覆盖 C# ↔ Lua 双向调用时的 **默认编组规则**。标注于参数、返回值、方法或字段。

```csharp
using ZLua;

public void SendRaw([LuaMarshalAs(LuaMarshalType.Bytes)] byte[] data) { }

[return: LuaMarshalAs(LuaMarshalType.OpaqueLightUserData)]
public Point2D GetPointOnStack() { ... }
```

## 类型定义

```csharp
public enum LuaMarshalType
{
    Default,
    UserData,
    Bytes,
    OpaqueLightUserData,
}

[Flags]
public enum LuaMarshalFlags
{
    None = 0,
    OptionalField = 1,  // struct table 组装时缺键不报错
}

[AttributeUsage(AttributeTargets.Parameter | AttributeTargets.ReturnValue
    | AttributeTargets.Method | AttributeTargets.Field)]
public sealed class LuaMarshalAsAttribute : Attribute
{
    public LuaMarshalType LuaMarshalType { get; }
    public LuaMarshalFlags Flags { get; set; }
    public LuaMarshalAsAttribute(LuaMarshalType luaMarshalType = LuaMarshalType.Default);
}
```

## LuaMarshalType 说明

| 值 | 方向 | 效果 |
|----|------|------|
| **Default** | 双向 | 使用 [编组速查表](../marshal-cheatsheet) 默认规则 |
| **UserData** | 双向 | 强制 **full userdata**（替代默认 boolean/number/string 等） |
| **Bytes** | 双向 | `byte[]` ↔ Lua **string**（原始 octet，非 UTF-8 文本语义） |
| **OpaqueLightUserData** | **仅 C# → Lua** | Push **lightuserdata** 临时令牌（StructStackScope handle）；须同步链内使用或 `zlua.to_user_data` 升级 |

## 合法组合（摘要）

`Default` 对所有类型均合法。下表为 **Default 之外** 可显式标注的值：

| C# 类型 | 合法 LuaMarshalType |
|---------|---------------------|
| 基元（bool、char、整型、float/double） | UserData |
| IntPtr / UIntPtr / nint / nuint | UserData |
| string | UserData、Bytes |
| byte[] | Bytes、UserData |
| T[] / 多维数组 | UserData |
| enum | UserData |
| struct | UserData、OpaqueLightUserData（后者仅 C#→Lua） |
| class / interface / Delegate / object | UserData |
| Nullable\<T\> | 同 T 的合法集合 |
| 非托管指针、函数指针、TypedReference、decimal、ref struct | **仅 Default**（或类型本身不支持） |

**方向过滤：** `OpaqueLightUserData` 标注于纯 **Lua→C# 形参** 时视为非法，Editor 回退 Default 并打错误日志。

完整规则见 [编组规范 §6.2](../../spec/marshal/#62-各类型的合法-luamarshaltype-集合)。

## 非法标注行为

| 行为 | 说明 |
|------|------|
| 编组 | 静默回退 **Default**，不中断调用 |
| Editor 日志 | 输出 `[ZLua] Invalid LuaMarshalAs: ... falling back to Default` |
| Player | 不打印日志，仍回退 Default |

## 示例

### byte[] 作为 Lua string

```csharp
public void Upload([LuaMarshalAs(LuaMarshalType.Bytes)] byte[] payload) { }
```

```lua
Upload("\001\002\003")  -- Lua string 作为字节序列
```

### 强制 enum userdata

```csharp
public void SetColor([LuaMarshalAs(LuaMarshalType.UserData)] Color c) { }
```

```lua
local c = CSharp.AC['MyGame.Color'](CSharp.AC['MyGame.Color'].Red)
SetColor(c)
```

### C#→Lua 栈上 struct 临时句柄

```csharp
[return: LuaMarshalAs(LuaMarshalType.OpaqueLightUserData)]
public Point2D GetPointHandle() { ... }
```

```lua
local opaque = GetPointHandle()      -- lightuserdata，同步链内有效
local ud = zlua.to_user_data(opaque) -- 升级为 StructUserData
```

## 解析优先级

对单个形参 / 返回值：

1. 参数 / 返回值上的 `[LuaMarshalAs]`
2. 方法级 `[LuaMarshalAs]`（覆盖整方法，除非被更细粒度标注覆盖）
3. Default

## Mono / Il2Cpp 支持

| 运行时 | 支持 |
|--------|:----:|
| Mono (Editor) | ✅ |
| Il2Cpp (Player) | ❌（MVP 未实现） |

## 相关文档

- [编组速查表](../marshal-cheatsheet)
- [ref / out / in 指南](../../guides/marshal-ref-out-in)
- [编组规范 §6](../../spec/marshal/#6-luamarshalas-与-luamarshaltype)
- [源码 LuaMarshalAsAttribute.cs](https://github.com/focus-creative-games/zlua/blob/main/Runtime/Common/LuaMarshalAsAttribute.cs)
