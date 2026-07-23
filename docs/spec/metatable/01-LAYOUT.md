---
sidebar_position: 18
title: "元表布局"
---

# 01 — 元表布局

本文档规定 ZLua 在 Lua 侧暴露的**类型表**、**静态元表（SMT）**与**实例元表（IMT）**的结构。所有键名与 `LuaConsts.h` 一致；Lua 脚本通过成员访问、`typeof`、构造等 API 间接依赖这些布局，但不应依赖 native 实现细节（如 Dispatch 闭包、三表 upvalue 布局等——见 `impl/metatable/`）。

**关联文档：** 成员索引算法 → [02-INDEX.md](./02-INDEX)；注册期规则 → [03-BINDING.md](./03-BINDING)；特殊类型 → [04-SPECIAL-TYPES.md](./04-SPECIAL-TYPES)；类型解析与 `CSharp` 路径 → [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM)。

---

## 1. 总体模型

每个已绑定的 C# 类型在 Lua 中对应一张**类型表** `T`。`T` 是访问**静态成员**的门面：脚本写 `Type.StaticField`、`Type.StaticMethod()` 时，实际经由 `T` 的元表 **SMT** 上的 `__index` / `__newindex` 分派。

**实例成员**挂在 userdata 的元表上。引用类型（class、interface、数组、委托、boxed enum 等）仅使用 **ByObj** 形态的 userdata 与一套 **ByObj 实例元表**。值类型 struct 同时支持 **ByVal**（payload 在 userdata 内）与 **ByObj**（boxed `Il2CppObject*`）两种 userdata，各挂接**独立**的实例元表；二者共享同一套成员名集合，但 bridge 在解析 `this` 时策略不同（摘要见 [04-SPECIAL-TYPES.md](./04-SPECIAL-TYPES)，细节见 [../marshal/05-STRUCT.md](../marshal/05-STRUCT)）。

静态绑定与实例绑定在注册期各自构建**独立的三张成员表**（`methodTable`、`fieldGetterTable`、`fieldSetterTable`，见 [02-INDEX.md](./02-INDEX)）。三表作为 indexer 闭包的 upvalue 或 registry 引用持有，**不**作为普通键挂在 `T` 或 `IMT` 的可见字段上，避免用户脚本误改分派表。

类型在**首次被访问**时通过 `EnsureBinding` 完整构建元表与成员表（延迟绑定），而非启动时全量注册。

---

## 2. 类型表 `T`

类型表是一张普通 Lua table，承载类型身份元数据，并作为静态成员访问的 `self`。下列键来自 `LuaConsts.h` 及绑定约定：

| 键 | 常量 | 说明 |
|----|------|------|
| `__fullname` | `LuaConsts::FullName` | Lua 规范类型全名（含 namespace、`+` 嵌套分隔，与 CLR `Type.FullName` 对齐） |
| `__klass` | `LuaConsts::Klass` | 实现用：指向 native 类型描述（Il2Cpp 为 `Il2CppClass*` lightuserdata；Mono 为等价 type id） |
| `__byval_instance_mt` | `LuaConsts::ByValInstanceMt` | struct 的 ByVal 实例元表；**仅 struct** 存在 |
| `__byobj_instance_mt` | `LuaConsts::ByObjInstanceMt` | ByObj 实例元表：class、struct boxed、enum boxed、数组、委托等 |
| `__struct` | `LuaConsts::Struct` | 仅 struct：`true` |
| `__enum` | `LuaConsts::Enum` | 仅 enum：`true` |
| `__nullable` | `LuaConsts::Nullable` | 仅 `Nullable<T>` 闭合类型：`true`；与 `__struct` / `__enum` **互斥** |

类型族标记（`__struct` / `__enum` / `__nullable`）至多出现一个，供脚本与 API 区分构造入口与实例形态。

**不在类型表上重复挂载**与 SMT 三表重复的 method / getter 键，以免出现「直查 `T`」与「走 `__index`」双路径。枚举 public 常量、`RegisterStaticLiteralFields` 写入的字面量等例外：可直接作为 `T` 的普通键存在（读 `E.Red` 时若键已在 `T` 上则不走 `__index`）。

`T` 的元表为 **SMT**（`lua_setmetatable(T, SMT)`）。静态成员读写一律经 SMT 的 `__index` / `__newindex`，不得把静态成员混入实例 userdata 的元表。

**禁止**在 `T` 上注册与 `SMT.__call` 等价的 `_ctor` 字段；class / struct 带参构造仅通过 `Type(...)` 触发 `SMT.__call`（见 [04-SPECIAL-TYPES.md](./04-SPECIAL-TYPES)）。

---

## 3. 静态元表 `SMT`

每个类型表对应唯一一张静态元表，与实例元表**完全隔离**。

```
SMT
├─ __index      → 静态成员 indexer（upvalue：static methodTable, fieldGetterTable）
├─ __newindex   → 静态成员 newindexer（upvalue：static fieldSetterTable）
├─ __call       → 实例构造 dispatch（class / struct；Nullable 见 §4；enum **无**）
├─ __tostring   → 可选；默认返回类型 __fullname
└─ _default     → 可选；**仅 struct** 的无参默认实例 closure（键名 LuaConsts::Default）
```

