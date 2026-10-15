---
sidebar_position: 8
title: "`[LuaMarshalAs]` 与 `LuaMarshalType`"
---

# `[LuaMarshalAs]` 与 `LuaMarshalType`

> **规范性：** 参数、返回值、字段、属性及类型（`class` / `struct`）上的 Marshal 覆盖规则。
> **默认矩阵：** 未覆盖时见 [01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/)。
> **源码：** `ZLua.Common` 中的 `LuaMarshalAsAttribute`、`LuaMarshalType`（枚举名以本文为准，含 **`OpaqueValue`**）。
> **外部配置：** 预编译程序集可通过 XML 配置等价规则，见 **§9**。

## 1. 概述

`[LuaMarshalAs]` 可标注于：

- **参数**、**返回值**、**字段**、**属性**
- **类型**（`class` / `struct` 上的类型级默认）

**不可** 标注于 **方法**（须对每个参数/返回值分别标注）。

成员槽位（参数 / 返回值 / 字段 / 属性）可标注于 **开放或未完全闭合** 的 CLR 类型（如 `T`、`List<T>`）；**§3 合法集合**在解析时按 **实际用于 Marshal 的类型**判定（闭合方法用闭合槽位类型）。**类型级**标注仍仅允许非泛型类型（§1.1）。XML 与 Attribute **同一约束**（§9.3.1）。

覆盖标注须符合 **§3 合法集合**，否则 **§4.1** 回退 `Default` 并在 Editor 打错误日志（与其它 `LuaMarshalType` 相同；XML / Generate 见 §4.2）。

```csharp
public enum LuaMarshalType
{
    Default,
    UserData,
    Bytes,
    OpaqueValue,
    UnpackedValues,   // struct / closed generic struct：多 Lua 栈槽 ↔ 列出的成员（不含 Nullable）
    Table,            // struct / closed generic struct / Nullable<struct>：单个 Lua table ↔ 列出的成员
    ActualTypeUserData, // 仅返回值：ByObj 门面 = 运行时实际类型（见 §2）
}

[AttributeUsage(
    AttributeTargets.Parameter | AttributeTargets.ReturnValue |
    AttributeTargets.Field | AttributeTargets.Property |
    AttributeTargets.Class | AttributeTargets.Struct)]
public sealed class LuaMarshalAsAttribute : Attribute
{
    public LuaMarshalType LuaMarshalType { get; }

    /// <summary>
    /// <see cref="LuaMarshalType.Table"/> / <see cref="LuaMarshalType.UnpackedValues"/> 必填。
    /// 元素为 CLR 字段名或 property 名，可混合；顺序即 UnpackedValues 的栈顺序 / Table 的读写顺序。
    /// 名字以 '?' 结尾表示 Table、Lua→C# 时缺键不赋值（§6）。
    /// </summary>
    public string[] Members { get; set; }

    public LuaMarshalAsAttribute(LuaMarshalType luaMarshalType = LuaMarshalType.Default);
}
```

### 1.1 泛型：类型级 vs 成员槽位

| 禁止 | 允许 |
|------|------|
| **类型级**标在开放定义上：`[LuaMarshalAs] class MyList<T>` / ``struct Foo`1``；XML 类型级 `MarshalAs` 挂在泛型类型上 | 类型级标在 **非泛型** `class` / `struct` 上 |
| 指望闭合实例 `List<int>` **继承** ``List`1`` 上的类型级规则 | 成员规则挂在开放泛型 **声明类型** 的 XML `Type`（``MyList`1`` / `GameObject`）下，目标为 Field / Property / Param / Return（**含** `T` / `List<T>` 等未完全闭合槽位） |
| | Attribute / XML 标在开放泛型方法的返回值/形参上（如 `T GetComponent<T>()` 的 `Return` + `ActualTypeUserData`） |

说明：

- C# **不能**在闭合实例 `List<int>` 上写类型级 attribute；类型级只存在于类型定义。因此 **泛型类型（开放定义）禁止类型级** `[LuaMarshalAs]` / XML 类型级 `MarshalAs`；闭合实例也 **不** 通过「归一到开放定义」继承类型级规则。
- 成员规则绑定在 **开放方法/成员定义**（XML 按 definition token；Attribute 在闭合 `MethodInfo` 上仍可见）。**§3 合法性**在 Resolve 时按 **当前 MethodInfo/字段的 CLR 类型**判定：GTAP / `inflate` / `MakeGenericMethod` 之后用 **闭合** 槽位类型（兼容则生效；不兼容 → §4）。
- 例：XML 为 `GetComponent`（``GetComponent`1``，`signature="()"`）配置 `Return`=`ActualTypeUserData`；调用 `GetComponent(zlua.typeof(BoxCollider))` 闭合后返回类型为 `BoxCollider`，按 class 合法集合接受 ActualType。

**类型级**违反 → **Il2Cpp Generate / XML 失败**；**Mono Attribute** 路径见 **§4.1**。成员槽位上的非法 `LuaMarshalType`（相对闭合后类型）→ 同 §4（不因「曾为开放 `T`」单独失败）。

## 2. `LuaMarshalType` 枚举说明

