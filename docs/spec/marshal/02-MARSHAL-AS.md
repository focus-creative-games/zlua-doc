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

**不可** 作用于 **未确定（open / 含泛型形参）的 CLR 类型位置**（§1.1）；可作用于 **已闭合** 的泛型类型位置（如 `List<int>` 形参）。XML 规则与 Attribute **同一约束**（§9.3.1）。

覆盖标注须符合 **§3 合法集合**，否则 **§4.1** 回退 `Default` 并在 Editor 打错误日志。

```csharp
public enum LuaMarshalType
{
    Default,
    UserData,
    Bytes,
    OpaqueValue,
    UnpackedValues,   // struct / class / interface：多 Lua 栈槽 ↔ 列出的成员
    Table,            // struct / class / interface：单个 Lua table ↔ 列出的成员
    ParamsTable,      // params T[]：顺序 table ↔ 数组
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

### 1.1 泛型：只允许「已确定」的类型位置

`[LuaMarshalAs]`（及等价 XML）**不得**用在仍含未绑定泛型形参的类型上：

| 禁止 | 允许 |
|------|------|
| 类型级标在开放定义上：`[LuaMarshalAs] class MyList<T>` / ``struct Foo`1`` | 类型级标在 **非泛型** `class` / `struct` 上 |
| 形参/返回值/字段/属性的 CLR 类型为泛型形参或开放构造：`void Foo([LuaMarshalAs] T a)`、`List<T> items` | 闭合构造：`void Foo([LuaMarshalAs] List<int> arr)`、字段 `List<int> Body` |
| 泛型方法上未确定的槽位（含泛型类中的普通方法，只要该槽位类型仍含 `T`） | 同一方法上类型已闭合的槽位 |

说明：

