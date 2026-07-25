---
sidebar_position: 3
title: "类型系统"
---

# 02 — 类型系统

> Lua 侧访问 C# **类型、成员与构造** 的规范。适用于 **Il2Cpp（Player）** 与 **Mono（Editor）**。  
> **成员索引（`__index` / `__newindex`）** → [metatable/](metatable/)  
> **参数 Marshal（Push/Pop）** → [marshal/](marshal/)

**平台原则：** Il2Cpp 侧重零 GC 与 direct `methodPointer`；Mono 可反射 / Emit，但 **Lua 可见语义必须与 Il2Cpp 一致**。

---

## 1. 设计目标

| 目标 | 说明 |
|------|------|
| 统一入口 | 普通类型经 `CSharp` 根表懒加载 |
| 语义贴近 C# | `Type.Static()`、`obj:Instance()`、构造 `Type()` |
| 静实例隔离 | 静态与实例使用 **独立** 元数据与三表 |
| 仅 public | Lua 仅可访问 `public` 成员 |
| Bind 期扁平继承 | 静/实例成员均在 **EnsureBinding** 写入当前类型三表；**无**运行时沿继承链查找 |
| 索引 miss | `__index` → **`nil`**；`__newindex` → **`error`**（见 [metatable/02-INDEX.md](metatable/02-INDEX.md)） |

---

## 2. 类型命名与解析

### 2.1 `CSharp` 根表

```
CSharp                          -- 全局表，__index → 懒加载程序集
  └─ {assemblyName}             -- 程序集表
       └─ {typeFullName}         -- 类型表（§3）
```

**程序集名**为简单名（不含 `.dll`），如 `Assembly-CSharp`、`mscorlib`。

```lua
CSharp.AC = CSharp['Assembly-CSharp']   -- 可选别名
```

### 2.2 类型访问语法

#### 无命名空间（全局命名空间）

合法标识符时可用点号：

```lua
CSharp.AC.Demo
CSharp['Assembly-CSharp'].Demo
```

#### 含命名空间（强制括号）

**禁止** `CSharp.AC.MyGame.UI.Panel`；须整段 `typeFullName` 为键：

```lua
CSharp.AC['MyGame.UI.Panel']
CSharp['Assembly-CSharp']['MyGame.UI.Panel']
```

**规则：** namespace 中的 `.` 属于 **字符串键**，不是 Lua 表路径。

#### 程序集名含特殊字符

```lua
CSharp['Assembly-CSharp']['MyGame.UI.Panel']
```

| 场景 | 写法 |
|------|------|
| 无 namespace + 合法标识符 | `CSharp.{asm}.{TypeName}` |
| **有 namespace** | `CSharp.{asm}['Ns.Type']` **必须** |
| **嵌套类型** | `CSharp.{asm}['Outer+Inner']` **必须**（`+` 分隔） |
| 含 `-`、`+`、`` ` `` 等 | 对应段用 `['...']` |

### 2.3 命名空间与嵌套类型

- **命名空间：** `MyGame.UI.Panel` → namespace `MyGame.UI`，类名 `Panel`
- **嵌套类型：** `{OuterFullName}+{NestedClassName}`，与 `Type.FullName` 一致

```lua
CSharp.AC['TopClass+NestedClass']
CSharp.AC['MyGame.UI.Outer+Inner']

-- 禁止用 '.' 连接嵌套层：
-- CSharp.AC['Outer.Inner']   ✗
```

类型表 `__fullname` 存上述字符串；native **不做** `.` ↔ `+` 转换。

### 2.4 类型实参（typeArg）

用于 `zlua.make_generic_type`、`make_szarray_type` 等（见 [05-LIB.md](05-LIB.md)）。

| 形式 | 说明 |
|------|------|
| `CSharp[assembly][typeFullName]` | 类型表 |
| `zlua.make_generic_type` / `make_szarray_type` / `make_mdarray_type` 返回值 | intern 类型表 |
| mscorlib **字符串** | 如 `"System.Int32"`；**仅** corlib |
| `zlua.types.*` | mscorlib 全名常量 |

**禁止：** 任意 Lua table、非 ZLua userdata、`zlua.typeof(...)` 返回值作为 `make_*_type` 的 typeArg（`typeof` 供签名等，见 §2.7）。

### 2.5 泛型类型

```lua
local ListDef = CSharp.mscorlib['System.Collections.Generic.List`1']
local List_int = zlua.make_generic_type(ListDef, zlua.types.int32)

