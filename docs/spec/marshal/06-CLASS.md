---
sidebar_position: 12
title: "Class / Interface Marshal"
---

# Class / Interface Marshal

> **规范性：** 引用类型（`class`、`interface`、`string`、数组实例、delegate 实例等）在 Lua 与 C# 之间的默认 Marshal 规则。  
> **相关：** 类型表与成员访问 → [`../02-TYPE-SYSTEM.md`](/docs/spec/02-TYPE-SYSTEM/)；`ref`/`out`/`in` 总览 → [`03-BYREF.md`](/docs/spec/marshal/03-BYREF/)；`[LuaMarshalAs]` → [`02-MARSHAL-AS.md`](/docs/spec/marshal/02-MARSHAL-AS/)；`zlua.cast` → [`../05-LIB.md`](/docs/spec/05-LIB/)。

**平台原则：** Mono 与 Il2Cpp 的 **Lua 可见语义一致**；class 实例默认 **GCHandle + full userdata**（Il2Cpp：`ObjectRegistry` + `Il2CppObject*`）。

---

## 1. 默认 Marshal（概要）

未标注 `[LuaMarshalAs]` 时，引用类型遵循 [`01-OVERVIEW.md`](/docs/spec/marshal/01-OVERVIEW/) 总览矩阵；本节补充 class / interface 特有语义。

| 方向 | Lua 形态 | 说明 |
|------|----------|------|
| **C# → Lua** | **ClassUserData**（ByObj full userdata） | 引用身份；**IMT 门面 = 声明类型**（见 §2） |
| **Lua → C#** | ClassUserData 或 **`nil`** | 校验可赋值给目标 **声明类型**；`nil` ↔ `null` |
| **`string`** | Lua **`string`** 或 **`nil`** | **仅当声明类型为 `string`**；声明为 `object` 时仍为 Object userdata |
| **`interface`** | 同 class | 门面 = **接口声明类型**（非实现类）；见 §2、§4 |
| **数组** | ByObjUserData | 见 [`07-ARRAY.md`](/docs/spec/marshal/07-ARRAY/) |
| **Delegate** | function 或 DelegateUserData | 见 [`09-FUNCTION.md`](/docs/spec/marshal/09-FUNCTION/) |