- C# **不能**在闭合实例 `List<int>` 上写类型级 attribute；类型级只存在于类型定义。因此 **泛型类型（开放定义）禁止类型级** `[LuaMarshalAs]` / XML 类型级 `MarshalAs`；闭合实例也 **不** 通过「归一到开放定义」继承类型级规则。
- 成员规则仍可挂在开放泛型 **声明类型** 的 XML `Type`（``MyList`1``）下，只要目标 Field/Property/Param/Return 的 CLR 类型 **已确定**。

违反 → **配置错误**（绑定期 / XML 加载 / Generate **失败**），不是静默回退。

## 2. `LuaMarshalType` 枚举说明

| 值 | 适用方向 | 说明 |
|----|----------|------|
| **`Default`** | 双向 | 使用 [01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/) 默认规则，不做额外转换。 |
| **`UserData`** | 双向 | **仅** 可标注于 **托管引用类型** 与 **struct**（§3）；**不可** 用于基元 / `enum` / `IntPtr` 等。语义：强制走 **UserData 形态**（ByObjUserData / ByValUserData / ClassUserData 等）。<br>• **实质有效的目标：** 几乎只有 **`string`**——默认 C#↔Lua 为 Lua **string**，标注后改为 **ByObjUserData**（托管 `System.String` 对象）<br>• **class / interface / 数组 / 普通 struct / object：** 默认 marshal **已是** UserData，标注与 `Default` **等价**<br>• **`Delegate`：** 可标注，但 **无实质作用**——仍按 [09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/) Marshal 为 **Lua function** 或既有 bridge |
| **`Bytes`** | 双向 | **强制** 在 C# **`byte[]`** 与 Lua **`string`** 之间转换。<br>• C# **`byte[]`**：默认 ByObjUserData → Lua **string**（原始 octet，非 UTF-8 文本语义）<br>• 标注于 **`byte[]` 形参/返回值** 时，Lua 侧须传 **string**；Pop 时 **不接受** ByObjUserData / table<br>• 若标注于 **`string`** 形参/返回值，则走 **`byte[]` ↔ string** 的对偶规则 |
| **`OpaqueValue`** | **仅 C# → Lua** | Push **OpaqueValue**（lightuserdata，无 metatable），见 [04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/)。<br>• **`ref` / `out` / `in T`**（任意 `T`）**默认** 即为本形态（无需标注）<br>• **by-val（任意 CLR 类型）均可** 显式标注强制 Push Opaque；对 **基元 / enum / `IntPtr` 等** 合法但通常 **无实质必要**（默认已是轻量 integer/number）<br>• 脚本经 `zlua.get_opaquevalue` / `zlua.set_opaquevalue` 读写；回传给 C# 时遵循 [04-OPAQUE.md §6](/docs/spec/marshal/04-OPAQUE/)<br>• **不可** 跨调用持久化；**Lua → C#** 单独形参上标注本类型视为 **非法**（§3.1） |
| **`UnpackedValues`** | **双向** | **struct / class / interface**（§3）。将 **§5** 中 `Members` 列出的成员与 **多个连续 Lua 栈槽** 互转：<br>• **Lua → C#**：从栈上按名单 **顺序** Pop N 个值，写入对应 field/property<br>• **C# → Lua**：按名单 **顺序** Push N 个值（多返回值或展开 push）<br>须配置 **`Members`**；未配置 → **绑定期错误**（§4.2） |
| **`Table`** | **双向** | **struct / class / interface**（§3）。将 **§5** 中 `Members` 列出的成员与 **单个 Lua table** 互转：<br>• **Lua → C#**：Pop 一个 table，按 **键名** 读取并写入 field/property<br>• **C# → Lua**：Push 一个 table，键为成员名，值为各成员 marshal 结果<br>须配置 **`Members`**；未配置 → **绑定期错误**（§4.2） |
| **`ParamsTable`** | **双向** | 仅 **`params T[]` 形参**（§3、§7）。在默认 szarray 规则之上，**强制** 可变参数段 **仅** 以 **顺序 table** Marshal：<br>• **C# → Lua**：Push **一个** table，`[1]…[n]` 为各元素<br>• **Lua → C#**：Pop **一个** table（数组形态）；**不** 接受 ByObjUserData 占据 `params` 位<br>**不** 使用 `Members` |

## 3. 各类型的合法 `LuaMarshalType` 集合

每个 CLR 形参/返回值/字段类型仅允许绑定 **§2** 中与其语义相容的 `LuaMarshalType`（**`Default` 对所有类型均合法**）。Codegen / Mono 反射在 **解析标注时** 须先查表；**不在合法集合内** 的标注视为 **无效**，见 **§4**。

下表「合法集合」列出的为 **`Default` 之外** 可显式标注的值；未列出的 `LuaMarshalType` 对该类型 **非法**。

**`OpaqueValue`：** **所有** CLR 类型均可在 **C#→Lua** 方向合法标注（§3.1）；`ref`/`in`/`out` 默认已是 Opaque，无需再标。对基元 / enum / `IntPtr` 等标注虽合法，通常 **无实质收益**。

| C# 类型（分类） | 合法 `LuaMarshalType`（`Default` 除外） | 说明 |
|-----------------|----------------------------------------|------|
| **基元**（`bool`、`char`、`byte`…`ulong`、`float`、`double`） | `OpaqueValue` | **`UserData` 非法**；`OpaqueValue` 合法但通常无实质必要。若为 **`ref`/`in`/`out` 基元** → 默认已是 Opaque（见「byref」行） |
| **`IntPtr` / `UIntPtr` / `nint` / `nuint`** | `OpaqueValue` | 同基元 |
| **`string`** | `UserData`、`Bytes`、`OpaqueValue` | `UserData`：强制 ByObjUserData；`Bytes`：octet string；`OpaqueValue`：**仅 C#→Lua** |
| **`byte[]`** | `Bytes`、`UserData`、`OpaqueValue` | `Bytes`：↔ Lua string；`UserData` 与默认等价；`OpaqueValue`：**仅 C#→Lua** |
| **`T[]`（szarray）** | `UserData`、`OpaqueValue` | `UserData` 与默认等价；`OpaqueValue`：**仅 C#→Lua** |
| **`T[,…]`（mdarray）** | `UserData`、`OpaqueValue` | 同上；Lua→C# **不** 因标注接受 table |
| **`enum`** | `OpaqueValue` | by-val **不可** `UserData`；boxed 用 `zlua.box`（[08-ENUM.md](/docs/spec/marshal/08-ENUM/)）。`OpaqueValue` 合法但通常无实质必要。**`ref`/`in`/`out` enum** → 见「byref」 |
| **`struct`**（普通值类型 struct） | `UserData`、`OpaqueValue`、`Table`、`UnpackedValues` | `UserData` 与默认等价；`OpaqueValue`：**仅 C#→Lua**；`Table` / `UnpackedValues` 须名单 |
| **`class`** | `UserData`、`Table`、`UnpackedValues`、`OpaqueValue` | `UserData` 与默认等价；`OpaqueValue`：**仅 C#→Lua** |
| **`interface`** | `UserData`、`OpaqueValue`、`Table`、`UnpackedValues` | 默认 ByObjUserData；`UserData` 与默认等价；`Table` / `UnpackedValues` 须名单（同 class） |
| **`Delegate` 及子类** | `UserData`、`OpaqueValue` | `UserData` 无实质作用；`OpaqueValue`：**仅 C#→Lua** |
| **`object`** | `UserData`、`OpaqueValue` | `OpaqueValue`：**仅 C#→Lua** |
| **`ref` / `in` / `out T`（任意 T）** | （通常无需标注） | C#→Lua **默认** OpaqueValue（[04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/)）。显式 `[OpaqueValue]` **合法** |
| **`Nullable<T>`** | 同 **`T`** 的合法集合（含 `OpaqueValue`） | `T` 为基元/enum 时 by-val 除 `Default`/`OpaqueValue` 外无其它合法值 |
| **非托管指针**（`T*`、`void*` 等） | `OpaqueValue` | 默认可 `Default`（Pointer 透传，见 [10-POINTER.md](/docs/spec/marshal/10-POINTER/)）；亦可标 `OpaqueValue`（C#→Lua） |
| **函数指针**（`delegate*<…>`） | `OpaqueValue` | 同非托管指针 |
| **`TypedReference`** | （通常无需标注） | **默认即 OpaqueValue**（双向均 **仅** 此形态，见 [10-POINTER.md](/docs/spec/marshal/10-POINTER/)）。显式 `[OpaqueValue]` 合法且等价；`UserData` / `Table` 等 **非法** |
| **`decimal`** | `OpaqueValue` | v1 默认 by-val 仍可不支持；`OpaqueValue`（C#→Lua）合法 |
| **`ref struct`**（`Span<T>` 等） | `OpaqueValue` | 不能作为普通 by-val 默认 marshal；`OpaqueValue`（C#→Lua）合法 |
| **`params T[]` 形参** | `ParamsTable`、`OpaqueValue` | 默认同 szarray（§7）；`ParamsTable` 强制仅 table；`OpaqueValue`：**仅 C#→Lua** |

### 3.1 方向过滤（与上表叠加）

| `LuaMarshalType` | 允许标注的方向 |
|------------------|----------------|
| `UserData`、`Bytes`、`Table`、`UnpackedValues`、`ParamsTable` | **双向**（Pop / Push 均可能生效，以形参/返回值方向为准） |
| `OpaqueValue` | **仅 C# → Lua**（返回值、或 C# 调 Lua 时的 push 实参）；标注于 **纯 Lua→C# 形参** 时视为 **非法** |

## 4. 非法标注与配置错误

### 4.1 类型 / 方向非法（回退 Default）

当 `[LuaMarshalAs(LuaMarshalType.X)]`（`X ≠ Default`）**不满足** §3（类型不在合法集合、或 `OpaqueValue` 用于不允许的方向）时：

| 行为 | 说明 |
|------|------|
| **Marshal** | **按 `Default` 处理**——与未标注相同；**不** 因非法标注中断调用 |
| **日志** | **仅 Editor** 输出 **错误级** 日志（成员签名、CLR 类型、非法 `LuaMarshalType`、回退 Default） |
| **Player** | 静默回退 Default |

**示例：**

```text
[ZLua] Invalid LuaMarshalAs: ...EchoInt(int value)
  parameter 'value' (System.Int32): LuaMarshalType.UserData is not allowed; falling back to Default.
