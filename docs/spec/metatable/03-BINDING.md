---
sidebar_position: 20
title: "成员绑定（注册期规则）"
---

# 03 — 成员绑定（注册期规则）

本文档规定 **`EnsureBinding`** 阶段如何将 C# 类型成员扫描、分类并写入静态/实例三表（`methodTable`、`fieldGetterTable`、`fieldSetterTable`）。绑定完成后，运行时索引行为完全由 [02-INDEX.md](/docs/spec/metatable/02-INDEX/) 定义；本文不涉及 native 如何生成 bridge closure（见 `impl/metatable/`、`impl/codegen/`）。

**关联文档：** 三表职责 → [02-INDEX.md](/docs/spec/metatable/02-INDEX/)；元表布局 → [01-LAYOUT.md](/docs/spec/metatable/01-LAYOUT/)；方法重载 → [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/)。

---

## 1. 可见性

仅 **`public`** 成员对 Lua 可见并进入绑定表。`internal`、`protected`、`private` 以及 explicit interface 实现（除非另有专门规格）**不注册**。

构造函数、`_default`、`SMT.__call`、数组 `__len`、委托 `__call` 等**不进入三表**，按 [01-LAYOUT.md](/docs/spec/metatable/01-LAYOUT/) 与 [04-SPECIAL-TYPES.md](/docs/spec/metatable/04-SPECIAL-TYPES/) 单独挂在 SMT / IMT / 类型表上。

---

## 2. 静态与实例隔离

每个 `TypeBinding` 维护：

- **静态**一套三表（挂于 SMT indexer）
- **实例**一套三表（挂于 ByObj IMT indexer；struct 另建 **ByVal** 一套，成员名与 ByObj 相同但 closure 的 `this` 解析为 ByVal）

静态成员 **只** 写入静态三表；实例成员 **只** 写入实例三表。**禁止**混用或共用 upvalue。脚本不得通过实例 userdata 的 `__index` 访问静态成员。

---

## 3. 成员归类

Bind 期按下列规则将每个 public 成员写入**唯一**目标表（或组合写入 getter/setter 两表）。

### 3.1 方法（Method）

| C# 成员 | 目标表 | 值 |
|---------|--------|-----|
| 实例 / 静态方法 | `methodTable` | 单重：direct bridge closure；多重：dispatch closure + 可选 `MethodName(ParamTypes…)` 全签名键 |
| 索引器 property | `methodTable` | `get_Item` / `set_Item` 或等价 dispatch closure |
| C# **event** | `methodTable` | **`add_EventName` / `remove_EventName`** 等方法 closure；**不**生成 event 子表 |
| 泛型方法 | `methodTable` | 默认仅全签名键；单泛型重载时可同时占默认方法名 |

有参 property **不得**进入 `fieldGetterTable` / `fieldSetterTable`；Lua 侧仅能通过 `obj:get_PropName(args)` / `obj:set_PropName(args, value)` 或索引器方法名访问（见 [../02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) §属性）。

数组元素读写统一注册实例方法 **`get` / `set`**（非 `get_Item` 命名），见 [04-SPECIAL-TYPES.md](/docs/spec/metatable/04-SPECIAL-TYPES/)。

### 3.2 字段（Field）

| 访问性 | `fieldGetterTable` | `fieldSetterTable` |
|--------|-------------------|-------------------|
| 可读实例 / 静态 field | ✅ getter closure | 若可写 ✅ setter |
| `readonly` / init-only | ✅ getter | ❌ |
| 仅编译期常量（enum literal 等） | 可选：直接写类型表 `T` 为 integer | ❌ |

enum 的 public static literal 优先 **直接写入类型表 `T`** 为 underlying **integer**（Lua 5.4+ 优先 `integer`），**不**为常量创建 userdata getter。

### 3.3 无参属性（Property）

| 属性形态 | `fieldGetterTable` | `fieldSetterTable` |
|----------|-------------------|-------------------|
| 可读可写 | 有 getter 则 ✅ | 有 setter 则 ✅ |
| 只读 | ✅ getter | ❌ |
| 只写 | ❌ | ✅ setter |

只读 property：`__newindex` 在 setter 表 miss 后报错。只写 property：`__index` 在 method / getter 表均未命中时返回 `nil`。

### 3.4 构造函数

public 实例构造函数 **不** 进入任何三表。绑定阶段仅收集当前类型声明的 `.ctor` 重载，配置 **`SMT.__call`** dispatch（**不**沿继承链合并基类构造）。无 public 构造时 `Type(...)` 调用报错；struct 另提供 `SMT._default`（无参，见 [04-SPECIAL-TYPES.md](/docs/spec/metatable/04-SPECIAL-TYPES/)）。

---

## 4. 继承：Bind 期扁平化

运行时 **`__index` / `__newindex` 不** 沿继承链向上查找。为与 C#「可通过派生类型名访问继承成员」一致，**EnsureBinding** 须将基类 public 成员**预先合并**到派生类型的三表中。

### 4.1 静态成员