`__call` 与 `_default` 挂在 **SMT 本体**上，不进入三表。静态 `__index` 在三表均未命中时，须能回退到对 SMT 的 `rawget`（例如取 `_default` closure），再未命中则返回 `nil`（见 [02-INDEX.md](./02-INDEX)）。

enum 的 SMT **无** `__call`；Nullable 的 SMT **仅** `__call`（构造 element 类型 `T` 的值），**无** `__index` / `__newindex`（见 [04-SPECIAL-TYPES.md](./04-SPECIAL-TYPES)）。

---

## 4. 实例元表（IMT）

实例 userdata 的 `metatable` 指向声明类型（或 view 类型）对应的实例元表。布局如下（键名均来自 `LuaConsts.h`）：

```
IMT（ByVal 或 ByObj）
├─ __index      → 实例 indexer（upvalue：instance methodTable, fieldGetterTable）
├─ __newindex   → 实例 newindexer（upvalue：instance fieldSetterTable）
├─ __gc         → 释放 userdata 生命周期跟踪（ByVal 非 blittable struct、ByObj 引用等）
├─ __type       → 指回类型表 T（静实例互查）
├─ __zlua_ud_kind → "byval" | "byobj"（LuaConsts::UdKindByVal / UdKindByObj）
├─ __tostring   → 可选（如 boxed struct / enum 走 Object.ToString）
├─ __len        → 可选（**数组** szarray / mdarray，见 [04-SPECIAL-TYPES.md](./04-SPECIAL-TYPES)）
└─ __call       → 可选（**仅委托** ByObj userdata，见 [04-SPECIAL-TYPES.md](./04-SPECIAL-TYPES)）
```

### 4.1 ByVal 实例元表（`T.__byval_instance_mt`）

- 适用于 struct 的 **ByValUserData**（payload 内嵌于 full userdata）。
- `__zlua_ud_kind` 为 `"byval"`。
- 实例 indexer 使用的 `fieldGetterTable` / `fieldSetterTable` / `methodTable` 与 ByObj 侧**成员名集合相同**，但 getter / setter / method closure 按 ByVal 解析 `this`（指向 payload，不含 object header）。
- blittable struct 可无 `__gc`；含托管引用字段的 struct 须注册 `__gc`。

### 4.2 ByObj 实例元表（`T.__byobj_instance_mt`）

- 适用于：class 实例、struct 的 boxed 实例、boxed enum、`System.Array` 派生数组、委托等。
- `__zlua_ud_kind` 为 `"byobj"`。
- indexer 按 ByObj 规则解析 `this`（`Il2CppObject*` / 等价 GCHandle）。
- class 仅挂接此一套 IMT（**无** `__byval_instance_mt`）。
- struct 除 ByVal IMT 外**另建** ByObj IMT；enum 仅有 ByObj IMT（供 `zlua.box` 产物）。
- 委托在 ByObj IMT 上额外挂 `__call`，使 `delegate(arg1, …)` 直接 invoke。

**禁止**在 IMT 根上重复挂载与三表同名的成员键。实例 userdata **不得**通过 `__index` 隐式访问静态成员；须使用类型表 `T`（见 [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM) §3.3）。

---

## 5. 静实例互查

类型首次绑定时建立下列引用，之后不变：

| 引用 | 用途 |
|------|------|
| `T.__byval_instance_mt` → ByVal IMT | 构造 / push ByVal struct userdata 时挂接元表 |
| `T.__byobj_instance_mt` → ByObj IMT | 构造 class、boxed struct、boxed enum、数组等时挂接元表 |
| `IMT.__type` → `T` | 从实例反查类型、`zlua.typeof`、重载注册等 |

同一托管对象可因 **view 类型**不同而对应不同 `T` / IMT，但 identity 仍为同一实例；`zlua.cast` 用于切换门面（编组见 [../marshal/06-CLASS.md](../marshal/06-CLASS)）。

---

## 6. 注册顺序

创建类型表时 native 侧须遵循下列顺序，避免先 `setmetatable(T, SMT)` 再写入实例元表字段而触发静态 `__newindex`：

1. 创建空类型表 `T`，写入 `__fullname`、`__klass` 及类型族标记。
2. 构建 **ByVal IMT**（若适用）及其实例三表，写入 `T.__byval_instance_mt`。
3. 构建 **ByObj IMT** 及其实例三表，写入 `T.__byobj_instance_mt`。
4. 构建 **SMT** 及静态三表，执行 `lua_setmetatable(T, SMT)`。

enum 常量等可直接写入 `T` 的步骤可在挂接 SMT 之前或之后，但须在类型表对脚本可见之前完成。

---

## 7. 实例元表键（现行）

规范以 **`__byval_instance_mt` / `__byobj_instance_mt`** 区分 struct 双形态；引用类型仅暴露 `__byobj_instance_mt`。`Nullable<T>` **不**挂接任何实例元表字段。键名以 `LuaConsts.h` 为准。

---

## 8. 延迟绑定 `EnsureBinding`

`EnsureBinding(klass)` 在类型**第一次**需要成员分派或构造元表时执行：扫描 public 成员、沿继承链扁平化写入静/实例三表（见 [03-BINDING.md](./03-BINDING)），创建 SMT / IMT 并建立 §5 互查引用。未闭合泛型定义、含未绑定泛型参数的类型的绑定策略由类型系统分册规定；本目录仅要求：**一旦绑定完成，Lua 可见布局与索引语义稳定且与本文一致**。