| 值 | 适用方向 | 说明 |
|----|----------|------|
| **`Default`** | 双向 | 使用 [01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/) 默认规则，不做额外转换。 |
| **`UserData`** | 双向 | **仅** 可标注于 **托管引用类型** 与 **struct**（§3）；**不可** 用于基元 / `enum` / `IntPtr` 等。语义：强制走 **UserData 形态**（ByObjUserData / ByValUserData / ClassUserData 等）。<br>• **实质有效的目标：** 几乎只有 **`string`**——默认 C#↔Lua 为 Lua **string**，标注后改为 **ByObjUserData**（托管 `System.String` 对象）<br>• **class / interface / 数组 / 普通 struct / object：** 默认 marshal **已是** UserData，标注与 `Default` **等价**<br>• **`Delegate`：** 可标注，但 **无实质作用**——仍按 [09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/) Marshal 为 **Lua function** 或既有 bridge |
| **`Bytes`** | 双向 | **强制** 在 C# **`byte[]`** 与 Lua **`string`** 之间转换。<br>• C# **`byte[]`**：默认 ByObjUserData → Lua **string**（原始 octet，非 UTF-8 文本语义）<br>• 标注于 **`byte[]` 形参/返回值** 时，Lua 侧须传 **string**；Pop 时 **不接受** ByObjUserData / table<br>• 若标注于 **`string`** 形参/返回值，则走 **`byte[]` ↔ string** 的对偶规则 |
| **`OpaqueValue`** | **仅 C# → Lua** | Push **OpaqueValue**（lightuserdata，无 metatable），见 [04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/)。<br>• **`ref` / `out` / `in T`**（任意 `T`）**默认** 即为本形态（无需标注）<br>• **by-val** 可对 **struct / 托管引用 / enum / 指针等**（见 §3）显式标注强制 Push Opaque；**基元** 与 **`IntPtr` / `UIntPtr` / `nint` / `nuint`** **禁止** 标注（仅 `Default`，§3）——默认已是 integer/number，无实质必要，且便于热路径优化<br>• 脚本经 `zlua.get_opaquevalue` / `zlua.set_opaquevalue` 读写；回传给 C# 时遵循 [04-OPAQUE.md §6](/docs/spec/marshal/04-OPAQUE/)<br>• **不可** 跨调用持久化；**Lua → C#** 单独形参上标注本类型视为 **非法**（§3.1） |
| **`UnpackedValues`** | **双向** | **普通 struct / closed 泛型 struct**（§3；**不含** `Nullable` / class / interface）。将 **§5** 中 `Members` 列出的成员与 **多个连续 Lua 栈槽** 互转：<br>• **Lua → C#**：从栈上按名单 **顺序** Pop N 个值，写入对应 field/property<br>• **C# → Lua**：按名单 **顺序** Push N 个值（多返回值或展开 push）<br>须配置 **`Members`**；未配置或目标非法 → **§4**。该形参/返回值占用 **N 个** Lua 栈槽（§5.6） |
| **`Table`** | **双向** | **普通 struct / closed 泛型 struct / `Nullable<struct>`**（§3；**不含** class / interface）。将 **§5** 中 `Members` 列出的成员与 **单个 Lua table** 互转：<br>• **Lua → C#**：Pop 一个 table（或对 `Nullable` 允许 `nil`→无值），按 **键名** 读取并写入 field/property<br>• **C# → Lua**：Push 一个 table（`Nullable` 无值 → `nil`）<br>须配置 **`Members`**（解析在 **底层 struct** 上）；未配置或目标非法 → **§4**。该形参/返回值占用 **1 个** Lua 栈槽 |
| **`ActualTypeUserData`** | **仅 C# → Lua（返回值）** | **仅**可标注于 **返回值**，且声明类型须为默认走 **ByObj UserData** 的托管引用类型（`class` / `interface` / `object` / 数组等，§3）。语义：<br>• **形态仍为 ByObj UserData**（不改变 Default 形态矩阵中的「是否走 userdata」决策之外的特殊路径）<br>• **`viewKlass` / IMT 门面 = 运行时实际类型**（`obj.GetType()` / `obj->klass`），而非声明类型<br>• 若实际类型为 **`string`**，仍 Push **ByObj UserData**（门面 `System.String`），**不**转为 Lua `string`<br>• `null` → `nil`<br>• **不**改 method / indexer dispatch 实现：成员查找已按 viewKlass，view 为实际类型后即按实际类型分派<br>• 标注于 **参数 / 字段 / 属性 / 类型级**，或声明类型不在合法集合 → 与其它非法标注相同，见 **§4**（Mono Attribute：**回退 Default**；XML / Generate：§4.2） |

## 3. 各类型的合法 `LuaMarshalType` 集合

每个 CLR 形参/返回值/字段类型仅允许绑定 **§2** 中与其语义相容的 `LuaMarshalType`（**`Default` 对所有类型均合法**）。Codegen / Mono 反射在 **解析标注时** 须先查表；**不在合法集合内** 的标注视为 **无效**，见 **§4**。

下表「合法集合」列出的为 **`Default` 之外** 可显式标注的值；未列出的 `LuaMarshalType` 对该类型 **非法**。

**`OpaqueValue`：** 仅对 §3 表中列出的类型可在 **C#→Lua** 方向合法标注（§3.1）；**不是**「任意 by-val 均可」。**基元** 与 **`IntPtr` / `UIntPtr` / `nint` / `nuint`** **仅允许 `Default`**（禁止 `OpaqueValue` / `UserData` 等），以便热路径省去 Opaque 分支。`ref`/`in`/`out`（含 `ref int`）默认已是 Opaque，**无需**再标；见「byref」行。