local Dict_str_int = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.Dictionary`2'],
    zlua.types.string,
    zlua.types.int32
)
```

- `genericBaseType`：未闭合定义（含 `` ` `` 与 arity）
- 实参个数须与 arity 一致；相同实参 **intern** 同一类型表

### 2.6 数组类型

```lua
local int_arr = zlua.make_szarray_type(zlua.types.int32)      -- int[]
local md_type = zlua.make_mdarray_type(zlua.types.int32, 2)   -- int[,]
```

`rank ≥ 1`；szarray 与 mdarray 为不同类型。

### 2.7 `zlua.typeof`

```lua
-- 等价于 C# typeof(Demo) / typeof(List<int>)
local t = zlua.typeof(CSharp.AC.Demo)
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32
)
local t2 = zlua.typeof(ListInt)   -- 闭合泛型 / 数组等任意类型表均可
```

`typeTable` 为 **任意** ZLua 类型表（`CSharp` 基础表、`make_generic_type` / `make_*array_type` / `get_type_from_name` 等结果）。**返回值** 为该类型的 **`System.Type` 反射对象**（class userdata），语义对应 C# `typeof(T)`。可供需要 `System.Type` 的 API / 签名场景使用；**不**作为 §2.4 typeArg（typeArg 要的是类型表，不是 `Type` 实例）。

### 2.8 `zlua.types` / `zlua.get_type_from_name`

见 [05-LIB.md](05-LIB.md) §4.2、§4.3。`get_type_from_name(typeFullName)` 对标 `System.Type.GetType(string)`，返回类型表（支持 AQN、泛型、数组）。

### 2.9 类型获取途径

| 途径 | 适用 | 示例 |
|------|------|------|
| `CSharp[assembly][typeFullName]` | class、struct、enum、delegate、interface、嵌套、**未闭合泛型定义** | `CSharp.AC['Outer+Inner']` |
| `zlua.get_type_from_name` | 单字符串解析（AQN / 泛型 / 数组） | `zlua.get_type_from_name("System.Int32[]")` |
| `zlua.make_generic_type` | **闭合泛型** | `List<int>` |
| `zlua.make_szarray_type` | `T[]` | |
| `zlua.make_mdarray_type` | `T[,…]` | |

**不**经 `CSharp[...]` 直接解析：闭合泛型、数组类型（须 `make_*` 或 `get_type_from_name`）。

#### 懒加载

```
CSharp.__index(asmName) → rawget 或创建程序集表 → rawset
assembly.__index(typeFullName) → 解析 Type → EnsureBinding → rawset
```

`EnsureCSharpRoot` **仅在启动时一次**；之后 C# 侧 `lua_getglobal("CSharp")` 取得根表。

### 2.10 类型表元数据（解析用）

| 字段 | 说明 |
|------|------|
| `__typeid` | 闭合泛型 / 数组等反查 id |
| `__assembly` | 程序集简单名 |
| `__fullname` | §2.3 规范全名 |
| `__name` | 短名 |
| `__struct` | struct：`true` |
| `__enum` | enum：`true` |
| `__nullable` | `Nullable<T>` 闭合类型：`true` |
| `__instance_mt` | 实例元表（Nullable **无**） |
| `__klass` | native：`Il2CppClass*` / Mono typeId |

---

## 3. 类型表与元表结构

> 三表布局与 `__index` 算法：[metatable/01-LAYOUT.md](metatable/01-LAYOUT.md)、[metatable/02-INDEX.md](metatable/02-INDEX.md)

### 3.1 类型表（静态门面）

每个 C# 类型对应类型表 `T` + 静态元表 `SMT`：

```
T  (类型表)
├─ __assembly / __fullname / __name / __typeid / __instance_mt / __klass
├─ StaticField / StaticMethod closure（或经 SMT.__index 三表分派）
└─ ...