```

### 4.2 `Table` / `UnpackedValues` 配置错误（绑定期失败）

下列情况 **不** 回退 Default，须在 **Codegen / Mono 首次绑定** 阶段 **失败**（Editor 与 CI 可见）：

| 条件 | 行为 |
|------|------|
| `LuaMarshalType` 为 `Table` 或 `UnpackedValues`，但 **`Members` 缺失、为空数组** | 绑定失败 |
| 名单中某名称 **不是** 目标类型上可访问的 public field 或 property | 绑定失败 |
| property **Lua→C#** 不可写（无 public set / init） | 绑定失败 |
| property **C#→Lua** 不可读（无 public get） | 绑定失败 |
| 名字以 `?` 结尾但 **`LuaMarshalType` 不是 `Table`** | 绑定失败 |
| `ParamsTable` 标注于 **非 `params`** 形参，或形参类型 **不是** 一维 `T[]` | 绑定失败 |
| `UnpackedValues` 且 Lua 实参个数 **≠** 名单长度（`?` 不参与计数，Unpacked 不支持 `?`） | 运行时 `luaL_error` |

**示例：**

```text
[ZLua] LuaMarshalAs configuration error: ...Foo(MyStruct v)
  LuaMarshalType.Table requires non-empty Members.
```

## 5. `Table` 与 `UnpackedValues`（struct / class / interface）

**适用范围：** **class**、**interface**、**struct**（非 ref struct）。

**默认行为：** **不** 接受 Lua table 或多栈参数组装整个对象；须显式标注 `Table` 或 `UnpackedValues` 并提供 **`Members`**。

### 5.1 成员名单

- 类型为 **`string[]`**，元素为 CLR **field 名** 或 **property 名**，**可混合**。
- **顺序** 即语义顺序：`UnpackedValues` 的栈槽顺序；`Table` 的读写遍历顺序（键仍按 **成员名** 查找，与顺序无关）。
- 绑定期校验：名称存在、读写权限满足当前 Pop/Push 方向。

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

### 5.4 class 补充

Pop 时须能构造实例（如无参 ctor + property setter，或实现层文档规定的工厂）；名单内 **引用类型成员** 按该成员类型的 [01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/) 默认规则递归 Pop/Push。

### 5.5 嵌套限制

名单成员类型若为 struct/class，默认 **不** 自动展开为 table/多槽；须该成员类型自身标注或走 userdata 默认路径（v1 可限制名单仅含标量 / enum / string 等）。

## 6. Table 可选成员：`?` 后缀

仅当 **`LuaMarshalType.Table`** 且方向为 **Lua → C#** 时：

- `Members` 中某元素以 **`?`** 结尾（如 `"OptionalTag?"`）表示 **可选键**。
- 解析时去掉尾部 `?` 得到 CLR 成员名；Lua table **缺该键** 时 **跳过赋值**（不报错）。
- struct / class 在写入前已 **零初始化 / default**，跳过即保持 **默认值**。
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

## 7. `params T[]` 形参与 `ParamsTable`

**范围：** 仅 **普通 C# 方法 / 构造函数** 上带 **`params`** 修饰的一维数组形参。**GetFunction 取得的 delegate 调用 / delegate bridge** 上的 `params` 仍 **不支持**（见 [09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/)）。

**与 szarray 的关系：** `params T[]` 的 Marshal 规则与 [01-OVERVIEW.md §4](/docs/spec/marshal/01-OVERVIEW/) szarray **相同**（C#→Lua **ByObjUserData**；Lua→C# **ByObjUserData** 或 **数组形态 table**）。差异在于 **Lua 侧传参形态** 与 **空 / null 语义**。

### 7.1 默认行为（未标注或 `Default`）

| 方向 | 规则 |
|------|------|
| **C# → Lua** | 与 szarray 相同：Push **`T[]`** 为 **ByObjUserData**（**不** 解压为多栈槽、**不** 默认 Push table） |
| **Lua → C#** | **`params` 位占单个栈槽**；Pop **ByObjUserData** 或 **数组形态 table**，构造 / 传入 **`T[]`** |

**禁止 C# 式隐式展开：** Lua **不支持** 将 `params` 形参之后的 **多个连续实参** 自动收集为 `T[]`。必须 **显式** 传入 **一个** 实参占据 `params` 位置：

| 传入 | C# 收到 |
|------|---------|
| **ByObjUserData**（`T[]` 实例） | 该数组引用 |
| **table `{}`**（空数组形态） | **`T[0]`**（零长度数组） |
| **table `{ … }`**（`1…n` 连续键） | 按元素构造的 **`T[n]`** |
| **`nil`** | **`null`**（**非** 空数组） |

**示例：**

```csharp
static void Sum(params int[] values) { /* … */ }
static void Prefix(int head, params int[] tail) { /* … */ }
```

```lua
-- ✅ 合法：显式数组 userdata
CS.Demo.Sum(arr)                    -- arr 为 int[] ByObjUserData

