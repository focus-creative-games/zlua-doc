---
sidebar_position: 21
title: "特殊类型的元表行为"
---

# 04 — 特殊类型的元表行为

本文档汇总 **enum**、**Nullable\<T\>**、**struct**、**数组**、**委托（delegate）** 在元表布局与成员索引上的特例。值如何 Push/Pop、ByVal/ByObj payload 布局等 Marshal 细节见 [../marshal/](../marshal/) 各分册；本文只描述 **Lua 脚本可见** 的表结构、元方法与索引入口。

**关联文档：** 通用布局 → [01-LAYOUT.md](./01-LAYOUT)；索引算法 → [02-INDEX.md](./02-INDEX)；绑定规则 → [03-BINDING.md](./03-BINDING)。

---

## 1. 枚举（enum）

### 1.1 类型表与静态访问

enum 经 `CSharp[assembly][typeFullName]` 解析为类型表 `E`，带 `__enum : true`、SMT 与 ByObj IMT。**无** `__byval_instance_mt`。

Bind 期将该 enum 所有 **public static literal** 字段写入 **`E` 本体**为 **integer**（Lua 5.4+ 优先）或整型 **number**，值为 C# underlying 整型。**不是** userdata。读 `E.Red` 时若键已在 `E` 上，不触发 `__index`。

SMT 提供 **`__index` / `__newindex`**（静态三表），但 **无 `__call`**、**无 `_default`**。**禁止** `EnumType(...)` 构造实例，**禁止**在 `E` 或 SMT 上挂 `_ctor`。

对 enum 常量的赋值：`__newindex` strict error，与 static readonly 一致。

### 1.2 Boxed 实例

需要 **boxed enum**（ByObj userdata）时使用 **`zlua.box`**（[../05-LIB.md](../05-LIB)），**不**提供类型表构造入口：

```lua
local Color = CSharp.AC['MyGame.Color']
local redBox = zlua.box(Color, Color.Red)
```

产物挂接 **`E.__byobj_instance_mt`**，`__zlua_ud_kind` 为 `"byobj"`。实例三表通常为空或极少成员（enum 无 public 实例 field/method）；`__tostring` 建议形如 `EnumFullName(value)`。

默认跨边界传参仍用 **integer/number**（[../marshal/08-ENUM.md](../marshal/08-ENUM)）；`zlua.box` 仅用于需要 **object 形参**、装箱语义的场景。

### 1.3 与 class / struct 对比（元表）

| 项 | enum |
|----|------|
| 类型表常量 | integer/number 键 |
| `SMT.__call` | **无** |
| `_default` | **无** |
| 实例 userdata | 仅 `zlua.box` → ByObj |
| 继承扁平化 | **无**（enum 无继承链合并） |

---

## 2. Nullable\<T\>（闭合值类型）

`System.Nullable\`1` 经 `zlua.make_generic_type` 闭合为类型表 `N`，带 **`__nullable : true`**，与 `__struct` / `__enum` 互斥。

### 2.1 布局特例

- **无** `__byval_instance_mt`、**无** `__byobj_instance_mt`、**无** `IMT`。
- SMT **仅** 含 **`__call`** 与可选 **`__tostring`**；**无** `__index` / `__newindex`（不暴露 Nullable 类型自身的 static 成员绑定）。

### 2.2 `SMT.__call` 语义

`N(...)` 构造的是 **element 类型 `T` 的有值表示**，**不是** Nullable 包装实例。native 将 `__call` 绑定到 **element 类型** 的构造逻辑（与 `T(...)` / `T` 的 primitive 转换一致）：

```lua
local NullableInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Nullable`1'],
    zlua.types.int32
)
local n = NullableInt(42)   -- Lua integer，非 userdata