SMT
├─ __index / __newindex  → 三表分派（method / fieldGetter / fieldSetter）
└─ __call                → 实例构造 dispatch（enum 无）
```

**通过类型表仅访问静态成员**；**唯一例外**：`T(...)` / `SMT.__call` 构造实例。

### 3.2 实例元表 `IMT`

与 `SMT` **完全独立**：

```
IMT
├─ __index / __newindex  → 三表（Bind 期已含继承成员）
├─ __gc                  → ByObj：ObjectRegistry；ByVal：struct 释放
├─ __len                 → 数组（§7.3）
└─ __type                → 指回类型表 T
```

```
instance userdata
  metatable = IMT     -- 门面 = 声明类型 / view
  payload     = 对象指针或 struct 拷贝
```

同一托管对象可有多个 userdata（不同 view）；`zlua.cast` 切换门面（[marshal/06-CLASS.md](marshal/06-CLASS.md)）。

**禁止**经实例 `__index` **隐式**访问静态成员；须使用类型表 `T` 访问静态成员（见 §3.3）。

### 3.3 静实例互查

| 引用 | 用途 |
|------|------|
| `T.__instance_mt` → `IMT` | 构造时挂接 |
| `IMT.__type` → `T` | `typeof`、register_method 域推断 |
| `TypeBinding` | 持有 staticMap、byval/byobj instance map |

### 3.4 延迟初始化（EnsureBinding）

类型 **首次访问** 时完整构建（**仅 public**）：

- 字段、无参/有参 property、方法、构造函数
- **继承链 public 成员扁平写入** 当前类型三表（§5）
- `[LuaAlias]` 追加的最终名（可与默认名重复，见 overload §5）

### 3.5 枚举

经 `CSharp[...]` 得类型表 `E`：

- Bind 期：**public static literal** → 类型表键或 fieldGetter，值为 **integer**（Lua 5.4+ 优先）
- **无** `SMT.__call` / `_default` / `_ctor`
- 默认跨边界：**integer/number**（[marshal/08-ENUM.md](marshal/08-ENUM.md)）
- boxed 实例：**仅** `zlua.box(E, value)` → ByObj

```lua
local Color = CSharp.AC['MyGame.Color']
assert(Color.Red == 0)
local redBox = zlua.box(Color, Color.Red)
```

### 3.6 Nullable\<T\>

闭合 `Nullable<T>` 类型表 `N`：

- `__nullable : true`；**无** `__instance_mt` / `IMT`
- `SMT` **仅** `__call` → 构造 **element 类型 `T`** 的有值实参（非 Nullable 包装实例）
- `null` → Lua **`nil`**（[marshal/06-CLASS.md](marshal/06-CLASS.md) Nullable 小节）

```lua
local NullableInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Nullable`1'],
    zlua.types.int32
)
CS.Service.Take(NullableInt(42))   -- 有值
CS.Service.Take(nil)              -- null
```

### 3.7 struct

类型表含 `__struct : true`：

```
SMT.__call     → 有参构造 dispatch → ByVal userdata
SMT._default   → 无参 default(T) userdata（仅 struct）
```

```lua
local Point = CSharp.AC['MyGame.Point2D']
local zero = Point._default()
local p = Point(3, 4)
```

- 实例：**ByVal userdata**（[marshal/05-STRUCT.md](marshal/05-STRUCT.md)）
- **无继承**；静态成员不向上查找（值类型无派生静态场景）

---

## 4. 成员暴露规则

### 4.1 可见性

仅 `public` 进入绑定表。`internal` / `protected` / `private` 对 Lua 不可见。

### 4.2 字段

| 访问 | 实例 | 静态 |
|------|------|------|
| 读 | `obj.field` | `Type.field` |
| 写 | `obj.field = v` | `Type.field = v` |

