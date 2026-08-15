---
sidebar_position: 19
title: "成员索引（`__index` / `__newindex`）"
---

# 02 — 成员索引（`__index` / `__newindex`）

本文档规定 Lua 通过 **`__index` / `__newindex`** 访问 C# **静态成员**（类型表 `T` + 静态元表 SMT）与 **实例成员**（userdata + 实例元表 IMT）的分派规则。规范描述的是 **Lua 可见语义**；Mono 以 Lua closure + 三表 upvalue 实现，Il2Cpp 以 native indexer 实现，二者（以及任何未来 VM 快路径）**必须表现一致**。

**关联文档：** 元表布局 → [01-LAYOUT.md](/docs/spec/metatable/01-LAYOUT/)；成员如何写入三表 → [03-BINDING.md](/docs/spec/metatable/03-BINDING/)；方法重载 closure → [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/)。

---

## 1. 设计动机

Lua 曾考虑令 `methodTable` 的 metatable 再挂一层 field 用 `__index` 函数。但对 **实例 userdata** 而言，嵌套 `__index` 收到的第一个参数是中间 **table**，而非 userdata，无法读取实例字段。

因此 field 与 method 统一由 **接收 `(obj, key)` 的 indexer 函数**分派（与 xLua `obj_indexer(obj, key)` 同构）。注册期将成员拆入三张普通 Lua table，运行时按固定顺序 `rawget` 查表，**hot path 不**调用 C# `InstanceIndex` / `StaticTypeIndex`，也不将 key 转为 C# 字符串做反射字典查找。

**严格 miss：** 未注册成员的读写均须给出带 `zlua:` 前缀的明确错误（含键名），**禁止** `__index` 静默返回 `nil`（以免随后 `attempt to call/index a nil value` 难以定位）。

---

## 2. 三表职责

每个绑定（静态一套、实例一套；struct 的 ByVal / ByObj 各一套实例三表，成员名相同）在注册期构建三张 **普通 Lua table**，由 indexer 闭包以 upvalue 或 registry ref 持有。

### 2.1 `methodTable`

| 成员种类 | 表中值 | `__index` 行为 |
|----------|--------|----------------|
| 实例 / 静态 **方法**（含重载 dispatch closure） | compiled bridge closure | **直接返回**，不 call |
| **索引器 property**（`this[...]`，带参 property） | 包装 closure / `get_Item` / `set_Item` 等 dispatch | **直接返回** |
| C# **event** 的 `add_*` / `remove_*` | 与普通方法相同，注册为 **方法 closure** | **直接返回** |
| 构造函数元数据 | **不在此表**（`SMT.__call` 见 [01-LAYOUT.md](/docs/spec/metatable/01-LAYOUT/)） | — |

**不得**将 field getter 或无参 property 的 getter 放入 `methodTable`。

Event 在 Lua 侧仅通过 **`add_EventName` / `remove_EventName`**（及编译器生成的等价方法名）调用，与普通实例/静态方法一样进入 `methodTable`。**不存在** event 专用子表（例如 `{ get, set, fire }`），也不支持对 event 名做 `__newindex` 赋值。

### 2.2 `fieldGetterTable`

| 成员种类 | 表中值 | `__index` 行为 |
|----------|--------|----------------|
| **字段**（instance / static） | getter closure：`function(obj) ... end` | `return getter(obj)` |
| **无参可读 property** | 同上（compiled getter bridge） | `return getter(obj)` |

只读 property / readonly 字段：仅出现在 `fieldGetterTable`；对该键的 `__newindex` 在 `fieldSetterTable` 未命中时报错（见 §4）。

enum 静态常量若已作为 **integer** 直接写在类型表 `T` 上，则读常量时不经过本表。

### 2.3 `fieldSetterTable`

| 成员种类 | 表中值 | `__newindex` 行为 |
|----------|--------|-------------------|
| **可写字段** | setter closure：`function(obj, value) ... end` | `setter(obj, value)` |
| **无参可写 property** | 同上 | `setter(obj, value)` |

只写 property：仅出现在 `fieldSetterTable`；`__index` 在 `methodTable` 与 `fieldGetterTable` 均未命中、但 `fieldSetterTable` 命中时，报 **`zlua: property has no getter: {key}`**（不得返回 `nil`）。

readonly 字段 / 只读 property：**不在**此表；写入时在 `fieldSetterTable` miss 后报错。

### 2.4 同名冲突

同一绑定（静或实）内键名唯一。若 method 与 property/field 同名（极少见），**`methodTable` 优先**：`__index` 先查 method 表，命中则不再查 getter 表。

---

## 3. `__index` 算法

查表一律使用 **`rawget`**，避免三表被用户篡改 metatable 影响分派。

### 3.1 实例 userdata（IMT）

`obj` 为 full userdata（ByVal 或 ByObj）。ByVal 与 ByObj 使用各自 IMT 绑定的实例三表，算法相同：

```lua
local rawget = rawget

local function index(obj, key)
  local member = rawget(methodTable, key)
  if member ~= nil then
    return member
  end
  local getter = rawget(fieldGetterTable, key)
  if getter ~= nil then
    return getter(obj)
  end
  if rawget(fieldSetterTable, key) ~= nil then
    error("zlua: property has no getter: " .. typeFullName .. "." .. tostring(key))
  end
  error("zlua: member not found: " .. typeFullName .. "." .. tostring(key))
end
```

要点：

