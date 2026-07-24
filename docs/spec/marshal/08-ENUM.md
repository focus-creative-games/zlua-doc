---
sidebar_position: 14
title: "枚举 Marshal"
---

# 枚举 Marshal

> **规范性：** C# `enum` 在 Lua 与 C# 之间的默认 Marshal 规则。  
> **相关：** 类型表常量字段 → [`../02-TYPE-SYSTEM.md`](../02-TYPE-SYSTEM) §枚举；boxed 形态 → [`../05-LIB.md`](../05-LIB) `box`/`unbox`；`ref` enum → [`03-BYREF.md`](./03-BYREF)；`[LuaMarshalAs]` → [`02-MARSHAL-AS.md`](./02-MARSHAL-AS)。

**平台原则：** Mono 与 Il2Cpp 的 **Lua 可见语义一致**；枚举默认 **不** 推送 userdata，而按 **integer / number** Marshal。

---

## 1. 设计要点

枚举在 C# 中为 **值类型**，底层为单一整型字段。Lua 侧：

| 场景 | 形态 |
|------|------|
| **默认传参** | **integer**（Lua 5.4+ 优先）或 **number** |
| **boxed 实例** | **ByObjUserData**；**仅** 经显式 [`zlua.box`](../05-LIB) |
| **类型表常量** | **integer / number** 字段（**非** userdata） |

枚举类型表 **无** `SMT.__call`；**不可** 像 struct 那样 `EnumType(...)` 构造 ByVal userdata。

---

## 2. 默认规则（C# ↔ Lua）

未标注 `[LuaMarshalAs]` 时：

| 方向 | 默认形态 | 说明 |
|------|----------|------|
| **C# → Lua** | **integer**（优先）或 **number** | 推送枚举的 **底层整数值**；**不** 推送 userdata |
| **Lua → C#** | **integer** / **number** | 接受整型 Lua 值，按目标枚举 **底层类型** 转换并 `Enum.ToObject` / 等价路径 |
| **Lua → C#**（备选） | **ByObjUserData**（boxed enum） | 从 boxed 对象解包 underlying 整型 |

**不接受**（除非 `[LuaMarshalAs]` 另行规定）：默认 Marshal 为 **string**（枚举名）、**boolean**、或普通 **table**。

---

## 3. 底层类型与范围

Codegen / 反射须读取枚举 **underlying type**（`System.Int32`、`System.Byte` 等）：

| 底层类型 | Push 优先 | Pop 接受 |
|----------|-----------|----------|
| `sbyte` … `ulong` | integer / number | integer / number（须为整型） |
| 非整型底层（罕见） | number | number |

Pop 时校验 Lua 整型值是否落在底层类型可表示范围内；越界 → `luaL_error`。

整型基元规则（integer vs number）见 [`01-OVERVIEW.md`](./01-OVERVIEW) §1.1。

---

## 4. 与类型表常量字段的关系

Bind 期将枚举 **public static literal** 写入类型表 `E`：

```lua
local Color = CSharp.AC['MyGame.Color']
assert(Color.Red == 0)    -- integer / number，非 userdata
```

访问路径：`CSharp.AC['MyGame.Color'].Red`。

下列写法作为 **enum 形参** 时等价（默认 marshal）：

```lua
local e = Color.Red
foo(e)
foo(Color.Red)
foo(1)   -- 裸整型，须能转换为该 enum
```

详见 [`../02-TYPE-SYSTEM.md`](../02-TYPE-SYSTEM) §枚举类型。

---

## 5. Boxed 形态（非默认，`zlua.box`）

当脚本需要 **boxed enum 实例**（`object` 形参、`Array.SetValue`、长生命周期 ByObj 等）：

```lua
local Color = CSharp.AC['MyGame.Color']
local boxed = zlua.box(Color, Color.Red)
-- 或
local boxed2 = zlua.box(Color, 2)
```

| 项 | 说明 |
|----|------|
| 第一参数 | 枚举类型表、`zlua.typeof(E)` 或等价 typeArg |
| 第二参数 | integer / number（整型）；或同枚举常量字段值 |
| 返回值 | **ByObjUserData**（boxed 对象；**不是** struct ByVal payload） |
| 拆箱 | `zlua.unbox(boxed)` → underlying **integer** |

作为 **enum 形参** 传入 C# 时，ByObjUserData 与 integer/number **均接受**（§2）。

**`zlua.box` 产物用于 `ref Color`：** 为 ByObjUserData，走 [`03-BYREF.md`](./03-BYREF) **引用/临时槽** 路径（非 ByValUserData payload 直传）。

---

## 6. `ref` / `out` / `in` enum 形参

见 [`03-BYREF.md`](./03-BYREF)：

| Lua 实参 | 行为 |
|----------|------|
| **OpaqueValue**（类型兼容） | 传 handle 地址 |
| **ByValUserData**（若存在且类型 == enum） | 传 payload 地址 |
| **integer / number** | 拷贝进栈临时变量，传临时地址；Lua 裸值 **不变** |
| **`zlua.box` 产物**（ByObj） | 指针写入临时槽，传临时地址 |

C#→Lua：`ref enum` 默认 **OpaqueValue**；见 [`04-OPAQUE.md`](./04-OPAQUE)。

---

## 7. `[LuaMarshalAs]` 扩展

| 标注 | enum by-val |
|------|-------------|
| **`Default`** | §2 规则 |
| **`UserData`** | **非法**（by-val enum 不可强制 userdata）；回退 Default，Editor 打错误日志 |
| **`OpaqueValue`** | by-val **合法**（C#→Lua；通常无实质必要）；`ref`/`out`/`in` 时 C#→Lua 默认已是 OpaqueValue |
| **`Table` / `UnpackedValues`** | **非法**（仅 struct / class / interface） |

boxed 形态仍须 **`zlua.box`**；**无** enum `SMT.__call`。

非法标注行为见 [`02-MARSHAL-AS.md`](./02-MARSHAL-AS) §非法标注。

---

## 8. 与 struct / class 的差异（摘要）

| 项 | enum | struct | class |
|----|------|--------|-------|
| 默认跨边界 | integer/number | ByValUserData / StructUserData | ClassUserData |
| 类型表 `__call` | **无** | `.ctor` | `.ctor` |
| boxed / 实例构造 | 仅 `zlua.box` | `Type(...)` / `_default` | `Type(...)` |
| 类型表常量 | integer/number | 通常无 | 静态成员 |
| `ref` 写回 | Opaque / 匹配 ByValUserData | ByValUserData / Opaque；其它进临时槽 | 见 [`06-CLASS.md`](./06-CLASS) |

---

## 9. Mono / Il2Cpp 一致性

| 项 | 要求 |
|----|------|
| 默认 Push / Pop | integer/number ↔ 底层整型 |
| 类型表常量 | integer/number |
| boxed | **`zlua.box`** → ByObjUserData |
| 范围校验 | 一致 |
| 错误消息 | 一致或等价 |

---

## 10. 相关文档

| 文档 | 内容 |
|------|------|
| [`01-OVERVIEW.md`](./01-OVERVIEW) | 默认矩阵、integer/number |
| [`03-BYREF.md`](./03-BYREF) | `ref` / `out` / `in` |
| [`04-OPAQUE.md`](./04-OPAQUE) | C#→Lua byref |
| [`05-STRUCT.md`](./05-STRUCT) | ByVal / ByObj 与 box 对比 |
| [`../02-TYPE-SYSTEM.md`](../02-TYPE-SYSTEM) | 枚举类型表结构 |
| [`../05-LIB.md`](../05-LIB) | `box`、`unbox` |