local NullablePoint = zlua.make_generic_type(
    CSharp.mscorlib['System.Nullable`1'],
    Point2D
)
local p = NullablePoint(1, 2)   -- Point2D ByVal userdata
```

| `T` 种类 | `N(...)` 返回值 |
|----------|-----------------|
| 基元 | 对应 Lua 基元（boolean / integer / number） |
| struct | **`T` 的 ByVal userdata** |
| enum | **不支持**此入口（enum 无 `__call`） |

**null / 无值** 不经 `N(...)` 表达；向 C# 传 `Nullable<T>` 的 null 时直接传 Lua **`nil`**（[../marshal/01-OVERVIEW.md](../marshal/01-OVERVIEW)）。

---

## 3. 值类型 struct

struct 类型表含 **`__struct : true`**，同时挂 **`__byval_instance_mt`** 与 **`__byobj_instance_mt`**（见 [01-LAYOUT.md](./01-LAYOUT) §4）。

### 3.1 静态入口

| 入口 | 位置 | 语义 |
|------|------|------|
| `Type(...)` | `SMT.__call` | 有参 public 构造 → **ByVal userdata**（与规范默认构造产物一致） |
| `Type._default()` | SMT 上的 `_default`，经静态 `__index` → SMT 回退 | 无参 **零初始化** 实例，等价 `default(T)`；**不**调用用户带参构造 |

**禁止** `_ctor` 字段；**禁止** enum/Nullable 的 `_default`。

### 3.2 实例成员与双 MT

- **ByVal userdata**：metatable = `T.__byval_instance_mt`；字段/方法经 ByVal 三表索引；`this` 指向 payload（[../marshal/05-STRUCT.md](../marshal/05-STRUCT)）。
- **ByObj userdata**（boxed struct）：metatable = `T.__byobj_instance_mt`；同一成员名，ByObj 三表 closure。
- **静态成员**经 `T` / SMT 访问，与 class 路径相同。

struct **无** C# 实例继承；Bind 期 **不** 合并基类实例成员（值类型无派生实例继承场景）。可选 `zlua.box` 在 ByVal 与 ByObj 间转换（marshal 分册）。

---

## 4. 数组（szarray / mdarray）

数组类型表结构与普通引用类型类似：**仅 ByObj IMT**（数组对象为 `Il2CppArray*` / 等价引用）。`SMT.__call` **无**（数组实例由 `zlua.new_szarray_*` / `zlua.new_mdarray_*` 创建，见 [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM)）。

### 4.1 实例元方法

| 元方法 | 行为 |
|--------|------|
| `__len` | szarray：`#arr` = `Length`；mdarray：`#arr` = 各维 `GetLength(d)` 之**积**（可寻址元素总数），**不是**单维长度 |
| `__index` / `__newindex` | 走实例三表；**不**实现 `arr[i]` 元方法下标 |

### 4.2 元素访问：`get` / `set`

Bind 期向实例 **`methodTable`** 注册 native 方法 **`get`** / **`set`**（**非** `get_Item` 命名）：

```lua
arr:set(0, 10)      -- szarray：1 个下标 + value
assert(arr:get(0) == 10)

matrix:set(0, 1, 7) -- mdarray：rank 个下标 + value
```

实参个数：`get` 须等于 **rank**；`set` 须等于 **rank + 1**（末参为 value）。下标为 **C# 各维下标**（含 `lowerBound`），须为整数。越界 → `luaL_error`。

仍可通过三表绑定的 **`GetValue` / `SetValue`** 等方法访问；基元断言优先 `get`（未装箱）。与 `zlua.to_table` 的 1 基 Lua 表语义不同，见 [../marshal/07-ARRAY.md](../marshal/07-ARRAY)。

---

## 5. 委托（delegate）

委托类型表 + **ByObj IMT**。委托 **实例** userdata 在 ByObj IMT 上额外注册 **`__call`**：

```lua
local cb = SomeDelegate(function(x) return x * 2 end)
local result = cb(21)   -- 等价 invoke，非 obj:Invoke(21) 必需
```

`__call` 实参个数须与 `Invoke` 签名一致；Lua function → delegate 的 Marshal 见 [../marshal/09-FUNCTION.md](../marshal/09-FUNCTION)。静态成员（若有）仍经 SMT 三表；**无** event 子表。

---

## 6. 其它类型（摘要）

| 类型 | 元表要点 |
|------|----------|
| **class** | 仅 `__byobj_instance_mt`；`SMT.__call` → 实例构造；继承成员 Bind 期扁平化 |
| **interface** | 可解析类型表；通常无 public 构造，`SMT.__call` 不可用 |
| **抽象类** | 仅 public 构造可 `__call`；protected 构造对 Lua 不可见 |
| **静态类** | 仅静态三表；无 `__call`、无 IMT |

---

## 7. Marshal 交叉引用

| 主题 | 文档 |
|------|------|
| enum 默认 integer 与 box | [../marshal/08-ENUM.md](../marshal/08-ENUM) |
| struct ByVal / ByObj | [../marshal/05-STRUCT.md](../marshal/05-STRUCT) |
| class / 引用门面 | [../marshal/06-CLASS.md](../marshal/06-CLASS) |
| 数组创建与 `get`/`set` | [../marshal/07-ARRAY.md](../marshal/07-ARRAY) |
| Delegate ↔ Lua function | [../marshal/09-FUNCTION.md](../marshal/09-FUNCTION) |
| Nullable null / 有值 | [../marshal/01-OVERVIEW.md](../marshal/01-OVERVIEW) |

元表层只保证 **入口与索引语义** 与上表一致；具体栈上类型校验与 GC 行为以 marshal 分册为准。