| C# 类型（分类） | 合法 `LuaMarshalType`（`Default` 除外） | 说明 |
|-----------------|----------------------------------------|------|
| **基元**（`bool`、`char`、`byte`…`ulong`、`float`、`double`） | （无；**仅 `Default`**） | **`UserData` / `OpaqueValue` 均非法**。默认已是 integer/boolean/number；禁止 `OpaqueValue` 便于优化。若为 **`ref`/`in`/`out` 基元** → 默认已是 Opaque（见「byref」行），**不是** by-val 上标 `OpaqueValue` |
| **`IntPtr` / `UIntPtr` / `nint` / `nuint`** | （无；**仅 `Default`**） | 同基元：仅 `Default`（整型数值 Marshal）；**禁止** `OpaqueValue` / `UserData` |
| **`string`** | `UserData`、`Bytes`、`OpaqueValue` | `UserData`：强制 ByObjUserData；`Bytes`：octet string；`OpaqueValue`：**仅 C#→Lua**；**`ActualTypeUserData` 非法**（默认非 ByObj） |
| **`byte[]`** | `Bytes`、`UserData`、`OpaqueValue`、`ActualTypeUserData` | `Bytes`：↔ Lua string；`UserData` 与默认等价；`OpaqueValue`：**仅 C#→Lua**；`ActualTypeUserData`：**仅返回值** |
| **`T[]`（szarray）** | `UserData`、`OpaqueValue`、`ActualTypeUserData` | `UserData` 与默认等价；`OpaqueValue`：**仅 C#→Lua**；`ActualTypeUserData`：**仅返回值**（门面=元素数组实际类型） |
| **`T[,…]`（mdarray）** | `UserData`、`OpaqueValue`、`ActualTypeUserData` | 同上；Lua→C# **不** 因标注接受 table；`ActualTypeUserData`：**仅返回值** |
| **`enum`** | `OpaqueValue` | by-val **不可** `UserData`；boxed 用 `zlua.box`（[08-ENUM.md](/docs/spec/marshal/08-ENUM/)）。`OpaqueValue` 合法但通常无实质必要。**`ref`/`in`/`out` enum** → 见「byref」 |
| **`struct`**（普通值类型 / **closed** 泛型 struct；非 ref struct） | `UserData`、`OpaqueValue`、`Table`、`UnpackedValues` | `UserData` 与默认等价；`OpaqueValue`：**仅 C#→Lua**；`Table` / `UnpackedValues` 须名单；**无** `ActualTypeUserData`（非 ByObj 门面语义） |
| **`class`** | `UserData`、`OpaqueValue`、`ActualTypeUserData` | `UserData` 与默认等价；`OpaqueValue`：**仅 C#→Lua**；`ActualTypeUserData`：**仅返回值**；**不可** `Table` / `UnpackedValues` |
| **`interface`** | `UserData`、`OpaqueValue`、`ActualTypeUserData` | 默认 ByObjUserData；`UserData` 与默认等价；`ActualTypeUserData`：**仅返回值**（门面=实现类实际类型）；**不可** `Table` / `UnpackedValues` |
| **`Delegate` 及子类** | `UserData`、`OpaqueValue` | `UserData` 无实质作用；`OpaqueValue`：**仅 C#→Lua**；**无** `ActualTypeUserData`（委托默认常非稳定 ByObj 门面路径） |
| **`object`** | `UserData`、`OpaqueValue`、`ActualTypeUserData` | `OpaqueValue`：**仅 C#→Lua**；`ActualTypeUserData`：**仅返回值**（门面=实际类型；实际为 `string` 时仍为 ByObj） |
| **`ref` / `in` / `out T`（任意 T）** | （通常无需标注） | C#→Lua **默认** OpaqueValue（[04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/)）。显式 `[OpaqueValue]` **合法**；**不可** `ActualTypeUserData`（byref 默认 Opaque） |
| **`Nullable<T>`**（`T` 为 struct） | `UserData`、`OpaqueValue`、**`Table`** | 合法集合 **不** 含 `UnpackedValues`（多槽无法区分 `nil`=无值）。`Table` 的 `Members` 针对 **底层 `T`**；`nil`↔无值，table↔有值。`T` 为基元/enum 时除 `Default`/`OpaqueValue`/`UserData`（若适用）外通常无 `Table` |
| **非托管指针**（`T*`、`void*` 等） | `OpaqueValue` | 默认可 `Default`（Pointer 透传，见 [10-POINTER.md](/docs/spec/marshal/10-POINTER/)）；亦可标 `OpaqueValue`（C#→Lua） |
| **函数指针**（`delegate*<…>`） | `OpaqueValue` | 同非托管指针 |
| **`TypedReference`** | （通常无需标注） | **默认即 OpaqueValue**（双向均 **仅** 此形态，见 [10-POINTER.md](/docs/spec/marshal/10-POINTER/)）。显式 `[OpaqueValue]` 合法且等价；`UserData` / `Table` 等 **非法** |
| **`decimal`** | `OpaqueValue` | v1 默认 by-val 仍可不支持；`OpaqueValue`（C#→Lua）合法 |
| **`ref struct`**（`Span<T>` 等） | `OpaqueValue` | 不能作为普通 by-val 默认 marshal；`OpaqueValue`（C#→Lua）合法 |
| **`params T[]` 形参** | `OpaqueValue` | Lua→C# 见 §7（展开 + 可选整段 `T[]` userdata）；C#→Lua 同 szarray；**无** 专用 `LuaMarshalType`；`OpaqueValue`：**仅 C#→Lua** |