只读字段赋值 → `__newindex` error。

### 4.3 属性

| 类型 | Lua 访问 |
|------|----------|
| 无参 property | `obj.prop` / `Type.prop`（getter/setter 经三表） |
| 有参 property（含索引器） | **`get_PropName(...)` / `set_PropName(...)`** 方法形式 |

**数组**元素：**`get` / `set` 实例方法**（§7.4），不走 `get_Item` 命名，不用 `arr[i]` 元方法。

### 4.4 方法

见 [04-METHOD-OVERLOAD.md](04-METHOD-OVERLOAD.md)：单重 → direct closure；多重 → dispatch；`[LuaAlias]` / `register_method`。

### 4.5 事件（无专用元表）

**不提供** Event 子表 `{ get, set, fire }`。

C# `event` 在 Lua 侧暴露为普通 **add / remove** 方法（与编译器生成名一致）：

```lua
demo:add_ValueChanged(function(v) print(v) end)
demo:remove_ValueChanged(handler)
```

若类型提供 `raise`/`invoke` 等 public 方法，按普通方法绑定；**无** `fire` 特殊键。

### 4.6 构造函数

| 类型 | 构造入口 |
|------|----------|
| class / struct | `Type(...)` → `SMT.__call`；struct 另有 `Type._default()` |
| enum | **无**；`zlua.box` |
| Nullable\<T\> | `N(...)` → element `T` 的值；null 用 `nil` |
| 抽象类 / 接口 | 无 public 构造则 `__call` error |

- 构造 **不参与继承**；仅用 **当前类型** 声明的 public 实例构造函数
- **禁止**在类型表挂与 `__call` 等价的 `_ctor` 字段（struct 的 `_default` 除外）

---

## 5. 继承（Bind 期扁平化）

### 5.1 静态成员

`SMT.__index` 在 `staticMap` 未命中时 **不**递归查父类。

为与 C#「可通过派生类型名访问继承 static 成员」一致，在 **EnsureBinding** 将基类 public 静态成员 **扁平复制** 到派生 `staticMap`（派生同名覆盖）。

### 5.2 实例成员（Bind 期扁平化，无运行时 promotion）

**不采用：** `__index` miss 时沿继承链查找并 **提升** 到成员表（promotion）。绑定完成后 miss 即 `nil` / error。

**现行规范：** 与静态相同，在 **Bind 期** 将基类 public 实例成员（字段、无参 property、方法）**扁平写入** 派生类型的 `byvalInstanceMap` / `byobjInstanceMap` 三表；派生声明 **覆盖** 基类同名项。

运行时 `__index` / `__newindex`：

```
1. rawget methodTable / fieldGetterTable / fieldSetterTable
2. 命中 → 返回或调用
3. 未命中 → __index 返回 nil；__newindex error
```

**无** 步骤「沿继承链查找」或「提升到 instanceMap」。

**虚方法：** 仍通过 bridge 对 **真实实例** 虚派发；Bind 表项指向的子类 override bridge 保证 C# 语义。

### 5.3 方法与 dispatch 的继承

若继承树上同一 `is_static` 域存在多个 public **最终同名**候选（含基类扁平化结果、`[LuaAlias]` 撞名），Bind 后该键绑定 **dispatch closure**。分派时候选列表含该最终名下全部 applicable 重载；选优规则见 [04-METHOD-OVERLOAD.md](04-METHOD-OVERLOAD.md) §3.6、§5。

---

## 6. 泛型方法

针对 **方法自身** 带泛型参数，如 `void Foo<T>(T a)`。闭合泛型类上的方法 **不** 走本节。

### 6.1 调用约定

```lua
-- Type.Foo 为 direct generic method closure
local foo_int = zlua.make_generic_method(Type.Foo, zlua.types.int32)
foo_int(obj, value)   -- 静态则无需 obj
```

使用 [05-LIB.md](05-LIB.md) `make_generic_method` 单态化泛型方法 closure。

### 6.2 缓存