**UserData 形态：** ClassUserData 为 `lua_newuserdata` + 实例元表 `IMT` 的 **full userdata**；脚本侧经 `:` / `.` 访问成员。与 [`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/) 的 OpaqueValue（lightuserdata、无 metatable）及 [`10-POINTER.md`](/docs/spec/marshal/10-POINTER/) 的 Pointer 不同。

字段、方法、静态成员访问细节见 [`../02-TYPE-SYSTEM.md`](/docs/spec/02-TYPE-SYSTEM/) 与 [`../metatable/`](/docs/spec/metatable/)。

---

## 2. 声明类型门面（View / 与实际类型）

对所有 **引用类型** 形参、返回值、字段/属性（`class` / `interface` / `object` / 数组 / delegate 等），Marshal 层区分 **Identity** 与 **View**：

| 概念 | 含义 |
|------|------|
| **Identity** | userdata 载荷持有的托管对象引用（运行时 **实际实例**） |
| **View / 门面** | userdata 挂接的 **IMT** 与成员可见性；**唯一来源 = 本次 Marshal 的声明类型** |

### 2.1 规则

1. **C# → Lua**：始终按 **声明类型** 选择默认 marshal 形态与 ByObj IMT；**不**因运行时实际类型不同而改挂更具体类型的 mt，也 **不** 因此改走 `string` 等特殊 Marshal（例如 `object` 形参上的 `string` 实例仍为 Object userdata，不是 Lua string）。
2. **值类型**：无继承门面问题；仍按 [`05-STRUCT.md`](/docs/spec/marshal/05-STRUCT/) 等规则。
3. **虚方法**：成员查找使用 **声明类型** 上的 `MethodInfo`；调用时对真实 `this` 做 **虚表派发**（`override` 仍落到实现类）。
4. **非虚 / `new` 隐藏**：走声明类型槽位（经 `Base` 门面调用 `new` 隐藏的 `Bar` 得到 `Base.Bar`）。
5. **Downcast**：仅 [`zlua.cast`](/docs/spec/05-LIB/)（`IsAssignableFrom(targetType, obj.klass)`）；返回 **新 userdata**（同 identity、新门面）。
6. **对象缓存**：键为 **`(identity, viewType)`**；同一实例可有多个视图 userdata。

### 2.2 示例

```csharp
Base CreateChild() => new Child();
```

```lua
local o = ObjectFactory.CreateChild()  -- 门面 Base：不可见 Child.y；new Bar → Base.Bar
local c = zlua.cast(o, Child)          -- 门面 Child（须 IsAssignableFrom）
```

虚方法经 Base 门面查找 `MethodInfo`，再对真实实例 **虚派发**。

### 2.3 `object` 形参

| 项 | 规则 |
|----|------|
| Push | **ClassUserData**，门面为 **`System.Object`** |
| Pop | 接受 boolean / number / string / userdata |
| 运行时类型 | **不** 按运行时类型改写 Marshal（运行时 `string` 仍为 Object userdata） |

`Nullable<T>` 其中 `T` 为引用类型时，`null` ↔ `nil`；有值时同 `T` 的 class 规则。见 [`01-OVERVIEW.md`](/docs/spec/marshal/01-OVERVIEW/)。

---

## 3. `Table` / `UnpackedValues`（不适用于 class / interface）

**class** 与 **interface** **不允许** `[LuaMarshalAs(Table)]` / `[LuaMarshalAs(UnpackedValues)]`（合法集合见 [`02-MARSHAL-AS.md`](/docs/spec/marshal/02-MARSHAL-AS/) §3）。引用类型保持默认 **ByObjUserData** 与成员访问即可。

误标时：**Mono** 错误日志并回退 `Default`；**Il2Cpp Generate / XML** 可硬失败。

---

## 4. Interface Marshal

| 项 | 规则 |
|----|------|
| **默认** C# ↔ Lua | **ByObjUserData**（ClassUserData）；门面 = **接口声明类型**（非实现类） |
| `nil` | ↔ `null` |
| `[LuaMarshalAs]` | `UserData`、`OpaqueValue`（**无** `Table` / `UnpackedValues`） |
| 成员访问（默认 userdata） | 仅接口上可见成员 + 继承的接口成员；实现类独有成员不可见 |

---

## 5. `ref` / `out` / `in` 引用类型形参（Lua → C#）

总览见 [`03-BYREF.md`](/docs/spec/marshal/03-BYREF/)。引用类型（含 `string`）要点：

| Lua 实参 | 行为 |
|----------|------|
| **OpaqueValue**（与 A 类型兼容） | 传 handle 地址（可写回原槽） |
| **ByObjUserData** / Lua `string`（仅当 A 为 `string`）/ `nil` / 其它可 Pop 形态 | 取得托管指针（或 `null`）→ 写入 **栈临时变量** → 传临时地址 |

### 5.1 写回：临时槽 ⇒ 无 rebind

| C# 侧操作 | Lua 侧（临时槽路径） |
|-----------|----------------------|
| `refParam = otherObject`（**重新绑定**） | **不可见** |
| 对 **可变对象** 原地修改 | **可见**（同一托管对象） |
| `ref string` 赋新字符串 | **不可见**（等同 rebind） |

```lua
local s = "hello"
CS.Demo.ChangeString(s)   -- void ChangeString(ref string s) { s = "world"; }
-- s 仍为 "hello"

local sb = StringBuilder("hi")
CS.Demo.Append(sb, "!")   -- 共享引用，内容可变
```

### 5.2 C# → Lua

`ref`/`out`/`in` **默认 Push OpaqueValue**，见 [`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/)。

---

## 6. `string` Marshal 补充

| 声明类型 | C# → Lua | Lua → C# |
|----------|----------|----------|
| **`string`** | Lua **string** | Lua **string** 或 **`nil`** |
| **`object`**（运行时 `string`） | **Object userdata**（门面 `System.Object`） | 按 object Pop 规则 |
| **`[LuaMarshalAs(UserData)]` on `string`** | **ByObjUserData**（托管 `System.String` 对象） | 强制 userdata 路径 |

`[LuaMarshalAs(Bytes)]` 用于 **`byte[]`** ↔ Lua string，不是 `System.String`；见 [`07-ARRAY.md`](/docs/spec/marshal/07-ARRAY/)。

---

## 7. Mono / Il2Cpp 一致性

| 项 | 要求 |
|----|------|
| 默认 Push / Pop | ClassUserData；`nil` ↔ `null` |
| 门面 `(identity, viewType)` | 两平台一致 |
| `zlua.cast` | 同 identity、新 view |
| C#→Lua byref | OpaqueValue（[`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/)） |
| 错误消息 | 一致或等价 |

---

## 8. 相关文档

| 文档 | 内容 |
|------|------|
| [`01-OVERVIEW.md`](/docs/spec/marshal/01-OVERVIEW/) | 默认 Marshal 矩阵 |
| [`03-BYREF.md`](/docs/spec/marshal/03-BYREF/) | `ref` / `in` / `out` 总规则 |
| [`04-OPAQUE.md`](/docs/spec/marshal/04-OPAQUE/) | C#→Lua byref 默认 OpaqueValue |
| [`07-ARRAY.md`](/docs/spec/marshal/07-ARRAY/) | 数组 ByObjUserData |
| [`09-FUNCTION.md`](/docs/spec/marshal/09-FUNCTION/) | Delegate Marshal |
| [`../02-TYPE-SYSTEM.md`](/docs/spec/02-TYPE-SYSTEM/) | 类型表、IMT、成员访问 |
| [`../05-LIB.md`](/docs/spec/05-LIB/) | `cast`、`box` |