### 3.1 方向过滤（与上表叠加）

| `LuaMarshalType` | 允许标注的方向 |
|------------------|----------------|
| `UserData`、`Bytes`、`Table`、`UnpackedValues` | **双向**（Pop / Push 均可能生效，以形参/返回值方向为准） |
| `OpaqueValue` | **仅 C# → Lua**（返回值、或 C# 调 Lua 时的 push 实参）；标注于 **纯 Lua→C# 形参** 时视为 **非法** |
| `ActualTypeUserData` | **仅返回值**（C# → Lua Push）；标注于形参 / 字段 / 属性 / 类型级 → **非法**（按 §4 处理，与其它类型相同） |

## 4. 非法标注与配置错误

### 4.1 Mono Attribute：一律日志 + 回退 Default

当 **Mono** 运行时解析 **Attribute**（含类型级）时，下列情况 **均不** 中断绑定（**含非法的 `ActualTypeUserData`**，与其它 `LuaMarshalType` 无特殊例外）：

| 行为 | 说明 |
|------|------|
| **Marshal** | **按 `Default` 处理**——与未标注相同 |
| **日志** | **仅 Editor** 输出 **错误级** 日志（成员签名、CLR 类型、原因、回退 Default） |
| **Player（Mono）** | 静默回退 Default |

覆盖范围包括但不限于：

- 类型 / 方向不在 §3 合法集合（如 class 上的 `Table`、形参上的 `OpaqueValue`、**非返回值上的 `ActualTypeUserData`**、返回值类型不支持 ActualType 等）——含闭合后才显现的不兼容（如开放方法上标了 `Bytes`，闭合到非 `byte[]`/`string`）
- `Table` / `UnpackedValues`：**Members** 缺失/空、成员名不存在、读写权限不符、`?` 用于非 Table、**`UnpackedValues` 用于 `Nullable<T>`**
- **类型级**标在泛型类型上（§1.1）在 Mono Attribute 路径亦回退（XML / Generate 对类型级仍可硬失败）

**示例：**

```text
[ZLua] Invalid LuaMarshalAs: ...EchoInt(int value)
  parameter 'value' (System.Int32): LuaMarshalType.UserData is not allowed; falling back to Default.
```

```text
[ZLua] Invalid LuaMarshalAs: ...GetComp(string name)
  parameter 'name' (System.String): LuaMarshalType.ActualTypeUserData is not allowed; falling back to Default.
```

### 4.2 Il2Cpp Generate / XML 加载：配置错误可硬失败

**Il2Cpp Codegen（Generate）** 与 **MarshalAs XML 加载** 对 §4.1 同类错误可 **失败并中止**（CI / Editor 可见），**不** 静默写进 Player 绑定表（含非法 `ActualTypeUserData`，与其它 `LuaMarshalType` 相同）。典型文案：

```text
[ZLua] LuaMarshalAs configuration error: ...Foo(MyStruct v)
  LuaMarshalType.Table requires non-empty Members.
```

运行时 arity 错误（`UnpackedValues` 实参槽数 ≠ 名单长度）仍为 **`luaL_error`**，与配置回退无关。

## 5. `Table` 与 `UnpackedValues`（值类型）

**适用范围：**

| 目标 | `Table` | `UnpackedValues` |
|------|---------|------------------|
| 普通 struct / closed 泛型 struct（非 ref struct） | ✓ | ✓ |
| `Nullable<T>` 且 `T` 为上述 struct | ✓（`Members` 相对 `T`） | ✗ |
| class / interface / ref struct / 基元 / enum | ✗ | ✗ |

**默认行为：** **不** 接受 Lua table 或多栈参数组装整个对象；须显式标注并提供 **`Members`**。

### 5.1 成员名单

- 类型为 **`string[]`**，元素为 CLR **field 名** 或 **property 名**，**可混合**。
- **`Nullable<T>` + `Table`：** 名单解析在 **`T`** 上，不在 `Nullable` 包装上。
- **顺序** 即语义顺序：`UnpackedValues` 的栈槽顺序；`Table` 的读写遍历顺序（键仍按 **成员名** 查找，与顺序无关）。
- 校验：名称存在、读写权限满足当前 Pop/Push 方向（Mono §4.1 / Generate §4.2）。

### 5.2 `UnpackedValues` 示例

```csharp
void Foo([LuaMarshalAs(LuaMarshalType.UnpackedValues, Members = new[] { "Y", "X" })] Vector2 v);
```

```lua
Foo(2.0, 1.0)   -- 第一槽 → Y，第二槽 → X；不是 table
```

```csharp
[return: LuaMarshalAs(LuaMarshalType.UnpackedValues, Members = new[] { "X", "Y" })]
Vector2 GetPos();
-- Lua: local x, y = CS.Demo.GetPos()
```

### 5.3 `Table` 示例

```csharp
void Foo([LuaMarshalAs(LuaMarshalType.Table, Members = new[] { "X", "Y" })] Vector2 v);
```

```lua
Foo({ X = 1, Y = 2 })
```

```csharp
void Bar([LuaMarshalAs(LuaMarshalType.Table, Members = new[] { "X", "Y" })] Vector2? v);
```

```lua
Bar(nil)                 -- null Nullable
Bar({ X = 1, Y = 2 })    -- 有值
```

### 5.4 （删除）class 组装

**不再** 支持 class / interface 的 Table / UnpackedValues（见 §3）。

### 5.5 嵌套限制