从基类到派生类方向收集 public static field / property / method，写入派生类型的 **静态三表**。派生类声明的同名成员 **覆盖** 基类条目（含 `new static` hide）。运行时 `SMT.__index` 仅 O(1) 查派生类静态三表 + SMT 回退。

### 4.2 实例成员

从基类链收集 public instance field / property / method，写入派生类型的 **实例三表**（ByObj；struct 同时写入 ByVal 三表）。子类 override / new 同名成员 **覆盖** 基类条目。虚方法仍通过生成的 bridge 走 CLR 虚派发；扁平化只影响 **Lua 键 → closure** 的查找，不改变虚调用语义。

### 4.3 不参与继承的项

- **构造函数**：仅当前类型声明的 public 实例构造。
- **enum**：无继承；不扁平化其他类型的成员。
- **struct**：值类型无实例继承；静态成员不向上合并基类（C# 值类型场景下通常无派生静态继承）。

### 4.4 禁止运行时 promotion

**规范采用纯 Bind 期扁平化**：首次绑定后所有继承成员已在当前类型三表中，运行时 miss 即 `nil` / error，**不得**在 `__index` miss 时再沿继承链查找并把结果写回（promotion）。Mono 与 Il2Cpp 均须遵循此裁决。

---

## 5. struct 的 ByVal / ByObj 双绑定

对非 enum、非 Nullable 的 **struct**：

1. 扫描实例成员，生成 **ByObj** 用 closure（`isByVal = false`）写入 `byobjInstanceMap`（概念上对应 ByObj 实例三表）。
2. **复制**同一成员名集合，生成 **ByVal** 用 closure（`isByVal = true`）写入 `byvalInstanceMap`（概念上对应 ByVal 实例三表）。
3. 静态成员仅一套，写入静态三表。

字段 offset、方法 `this` 解析差异见 [../marshal/05-STRUCT.md](/docs/spec/marshal/05-STRUCT/)。**禁止** struct 实例成员仅绑定 ByObj 一侧而遗漏 ByVal。

---

## 6. 方法重载与别名

同一 **最终 Lua 名** 下多个候选方法：在 `methodTable` 写入 **dispatch closure**；单候选写入 **direct closure**。最终名来自 C# 默认名与 `[LuaAlias]` / XML（见 [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §3、§5）。运行时 `zlua.register_method` **不得**占用已有 method 名或重载组名（§6.1）。

`[LuaAlias]` **允许**与默认方法名或其它别名重复；重复即并入同一 overload 组。

静态与实例、ByVal 与 ByObj 的重载分组 **相互独立**。

---

## 7. 命名冲突

### 7.1 方法 ↔ 方法

同一最终名下多个方法 **合法**，走 overload（上一节）。**不**因方法键「重复」而 Bind 失败。

### 7.2 方法 ↔ field / property

若 field / property 与 method 同名，`methodTable` 在 `__index` 时优先（见 [02-INDEX.md](/docs/spec/metatable/02-INDEX/) §2.4）。

### 7.3 继承扁平化

Bind 时若同一键已被更高优先级声明占用（例如子类已覆盖基类同名 **成员槽位** 的既有策略），按继承规则处理基类条目。这与「同名方法进 overload 组」不矛盾：子类与基类同名实例方法的扁平化结果仍按最终名聚合为候选列表（细节见 [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/)）。

---

## 8. Event 的处理

C# `event` **不**注册为 `{ get, set, fire }` 子表。编译器生成的 **`add_*` / `remove_*`**（及可见的 `raise_*` 如有）作为普通 **方法** 进入 `methodTable`。脚本用法：

```lua
obj:add_SomeEvent(function() ... end)
obj:remove_SomeEvent(handler)
```

**不支持** `obj.SomeEvent = handler` 或对 event 名的 `__newindex` 赋值。

---

## 9. 延迟绑定流程（摘要）

1. 解析 `Il2CppClass*` / `Type`，若已有 `TypeBinding` 则返回。
2. 自 **基类链** 与 **当前类** 收集 public 成员（构造仅当前类）。
3. 按 §3 写入静/实例三表；struct 执行 §5 双份实例 closure。
4. 配置 `SMT.__call`、struct `_default`、Nullable 特殊 SMT 等（[04-SPECIAL-TYPES.md](/docs/spec/metatable/04-SPECIAL-TYPES/)）。
5. 创建 SMT / IMT，挂载 indexer，建立 `T` ↔ IMT 互查（[01-LAYOUT.md](/docs/spec/metatable/01-LAYOUT/) §5–§6）。

泛型定义类型、含未闭合泛型参数的类型的绑定范围由 [../02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) 规定；一旦对脚本可见，已绑定成员须符合本文归类与扁平化规则。

---

## 10. 验收要点（语义）

- 已注册 method / field / property / `add_*` / `remove_*`：索引 hot path 不依赖 C# 字符串反射查表。
- 未注册键：`__index` → `nil`；`__newindex` → error。
- 静/实例三表隔离；继承成员在 Bind 期已扁平化，运行时无链式查找。
- **无** event 子表；**无** 反射 fallback。
- Mono 与 Il2Cpp 成员集合与读写语义一致。