-- ✅ 合法：显式 table
CS.Demo.Sum({ 1, 2, 3 })
CS.Demo.Sum({})                     -- 零个元素 → T[0]
CS.Demo.Prefix(0, { 1, 2 })         -- tail = {1,2}

-- ✅ nil → null（非空数组）
CS.Demo.Sum(nil)

-- ❌ 非法：多槽隐式收集（不支持）
-- CS.Demo.Sum(1, 2, 3)
-- CS.Demo.Prefix(0, 1, 2)
```

**与重载分派：** `params` 形参在 overload 匹配时仍计为 **单个** 形参位；**不** 将后续栈槽并入 `params` 段（见 [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/)）。

### 7.2 `ParamsTable`（显式标注）

在 **`params T[]` 形参** 上标注 `[LuaMarshalAs(LuaMarshalType.ParamsTable)]` 时：

| 方向 | 规则 |
|------|------|
| **C# → Lua** | Push **一个** table；键 **`1`…`n`**，`t[i]` 为第 `i-1` 个元素 |
| **Lua → C#** | Pop **一个** table（[01-OVERVIEW.md §4.4](/docs/spec/marshal/01-OVERVIEW/) 数组形态约束）；**不** 接受 ByObjUserData |

**空 / null：** **`{}`** → **`T[0]`**；**`nil`** → **`null`**。

**不接受：** Lua → C# 时用 **多个栈槽** 或 **ByObjUserData**；稀疏 table、字符串键 table。

**`Members`：** **不适用**。

### 7.3 与 struct `Table` 对比

| | struct / class **`Table`** | **`ParamsTable`** |
|--|---------------------------|-------------------|
| 适用 | struct / class / interface 形参 | 仅 **`params T[]`** |
| Lua 键 | **成员名**（field/property） | **整数 `1…n`**（数组段） |
| 默认（无标注） | userdata，不自动 table | **同 szarray**（ByObj **或** table）；**无** 多槽收集 |
| `Members` | **必填** | **不使用** |

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

**不** 支持方法级 `[LuaMarshalAs]` / 方法级 XML `MarshalAs`；须对每个参数/返回值分别配置。方法上若出现该属性，绑定层应视为 **配置错误** 或 **忽略并告警**（推荐 Editor 绑定期失败）。

任意 **参数 / 返回值**（或合法类型级）覆盖 **`≠ Default`** 时，Il2Cpp Codegen 对该方法生成 **专用** push/pcall/pop 代码（或走含非 Default writers 的路径）。`Table` / `UnpackedValues` 在绑定期展开 `Members` / XML `members`，**不** 运行时反射。

解析过程中若标注 **类型非法**（§3），该条 **视为未设置** 并回退；若 **配置错误**（§4.2），绑定 **失败**。

| 场景 | 默认 | `[LuaMarshalAs]` / XML 覆盖 |
|------|------|------------------------|
| C# 调 Lua，struct 形参 | 视上下文可能为 OpaqueValue 或 userdata | `OpaqueValue` → 强制 OpaqueValue |
| C# 调 Lua，`ref int` | OpaqueValue（默认） | 无需标注 |
| C# 调 Lua，by-val `int` + `OpaqueValue` | integer | 合法；Push Opaque（通常无实质必要） |
| Lua 调 C#，`string` 形参 | Lua string | `UserData` → **ByObjUserData** |
| Lua 调 C#，`byte[]` 形参 | ByObjUserData 或 table | `Bytes` → Lua string |
| struct / class / interface 形参 | userdata | `Table` / `UnpackedValues` |
| `params T[]` 形参 | 同 szarray | `ParamsTable` → **仅** table |

---

## 9. XML 外部配置（预编译程序集）

> **动机：** 许多程序集为预编译 DLL，无法添加 `[LuaMarshalAs]`。XML 提供与属性 **等价** 的外部规则。  
> **平台：** Mono（Editor）**运行时加载并解析** XML；Il2Cpp（Player）**禁止**运行时解析 XML——构建期（`ZLua/Generate/All` 等）将 XML **生成 C++ 表/数据**，运行时只查表。  
> **语义：** Mono 与 Il2Cpp 的 Lua 可见结果必须一致。

### 9.1 配置入口（Settings）

路径列表在 Editor **`ZLua.Settings`**（`ProjectSettings/ZLua.asset`）中配置，例如字段：

- `marshalAsXmlPaths`：一组相对工程根或绝对路径；可为文件或目录  
- 目录：递归包含该目录下 `*.xml`（实现可约定仅一层；文档以「Settings 所列路径集合」为准）

未配置任何路径 → 无 XML 规则（仅 Attribute + 默认）。路径缺失 / 无法读取 → **失败**（Editor 明确报错；Generate 中止）。

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
| `MarshalAs/@type` | `LuaMarshalType` 名：**`Default` / `UserData` / `Bytes` / `OpaqueValue` / `UnpackedValues` / `Table` / `ParamsTable`**（与本文 §1 枚举一致；**以 `OpaqueValue` 为准**，不用历史名 `OpaqueLightUserData`） |
| `MarshalAs/@members` | 对应 `Members`：逗号分隔；`?` 后缀表示 Table 可选键（§5/§6）。`Table` / `UnpackedValues` **必填**；其它类型勿填或忽略并告警 |

#### 9.3.1 泛型（与 §1.1 一致）

| 正确 | 错误 |
|------|------|
| `void Foo([LuaMarshalAs(Bytes)] List<int> arr)` / XML Param 指向该闭合形参 | `[LuaMarshalAs] class MyList<T>`；XML 类型级 `MarshalAs` 挂在 ``MyList`1`` |
| XML `Type fullName="MyList`1"` 下配置 **已闭合** 的 Field/Param | `void Foo([LuaMarshalAs] T a)`；Field 类型为 `T` / `List<T>` 仍配 `MarshalAs` |
| 非泛型类型上的类型级 Attribute / XML | 指望 `List<int>` 继承 ``List`1`` 上的类型级规则 |

**禁止：**

- 在 `Method` 上直接挂 `MarshalAs`（无「方法级」覆盖）
- `Param` 使用 `name` 属性定位
- XML `type` 使用已废弃的 `OpaqueLightUserData` 字符串 → **失败**（须改为 `OpaqueValue`）
- XML `Type/@fullName` 使用闭合泛型实例名 → **失败**（成员须挂在开放定义 / 非泛型声明类型上）
- 类型级或成员级规则作用于 **未确定** 类型 → **失败**（§1.1）

### 9.4 解析与校验

加载时（Mono XML 解析 / Il2Cpp Generate）：

1. XML 语法错误、未知 `version`、未知元素/必填缺失 → **失败**
2. （**元数据校验时机**）Mono：该程序集 **首次查询** 惰性绑定时；Il2Cpp：**Generate** 时（运行时不再报配置错）——`Assembly` / `Type` / `Method` / `Field` / `Property` **解析不到** → **失败**
3. `Type` 解析结果为 **闭合泛型实例** → **失败**
4. 类型级 `MarshalAs` 落在 **泛型类型** 上 → **失败**（§1.1）
5. Field / Property / Param / Return 的目标 CLR 类型 **未确定** → **失败**（§1.1）
6. `MarshalAs` 相对目标 CLR 类型 **不在 §3 合法集合** → 与属性相同：§4.1 回退或 §4.2 失败
7. `Table` / `UnpackedValues` 缺 `members` → **失败**（§4.2）

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
- **构建期校验**：`MarshalAsCodegen`（或等价步骤）在 Generate 时对规则做与 Mono 绑定相同的解析校验（类型存在、§1.1 已确定、类型级非泛型等）→ **失败则中止 Generate**。Player **运行时不再**对 XML 配置做失败报错。
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