名单成员类型若为 struct，默认 **不** 自动展开为 table/多槽；须该成员类型自身标注或走 userdata 默认路径（v1 可限制名单仅含标量 / enum / string 等）。

### 5.6 栈槽占用与调用约定

| `LuaMarshalType` | 该形参/返回值占用的 Lua 栈槽数 |
|------------------|-------------------------------|
| **`Table`**（及除 `UnpackedValues` 外的其它类型） | **1** |
| **`UnpackedValues`** | **N**（`N = Members.Length`；`?` 不适用） |

- **Lua → C#：** 调用桥按 **栈光标** 推进：读完一个形参后 `slot += 该形参栈槽数`，**不得**假定「第 i 个 CLR 形参 ≡ `argStart + i`」。
- **重载分派：** 候选方法的「Lua 实参个数」按各形参栈槽数之和计算（见 [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/)），**不是**裸 `parameters_count`。
- **绑定期：** `Members` 须解析为可访问的 public field/property；热路径 **禁止** 按名字运行时反射。
- **C# → Lua 返回值：** `Table` → Push **1** 个 table（`Nullable` 无值 → `nil`）；`UnpackedValues` → 按名单顺序 Push **N** 个值（多返回值）。

## 6. Table 可选成员：`?` 后缀

仅当 **`LuaMarshalType.Table`** 且方向为 **Lua → C#** 时：

- `Members` 中某元素以 **`?`** 结尾（如 `"OptionalTag?"`）表示 **可选键**。
- 解析时去掉尾部 `?` 得到 CLR 成员名；Lua table **缺该键** 时 **跳过赋值**（不报错）。
- struct / `Nullable` 有值写入前已 **零初始化 / default**，跳过即保持 **默认值**；`Nullable` 整体为 `nil` 时不进入成员写入。
- **无 `?` 后缀** 的成员：table **缺键** → `luaL_error`。
- **`UnpackedValues` 不支持 `?`**；缺槽即 arity 错误。

```csharp
[LuaMarshalAs(LuaMarshalType.Table, Members = new[] { "X", "Y", "Tag?" })]
public struct MyDto { public int X; public int Y; public string Tag; }
```

```lua
Foo({ X = 1, Y = 2 })              -- OK；Tag 保持 null
Foo({ X = 1, Y = 2, Tag = "a" })   -- OK
Foo({ X = 1 })                     -- 缺 Y → error
```

## 7. `params T[]` 形参

**范围：** 仅 **普通 C# 方法 / 构造函数** 上带 **`params`** 修饰的一维数组形参。**GetFunction 取得的 delegate 调用 / delegate bridge** 上的 `params` **不支持**（见 [09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/)）。

**与普通 `T[]` 形参的差异：** 普通 szarray 形参 Lua→C# 仍接受 **ByObjUserData / 数组形态 table / nil→null**（见 [01-OVERVIEW.md §4](/docs/spec/marshal/01-OVERVIEW/)、[07-ARRAY.md](/docs/spec/marshal/07-ARRAY/)）。`params T[]` 的 Lua→C# 走 **展开优先** 规则（对齐 C# `params`），**不** 把 table / nil 当作整个数组。

**无专用 `LuaMarshalType`：** 不提供「仅 table」或「强制单槽」等专用标注；`OpaqueValue` 仅影响 **C#→Lua** Push。

### 7.1 行为（未标注或 `Default`；`OpaqueValue` 仅影响 C#→Lua Push）

| 方向 | 规则 |
|------|------|
| **C# → Lua** | 与 szarray 相同：Push **`T[]`** 为 **ByObjUserData**（**不** 解压为多栈槽、**不** 默认 Push table） |
| **Lua → C#** | 见 §7.2：优先 **展开** 0～N 个元素；或 **单个** 匹配的 `T[]` ByObjUserData 整段传入 |

### 7.2 Lua → C# 传参形态

定参前缀（若有）按普通规则消耗栈槽后，对 `params` 位：

| 传入 | C# 收到 |
|------|---------|
| **省略**（无剩余槽） | **`T[0]`**（空数组，**不是** `null`） |
| **0～N 个** 可按元素类型 `T` 匹配的实参（展开） | 新分配的 **`T[n]`**，逐元素 Pop |
| **恰好 1** 个实参，且为可赋值给 **`T[]`** 的 **ByObjUserData** | 该数组引用（对齐 C# 传已有数组） |
| **table**（当作整个 `T[]`） | **不支持**（不按 szarray table 规则整段 Pop） |
| **单独的 `nil`（当作整个 `null` 的 `T[]`）** | **不支持**；`nil` 仅可作为 **展开中的一个元素**（引用类型 / `Nullable` → null 元素） |