相同 `(genericMethodBase, typeArgs…)` **intern** 为同一 inflated direct closure（Il2Cpp：写入 `NameMetaMap` 内部签名键）。

---

## 7. 数组

### 7.1 创建

```lua
local arr = zlua.new_szarray_by_element_type(zlua.types.int32, 10)
local arr2 = zlua.new_szarray_by_szarray_type(int_arr_type, 10)
local matrix = zlua.new_mdarray_by_spec(zlua.types.int32, {0,0}, {2,3})
```

### 7.2 `#`（`__len`）

| 形态 | `#arr` |
|------|--------|
| szarray | `Length` |
| mdarray | `∏ GetLength(d)`（可寻址元素总数） |

各维长度仍用 `GetLength(dimension)`。

### 7.3 元素访问：`get` / `set`

**不** 实现 `arr[i]` 元方法。

```lua
arr:set(0, 10)
local v = arr:get(0)

matrix:set(0, 1, 7)
local x = matrix:get(0, 1)
```

| API | 说明 |
|-----|------|
| `get` | 实参个数 = `rank`；返回元素类型的 Lua 形态（基元未装箱） |
| `set` | 前 `rank` 个为 **C# 下标**（含 lowerBound），最后一参为 value |

与 `zlua.to_table` 的 **1 基** Lua 表不同（[05-LIB.md](05-LIB.md) §8.4）。

### 7.4 互转

| API | 说明 |
|-----|------|
| `zlua.to_bytes` | blittable 元素 szarray（基元或无引用字段的 struct）→ 按内存字节拷贝为 Lua string |
| `zlua.to_table` | szarray → 1..n Lua 表 |

---

## 8. 特殊类型概要

| 类型 | 说明 |
|------|------|
| 接口 | 可解析；不可构造（无 public 构造） |
| 抽象类 | 仅 public 构造可 `__call` |
| 静态类 | 仅静态成员；无 `__call` |
| 枚举 | §3.5；[marshal/08-ENUM.md](marshal/08-ENUM.md) |
| Nullable\<T\> | §3.6 |
| 委托 | 类型表 + 实例 `IMT.__call`；[marshal/09-FUNCTION.md](marshal/09-FUNCTION.md) |
| struct | §3.7；[marshal/05-STRUCT.md](marshal/05-STRUCT.md) |
| class | ByObj；[marshal/06-CLASS.md](marshal/06-CLASS.md) |

---

## 9. Mono / Il2Cpp 一致性

| 项 | 要求 |
|----|------|
| `CSharp` 路径与 `typeFullName` | 一致 |
| 静实例隔离 | 一致 |
| Bind 期继承扁平化 | 一致 |
| `__index` nil / `__newindex` error | 一致 |
| Event → add_/remove_ | 一致 |
| 构造、dispatch、泛型方法 | 一致 |
| 数组 `#`、`get`/`set` | 一致 |
| 错误消息 | 一致或等价 |

---

## 10. 示例

```lua
CSharp.AC = CSharp['Assembly-CSharp']

local demo = CSharp.AC.Demo()
local panel = CSharp.AC['MyGame.UI.Panel']()

local Point = CSharp.AC['MyGame.Point2D']
local p = Point(3, 4)
local zero = Point._default()

local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32
)
local list = ListInt()

demo:add_Changed(function() end)

local arr = zlua.new_szarray_by_element_type(zlua.types.int32, 4)
arr:set(0, 42)
```

---

## 11. 实现落点

| 主题 | Il2Cpp | Mono |
|------|--------|------|
| 类型懒加载 | `TypeRegistry` | `LuaMonoAppDomain` / MetaBinding |
| 三表 indexer | `MetaBinding` / `Dispatch*` | Lua closure indexer |
| 继承扁平 | `MetaBinding::EnsureBinding` | `MetaBinding.cs` |
| 数组 get/set | `ArrayMarshal` + instance map | 等价绑定 |

细节见 [impl/IL2CPP.md](../impl/IL2CPP)、[impl/MONO.md](../impl/MONO)。