- method / 有参 property / `add_*` / `remove_*`：**返回 closure**，由脚本自行 `obj:Method()` 或 `obj.add_Xxx(handler)` 调用。
- field / 无参 property：**调用 getter** 并将返回值交给 Lua。
- **miss：`error`（strict）**。不调用 C# 反射 fallback，不沿继承链在运行时查找（继承已在 Bind 期扁平化，见 [03-BINDING.md](/docs/spec/metatable/03-BINDING/)）。
- 错误消息须含 **`{TypeFullName}.{key}`**（`TypeFullName` 为该绑定类型的 Lua 全名）。
- 探测「键是否存在」须用 **`rawget`**（不触发元方法），或 `pcall`；不得依赖 `__index` 返回 `nil`。

### 3.2 静态类型表（SMT）

逻辑与 §3.1 相同，但：

- `obj` 为 **类型表 `T`**（静态门面）。
- 使用 **静态** 三表（与实例三表 **不可共用** upvalue）。
- static getter closure 按静态语义实现（无 instance `GCHandle` pop，静态 field 读类型静态数据段）。

**SMT 回退：** 三表均未命中时，对 **SMT 自身** 做 `rawget`（`T` 的 metatable），以解析挂在 SMT 上的保留键，例如 struct 的 `_default` closure。仍无则 **`error("zlua: member not found: " .. typeFullName .. "." .. key)`**。

**类型表直查：** 若 `key` 已存在于 `T` 本体（如 enum 常量 integer），Lua 在触发 `__index` 之前即返回值；indexer 不负责这些键。

`__call` 不参与 `__index`；构造通过 `T(...)` 触发 `SMT.__call` 元方法。

---

## 4. `__newindex` 算法

### 4.1 实例 userdata（IMT）

```lua
local function newindex(obj, key, value)
  local setter = rawget(fieldSetterTable, key)
  if setter ~= nil then
    setter(obj, value)
    return
  end
  error("zlua: instance member not writable: " .. typeFullName .. "." .. tostring(key))
end
```

要点：

- **无返回值**（不 return setter 结果）。
- **miss：strict error**。包括：不存在字段、只读 property、method、`add_*` / `remove_*`、event 名等**一切不可写**成员。
- **禁止**写入 raw userdata 新键（不模拟 Lua 普通 table 的扩展语义）。

### 4.2 静态类型表（SMT）

与 §4.1 相同，使用静态 `fieldSetterTable`；miss 时报错，消息使用 **static** 前缀（见 §6）。

enum 常量、静态 readonly 字面量等不可写键：miss 后报错，与 C# 静态 readonly 一致。

---

## 5. Strict miss 与无反射

| 操作 | miss 行为 |
|------|-----------|
| `__index` | **`error`**（strict；见 §6） |
| `__newindex` | **`error`**（strict） |

**禁止**在 miss 时调用 C# 反射或 `InstanceIndex` / `StaticTypeIndex` 兜底。未在 Bind 期注册进三表的 public 成员，对 Lua 等同于不存在（读、写均报错）。

继承的实例/静态成员须在 **EnsureBinding** 时**扁平写入**当前类型三表（见 [03-BINDING.md](/docs/spec/metatable/03-BINDING/)），因此运行时 **不**沿继承链向上查找。

---

## 6. 错误消息约定

| 场景 | 消息（示意） |
|------|----------------|
| `__index` miss（无 getter / 无 method / SMT 回退仍无） | `zlua: member not found: {TypeFullName}.{key}` |
| `__index` 只写 property（仅 setter 表命中） | `zlua: property has no getter: {TypeFullName}.{key}` |
| `__newindex` 无 setter / 不可写（实例） | `zlua: instance member not writable: {TypeFullName}.{key}` |
| `__newindex` 无 setter / 不可写（静态） | `zlua: static member not writable: {TypeFullName}.{key}` |
| getter 内部类型错误 | bridge 抛出，保持 `zlua:` 前缀 |

只读 property 写入、对 method 名赋值等，均归入上表「不可写」语义。

---

## 7. Bootstrap 与工厂（概念）

宿主启动时 **一次** 加载 indexer 工厂函数（registry 缓存 ref）。每个类型绑定调用工厂，传入该类型的静/实例三表 ref，得到共享逻辑的 `__index` / `__newindex` 闭包：

```lua
local function bind_indexer(methodTable, fieldGetterTable, fieldSetterTable)
  local rawget = rawget
  local function index(obj, key) ... end   -- §3
  local function newindex(obj, key, value) ... end  -- §4
  return index, newindex
end
```

**每类型不生成独立 Lua 源码**；三表为 registry ref 或栈上 table，作为 closure upvalue 传入工厂。Il2Cpp 等价逻辑在 native 侧实现同一语义。

---

## 8. 与 `register_method` 的交互

`zlua.register_method`（及 Mono 等价 API）在运行时向目标类型的 method 表挂一个 **新的** 最终名 → **direct** closure（完整规则见 [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §6.1）。

- `aliasName` **尚不存在** → 写入；之后 `__index` 返回该 closure。
- `aliasName` **已存在**（单个方法或 overload 组）→ **`luaL_error`**，不覆盖、不并入。
- 与 field / property 的 method 优先规则见 §2.4；`register_method` 仍只检查 **method 侧**是否已占用该名。

---

## 9. Mono / Il2Cpp 一致性

下列项在 Mono 与 Il2Cpp 上 **必须一致**（实现路径可不同）：

- 已注册 method / field / property / `add_*` / `remove_*` 的读写语义
- `__index` miss → **error**；`__newindex` miss → error
- 静/实例三表隔离；实例 userdata 不能隐式访问静态成员
- Bind 期继承扁平化；派生类覆盖基类同名键
- **无** event 子表；**无** 反射 fallback

性能与 GC 属于实现文档（`impl/metatable/`、`compare/PERFORMANCE.md`），不在本文范围。