展开时每个元素的 Pop / 匹配规则与「普通形参类型为 `T`」相同（见 [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §3.3）。

**示例：**

```csharp
static void Sum(params int[] values) { /* … */ }
static void Prefix(int head, params int[] tail) { /* … */ }
static void CountNulls(params string[] values) { /* … */ }
```

```lua
-- ✅ 展开
CS.Demo.Sum(1, 2, 3)
CS.Demo.Sum()                       -- → int[0]
CS.Demo.Prefix(0, 1, 2)             -- head=0, tail={1,2}

-- ✅ 整段：已有 T[] userdata
CS.Demo.Sum(arr)                    -- arr 为 int[] ByObjUserData

-- ✅ nil 是元素，不是 null 数组
CS.Demo.CountNulls(nil)             -- → string[]{ null }
CS.Demo.CountNulls("a", nil, "b")   -- length 3，中间为 null

-- ❌ 不支持：table / nil 当整个 T[]
-- CS.Demo.Sum({ 1, 2, 3 })
-- CS.Demo.Sum(nil)                 -- int 元素不接受 nil → mismatch
```

**与重载分派：** `params` 使该方法的可接受 Lua 实参个数为 **`[minLuaArity, +∞)`**（实现可对 arity 桶设上限）；匹配与选优含「展开 vs 定参 / 整段 userdata」惩罚，见 [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §3.3、§3.6.3。

**与 struct `Table` / `UnpackedValues`：** 二者用于 **单个** 值类型形参的成员组装（§5）；**不** 用于 `params T[]`。需要把 Lua table 变成数组时，应先构造 / 转换出 **`T[]` userdata**（如 `zlua.new_szarray_*` / 普通 `T[]` 形参的 table Pop），再整段传入 `params`。

## 8. 解析优先级

Codegen / Mono 反射在 Pop / Push 时按 **由细到粗** 解析；**同一目标**上 Attribute 与 XML 并存时 **Attribute 优先**：

1. **参数 / 返回值**
   1. 该槽位上的 `[LuaMarshalAs]`（若 `≠ Default`）
   2. 否则 XML 中对应 `Method` / `Param` 或 `Return` 规则（§9）
2. **字段 / 属性**
   1. 成员上的 `[LuaMarshalAs]`（若 `≠ Default`）
   2. 否则 XML 中对应 `Field` / `Property` 规则（§9）
3. **声明类型**（`class` / `struct` 类型级；**仅非泛型**类型，§1.1）
   1. 类型上的 `[LuaMarshalAs]`（若 `≠ Default`）
   2. 否则 XML 中该 `Type` 下直接子元素 `MarshalAs`（§9）
4. **[01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/) 内置默认**

**不** 支持方法级 `[LuaMarshalAs]` / 方法级 XML `MarshalAs`；须对每个参数/返回值分别配置。方法上若出现该属性：**Mono** 忽略并告警（§4.1）；**Il2Cpp Generate** 可硬失败（§4.2）。

任意 **参数 / 返回值**（或合法类型级）覆盖 **`≠ Default`** 时，Il2Cpp Codegen 对该方法生成 **专用** push/pcall/pop 代码（或走含非 Default writers 的路径）。`Table` / `UnpackedValues` 在绑定期展开 `Members` / XML `members`，**不** 运行时反射。

解析过程中若标注非法或配置错误：**Mono Attribute** 一律视为未设置并回退（§4.1）；**Il2Cpp Generate / XML** 可失败（§4.2）。

| 场景 | 默认 | `[LuaMarshalAs]` / XML 覆盖 |
|------|------|------------------------|
| C# 调 Lua，struct 形参 | 视上下文可能为 OpaqueValue 或 userdata | `OpaqueValue` → 强制 OpaqueValue |
| struct 形参 | userdata | `Table` / `UnpackedValues`（`Nullable` 仅 `Table`） |
| C# 调 Lua，`ref int` | OpaqueValue（默认） | 无需标注；显式 `[OpaqueValue]` 合法（byref 行） |
| C# 调 Lua，by-val `int` + `OpaqueValue` | integer | **非法**（基元仅 `Default`）；Mono 回退 / Generate 失败（§4） |
| Lua 调 C#，`string` 形参 | Lua string | `UserData` → **ByObjUserData** |
| Lua 调 C#，`byte[]` 形参 | ByObjUserData 或 table | `Bytes` → Lua string |
| `params T[]` 形参 | 展开 0～N 元素，或整段 `T[]` userdata（§7） | **无** 专用覆盖；仅可标 `OpaqueValue`（C#→Lua） |

---

## 9. XML 外部配置（预编译 / AOT 程序集）

> **动机：** 许多程序集为预编译 DLL，无法添加 `[LuaMarshalAs]`。XML 提供与属性 **等价** 的外部 Marshal 规则。
> **适用范围：** XML **仅**用于 **非热更新** 程序集（预编译 / AOT DLL）。**热更新程序集**（含 HybridCLR 热更 DLL）**只支持**在代码中配置 `[LuaMarshalAs]`，**不支持**用 XML 为其配置 Marshal 规则。
> **与 `[LuaAlias]` 分离：** 方法别名使用 **独立** Settings 路径与根元素（见 [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §5.4），**禁止**与本文件混写。
> **平台：** Mono（Editor）**运行时加载并解析** XML；Il2Cpp（Player）**禁止**运行时解析 XML——构建期（`ZLua/Generate/All` 等）将 XML **生成 C++ 表/数据**，运行时只查表。
> **语义：** Mono 与 Il2Cpp 的 Lua 可见结果必须一致。

### 9.1 配置入口（Settings）

路径列表在 Editor **`ZLua.Settings`**（`ProjectSettings/ZLua.asset`）中配置，例如字段：

- `marshalAsXmlPaths`：一组相对工程根或绝对路径；可为文件或目录。**仅** 承载 `ZLuaMarshalAs` 规则
- **`luaAliasXmlPaths`：** 方法别名专用路径列表（与本列表 **分开配置**）；见 [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §5.4
- 目录：递归包含该目录下 `*.xml`（实现可约定仅一层；文档以「Settings 所列路径集合」为准）

未配置任何路径 → 无 XML Marshal 规则（仅 Attribute + 默认）。路径缺失 / 无法读取 → **失败**（Editor 明确报错；Generate 中止）。

### 9.2 文件格式

根元素：

```xml
<?xml version="1.0" encoding="utf-8"?>
<ZLuaMarshalAs version="1">
  <!-- Assembly / Type / … -->
</ZLuaMarshalAs>
```

| 约束 | 说明 |
|------|------|
| `version` | 必填；当前仅 `"1"`。未知 version → **失败** |
| 编码 | UTF-8 |
| 多文件 | Settings 中列出的全部文件合并为规则集；见 §9.5 重复检测 |

### 9.3 Schema（元素）

```xml
<ZLuaMarshalAs version="1">
  <Assembly name="UnityEngine.CoreModule">
    <!-- 类型级：等价于类型上的 [LuaMarshalAs] -->
    <Type fullName="UnityEngine.Vector3">
      <MarshalAs type="Table" members="x,y,z" />
    </Type>

    <Type fullName="UnityEngine.Transform">
      <Method name="LookAt" signature="(UnityEngine.Vector3)">
        <!-- index：0-based，不含 this；禁止使用 name -->
        <Param index="0">
          <MarshalAs type="UnpackedValues" members="x,y,z" />
        </Param>
      </Method>

      <Method name="get_position" signature="()">
        <Return>
          <MarshalAs type="Table" members="x,y,z" />
        </Return>
      </Method>
    </Type>

    <Type fullName="MyGame.Net.Packet">
      <Field name="Body">
        <MarshalAs type="Bytes" />
      </Field>
      <Property name="Title">
        <MarshalAs type="UserData" />
      </Property>
    </Type>
  </Assembly>
</ZLuaMarshalAs>
```

| 元素 / 属性 | 含义 |
|-------------|------|
| `Assembly/@name` | `Assembly.GetName().Name`（非路径、非 `.dll` 文件名） |
| `Type/@fullName` | CLR 全名：`Namespace.Type`；嵌套 `Outer+Inner`；泛型声明类型写 **开放定义** ``Foo`1``（仅作成员挂载容器，见 §9.3.1）。**禁止**写闭合实例名作 `Type` 容器 |
| `Method/@name` | 方法名（CLR `Name`，不含签名） |
| `Method/@signature` | 参数类型列表，**圆括号包裹**，与 [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §5.4 风格一致：无参 `()`；有参 `(T1,T2)`；byref 类型名后加 `&`；数组 `T[]`。**不含**返回类型。签名中的类型须与元数据一致（闭合写闭合全名，形参 `T` 仅当该方法签名本身如此——但含未确定类型的槽位 **不得** 配 `MarshalAs`） |
| `Param/@index` | **必填**；`0`-based；**不含**实例 `this`。**不得**使用参数名定位 |
| `Return` | 等价 `[return: LuaMarshalAs(...)]` |
| `Field/@name` / `Property/@name` | CLR 成员名 |
| `MarshalAs/@type` | `LuaMarshalType` 名：**`Default` / `UserData` / `Bytes` / `OpaqueValue` / `UnpackedValues` / `Table` / `ActualTypeUserData`**（与本文 §1 枚举一致；**以 `OpaqueValue` 为准**，不用历史名 `OpaqueLightUserData`）。未知或已移除的类型名（如历史 **`ParamsTable`**）→ **失败** |
| `MarshalAs/@members` | 对应 `Members`：逗号分隔；`?` 后缀表示 Table 可选键（§5/§6）。`Table` / `UnpackedValues` **必填**；其它类型勿填或忽略并告警 |

**与别名分离：** 方法别名配置在 **`ZLuaAlias` / `luaAliasXmlPaths`**（见 [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §5.4），不在本文件中书写。根元素须为 **`ZLuaMarshalAs`**。

#### 9.3.1 泛型（与 §1.1 一致）

| 正确 | 错误 |
|------|------|
| `void Foo([LuaMarshalAs(Bytes)] List<int> arr)` / XML Param 指向该闭合形参 | `[LuaMarshalAs] class MyList<T>`；XML 类型级 `MarshalAs` 挂在 ``MyList`1`` |
| XML `Type fullName="UnityEngine.Component"` 下为 ``GetComponent`1`` / `GetComponent(System.Type)` 配置 `Return`=`ActualTypeUserData`（挂在**声明类型**；`GameObject` 继承可用） | 指望 `List<int>` 继承 ``List`1`` 上的类型级规则；或把 `GetComponent` 错挂在 `GameObject`（非 DeclaringType） |
| XML `Type fullName="MyList`1"` 下为 Field/Param/Return 配置规则（槽位可为 `T` / `List<T>`） | XML `Type/@fullName` 写闭合实例名作容器 |
| 非泛型类型上的类型级 Attribute / XML | 在 `Method` 上直接挂 `MarshalAs`（无方法级覆盖） |

**禁止：**

- 在 `Method` 上直接挂 `MarshalAs`（无「方法级」覆盖）
- `Param` 使用 `name` 属性定位
- XML `type` 使用已废弃的 `OpaqueLightUserData` 字符串 → **失败**（须改为 `OpaqueValue`）
- XML `Type/@fullName` 使用闭合泛型实例名 → **失败**（成员须挂在开放定义 / 非泛型声明类型上）
- **类型级** `MarshalAs` 落在泛型类型上 → **失败**（§1.1）

### 9.4 解析与校验

加载时（Mono XML 解析 / Il2Cpp Generate）：

1. XML 语法错误、未知 `version`、未知元素/必填缺失 → **失败**
2. （**元数据校验时机**）Mono：该程序集 **首次查询** 惰性绑定时；Il2Cpp：**Generate** 时（运行时不再报配置错）——`Assembly` / `Type` / `Method` / `Field` / `Property` **解析不到** → **失败**
3. `Type` 解析结果为 **闭合泛型实例** → **失败**
4. 类型级 `MarshalAs` 落在 **泛型类型** 上 → **失败**（§1.1）
5. Field / Property / Param / Return 的目标 CLR 类型 **可为未完全闭合**（`T` / `List<T>` 等）；绑定成功。**§3 合法集合**在运行时 Resolve（闭合槽位类型）时判定——不兼容 → §4（Mono Attribute：回退 Default；Il2Cpp 运行时 writers 回退 Default；Generate 若对 **已能解析的闭合类型**做校验则可硬失败）
6. 对 **已确定** 目标做 Generate 期 §3 校验时：不在合法集合 → Generate/XML：**失败**；Mono 运行时 Attribute 路径走 §4.1
7. `Table` / `UnpackedValues` 缺 `members` 或 `UnpackedValues`+`Nullable` → Generate/XML：**失败**（§4.2）

> Il2Cpp 生成表 **只含名字**（assembly / type / method+signature / param index），**不**嵌入 metadata token（裁剪前后 token 会变）。

### 9.5 重复规则（严重错误）

合并 Settings 中全部 XML 后，下列 **目标键** 若出现 **两条及以上** 有效 `MarshalAs` 规则 → **整次加载 / Generate 失败**（不得后文件覆盖）：

| 目标键 | 组成 |
|--------|------|
| 类型级 | `(assemblyName, typeFullName, kind=Type)` |
| 字段 | `(assemblyName, typeFullName, kind=Field, memberName)` |
| 属性 | `(assemblyName, typeFullName, kind=Property, memberName)` |
| 参数 | `(assemblyName, typeFullName, methodName, signature, kind=Param, index)` |
| 返回值 | `(assemblyName, typeFullName, methodName, signature, kind=Return)` |

同一文件内重复同样失败。错误信息须包含文件路径与冲突键，便于定位。

> **注意：** Attribute 与 XML 指向同一目标 **不算**「重复失败」——按 §8 **Attribute 生效**，XML 该条可记录为未使用（可选诊断），不中止加载。

### 9.6 Mono（Editor）运行时

- 按 Settings 路径 **只加载 / 解析 XML**（含 §9.5 重复检测），按 `Assembly/@name` 分组存放；**不**在启动时解析元数据 token。
- 查询表（该程序集 **首次** 查询时惰性创建并校验）：
  - **Type / Field / Property：** `Assembly` → `memberToken` → `Rule`
  - **Param / Return：** `Assembly` → `(methodDefToken, index)` → `Rule`
    - Param：`index` 为 XML `@index`（`0`-based）
    - Return：`index = -1`
    - **不**依赖 ParamDef / ReturnParameter metadata token（二者在 Mono 上常不存在）
- 热路径 O(1) 查表；**不**拼字符串匹配。
- 查询 API 与 Attribute 共用解析层：`TryAttribute`（仍可用 param token，若存在）未命中再 `TryXml`。
- 允许提供 Editor 菜单「重载 MarshalAs XML」；改文件后不自动保证热更新（文档不强制）。

### 9.7 Il2Cpp：XML → C++（构建期）

- **Generate 不得写入 metadata token**：此时尚未 DLL 裁剪，token 与最终 AOT 元数据不一致；且无「裁剪后 AOT DLL」回调。生成物仍为按 **名字** 的 `LuaMarshalAsXmlEntry`（assembly / type / method+signature / param index 等）。
- **构建期校验**：`MarshalAsCodegen`（或等价步骤）在 Generate 时对规则做与 Mono 绑定相同的解析校验（类型/成员存在、类型级非泛型等）→ **失败则中止 Generate**。成员槽位 **允许** 未完全闭合类型；§3 对开放槽位不在 Generate 期按 `T` 硬判，由 Player Resolve（闭合类型）处理。Player **运行时不再**对 XML 文件做配置失败报错。
- 运行时：`RegisterMarshalBindingTables()` 仅登记条目；按程序集 **惰性** 用名字解析，填入与 Mono 同构的表（成员 token；Param/Return 为 `methodDef.token + index`，Return 的 index=-1）。
- **Player 不得**打开或解析 XML 文件。
- 查表：Attribute 未命中后查 XML；类型级 Attribute/XML **跳过**泛型类型（§1.1）。

### 9.8 与源码枚举名同步

文档与 XML 使用 **`LuaMarshalType.OpaqueValue`**。实现侧 C# 枚举若仍为历史名 `OpaqueLightUserData`，须 **重命名为 `OpaqueValue`** 并全局替换引用，与本文 §1 一致。

---

## 10. 相关文档

| 主题 | 文档 |
|------|------|
| 默认矩阵 | [01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/) |
| OpaqueValue | [04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/) |
| struct Marshal | [05-STRUCT.md](/docs/spec/marshal/05-STRUCT/) |
| 数组 / Bytes | [07-ARRAY.md](/docs/spec/marshal/07-ARRAY/) |
| 枚举 boxed | [08-ENUM.md](/docs/spec/marshal/08-ENUM/) |
| 方法别名 XML（风格参考） | [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §5.4 |
