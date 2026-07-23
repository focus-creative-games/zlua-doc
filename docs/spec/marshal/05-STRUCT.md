---
sidebar_position: 11
title: "Struct 编组"
---

# Struct 编组

> **规范性：** C# struct（值类型）与 Lua 互操作的传递、构造与写回规则。  
> **OpaqueValue / byref（C#→Lua）：** 见 [04-OPAQUE.md](./04-OPAQUE)。  
> **Lua→C# byref 真 ref：** 见 [03-BYREF.md](./03-BYREF)。  
> **Table / UnpackedValues：** 见 [02-MARSHAL-AS.md §5–§6](./02-MARSHAL-AS)。  
> **实现细节（GC、Registry 等）：** → [../../impl/marshal/](../../impl/marshal/)。

## 1. 设计目标

| 目标 | 说明 |
|------|------|
| 零拷贝（默认 Handle） | struct 已在桥接栈帧上时，C#→Lua 仅记录地址并 Push lightuserdata handle；不额外 box |
| 安全 | Lua **不持有** struct 裸地址；handle 仅为 opaque 令牌；过期访问 **报错** |
| 统一 | struct 与 class 同样走 `CSharp.*`、`obj:Method()`；差异在承载形态 |
| 可显式选择 | `[LuaMarshalAs]`：`UserData`、`Table`、`UnpackedValues`、`OpaqueValue` 等 |

**术语：**

- **Blittable struct**：可 `memcpy`，无托管引用字段。
- **Non-blittable struct**：含 `string`、class 等引用字段；userdata 路径须 GC 能扫到实例内存。

## 2. 默认编组（摘要）

未标注 `[LuaMarshalAs]` 时，与 [01-OVERVIEW.md](./01-OVERVIEW) 一致：

| 方向 | 默认形态 | 说明 |
|------|----------|------|
| **C# → Lua**（by-val） | **ByValUserData** 或 **OpaqueValue** | 长生命周期 / 显式 StructUserData 路径 Push **ByValUserData**；同步调用链内 by-val 亦可能为 **OpaqueValue** handle |
| **C# → Lua**（`ref`/`in`/`out`） | **OpaqueValue** | 见 [04-OPAQUE.md](./04-OPAQUE) |
| **Lua → C#** | **StructUserData** 或 **`Type(...)`** 产物 | 默认 **不** 接受 table / 多栈参数；须 `[LuaMarshalAs(Table \| UnpackedValues)]` |

## 3. 三种 Lua 可见形态

```text
┌─────────────────────────────────────────────────────────────┐
│  C# struct 在 Lua 侧的承载形态                               │
├─────────────────┬───────────────────┬───────────────────────┤
│  OpaqueValue    │  ByValUserData    │  ByObjUserData        │
│  (Handle)       │  (StructUserData) │  (boxed)              │
├─────────────────┼───────────────────┼───────────────────────┤
│  lightuserdata  │  full userdata    │  full userdata        │
│  无 metatable   │  ByVal 实例 MT    │  ByObj 实例 MT        │
│  仅同步有效     │  可长期持有       │  装箱对象路径         │
│  get/set_opaque │  : / . 访问成员   │  : / . 访问成员       │
└─────────────────┴───────────────────┴───────────────────────┘
```

| 形态 | 典型来源 | 成员访问 | 生命周期 |
|------|----------|----------|----------|
| **OpaqueValue** | C#→Lua by-val（同步）或 **`ref`/`in`/`out`** 默认 | **不可** `:`/`.`；须 `get_opaquevalue` / `set_opaquevalue` 或 `to_user_data` | 仅本次 C#→Lua 调用有效 |
| **ByValUserData**（StructUserData） | C#→Lua Push 拷贝、`Type(...)`、`to_user_data` | **ByVal 实例元表** | Lua GC 管理；non-blittable 须 Registry |
| **ByObjUserData** | C# box 路径、`zlua.box`（struct 装箱） | **ByObj 实例元表** | 与 class 对象路径同类 |

**Opaque 与 StructUserData 互转：** `zlua.to_user_data(opaque)` 为 **拷贝** 到 StructUserData，两者独立；修改 userdata **不** 影响原 opaque（若仍有效）。

## 4. ByVal 与 ByObj 双实例元表

值类型在 CLR 中既可 **box 后当作 object** 传到 Lua，也可 **按值（by-val）** 直接传递。因此 **同一 struct 类型在 Lua 侧存在两套用于实例的 metatable**：

| 路径 | userdata 类型 | 载荷 | 实例元表 |
|------|---------------|------|----------|
| **ByObj** | `ObjectUserData` | 托管对象指针（boxed 实例） | **ByObj 实例元表** |
| **ByVal** | `ByValUserData` | 值类型的 **实际数据**（payload） | **ByVal 实例元表**（类型表 `__instance_mt`） |

类型表 `T` 仍只有一套；`T.__instance_mt` 描述 **ByVal** 语义。ByObj 路径挂接 **ByObj 实例元表**。

### 4.1 实例方法 `this` 解析

设待调用的实例方法定义在类型 `DefType` 上：

| 路径 | `DefType` 为 **当前 struct** | `DefType` 为 **class 基类** |
|------|------------------------------|------------------------------|
| **ByObj** | `this` = object 指针 + 跳过对象头 → **unboxed payload** | `this` = **boxed 对象指针** |
| **ByVal** | `this` = **payload 首地址** | 须先 **Box**，再以 **object 指针** 为 `this` |

**禁止** 混用：对 ByVal userdata 挂 ByObj 元表（或反之）→ 校验失败或 `luaL_error`。

### 4.2 C# → Lua Push 路径选择

| 条件 | Push 结果 |
|------|-----------|
| box / `object` 形参等 | **ByObjUserData** + ByObj MT |
| 显式 StructUserData / blittable 拷贝 | **ByValUserData** + ByVal MT |
| 同步链 by-val（默认 Handle） | **OpaqueValue** lightuserdata |
| `[LuaMarshalAs(OpaqueValue)]` on by-val struct | **OpaqueValue** |

## 5. Lua → C#：接受的实参形态

| 形态 | 说明 |
|------|------|
| **OpaqueValue**（lightuserdata） | 仅当由 C#→Lua 刚 Push、仍在有效 scope 内；Pop 时校验 + 绑定；**不可** 在 Lua 侧读写字段 |
| **StructUserData**（ByValUserData） | by-val：Pop 时 **拷贝** payload；`ref`/`out`/`in`：绑定 payload 地址，**真 ref**（§6） |
| **`Type(...)` 构造产物** | StructUserData payload；传给 `ref T` 为 **真 ref** |
| **`UnpackedValues`** | `[LuaMarshalAs(UnpackedValues)]` + `FieldOrPropertyNames`：连续多栈参数 |
| **`Table`** | `[LuaMarshalAs(Table)]` + `FieldOrPropertyNames`：单个 table |

**lightuserdata 无 Lua 侧创建 API**（除 C#→Lua 产生的 OpaqueValue）。

### 5.1 默认不接受 table / 多参数

未标注 `[LuaMarshalAs]` 时，**不能** 用 `{ X=1, Y=2 }` 或 `foo(x, y)` 组装 struct 传入 C#；须使用 StructUserData、`Type(...)`、或显式标注 Table/UnpackedValues。

## 6. 写回语义与 `ref` / `out` / `in`

总览与完整分支见 [03-BYREF.md](./03-BYREF)。值类型要点：

| Lua 实参 | `ref`/`out`/`in` A（A 为值类型） |
|----------|----------------------------------|
| **ByValUserData** 且类型 **== A** | 传 **payload 地址**（可写回 userdata） |
| **ByValUserData** 且 **A 为 `Nullable<T>`**、userdata 类型 **== T** | 拷贝进栈上 `Nullable<T>` **临时变量**，传临时地址（**不**写回原 userdata） |
| **OpaqueValue**（类型兼容） | 传 handle 地址 |
| **其它**（含可 by-val Pop 的形态） | 拷贝进栈临时变量，传临时地址（**不**写回 Lua） |

```lua
local p = Point2D(1, 2)
CS.Demo.Offset(p, 10, 20)   -- payload 真写回
assert.equal(p.x, 11)
```

## 7. `Table` / `UnpackedValues`（struct）

规则以 [02-MARSHAL-AS.md §5–§6](./02-MARSHAL-AS) 为准；struct 特例如下。

| `LuaMarshalType` | Lua → C# | C# → Lua |
|------------------|----------|----------|
| **`UnpackedValues`** | 连续 Pop N 个栈值，按 `FieldOrPropertyNames` **顺序** 写入 | 按名单 **顺序** Push N 个值 |
| **`Table`** | Pop 一个 table，按 **键名** 写入名单内成员 | Push 一个 table |

- 须 **`FieldOrPropertyNames`**；缺失 → **绑定期错误**。
- Table、Lua→C#：**可选键** 用成员名 **`?` 后缀**（如 `"Tag?"`），缺键不赋值。

**类型级标注示例：**

```csharp
[LuaMarshalAs(LuaMarshalType.Table, FieldOrPropertyNames = new[] { "X", "Y" })]
public struct Vector2
{
    public float X;
    public float Y;
}
```

**解析优先级**（与 [02-MARSHAL-AS.md §8](./02-MARSHAL-AS) 一致）：参数/返回值 > 类型级 > 默认。

## 8. 枚举（enum）与 struct 的区别

枚举 **默认** C#↔Lua 为 integer/number，**不** 走 struct userdata（见 [08-ENUM.md](./08-ENUM)）。

| 能力 | struct | enum |
|------|--------|------|
| 类型表 `SMT.__call` | **有**（`Point2D(...)`） | **无** |
| ByVal StructUserData | **有** | 无 `SMT.__call`；`ref` 走拷贝或 C# 推送 StructUserData |
| boxed 实例 | `zlua.box` → ByObjUserData | `zlua.box` → ByObjUserData |
| 默认形参 | StructUserData / integer 等 | **integer/number** 或 boxed |

```lua
local Color = CSharp.AC['MyGame.Color']
local v = Color.Red                    -- integer/number 常量
local boxed = zlua.box(Color, Color.Green)  -- ByObjUserData
SetColor(Color.Red)                    -- 默认形参 OK
SetColor(boxed)                        -- 默认形参 OK
```

**`ref Color`：** 裸 integer 走 **拷贝** 分支；需 observable 写回时须 C#→Lua 推送的 StructUserData，或改用 struct 形参。boxed 场景用 **`zlua.box`**，**非** StructUserData ref 模型。

## 9. `zlua.box` / `zlua.unbox` / `zlua.cast`

| API | struct 语义 |
|-----|-------------|
| **`zlua.box(typeArg, value)`** | 将值类型 **装箱** 为 **ByObjUserData**；`value` 可为 ByVal userdata、标量或构造参数 |
| **`zlua.unbox(boxedValue)`** | 从 **ByObjUserData** 解箱为 **ByVal StructUserData**（或等价可访问实例） |
| **`zlua.cast(obj, targetType)`** | 引用类型门面切换；struct 场景见 [06-CLASS.md](./06-CLASS) 与类型系统 |

**`unbox` 不接受** ByVal userdata（已是 unboxed 形态）→ 报错。

## 10. 生命周期

```text
[C# 调 Lua，同步链]
  Push OpaqueValue(handle) → h
  lua_pcall(...)                        -- Lua 仅可 get/set_opaque 或 to_user_data(h)
  C# 返回                               -- h 失效

Lua 保存 h 至下次调用 → 使用时报错

需长期持有 → zlua.to_user_data(h) 或 C#→Lua StructUserData 路径
```

| 形态 | 失效条件 |
|------|----------|
| **OpaqueValue** | C#→Lua 调用返回；或 scope EndScope 递增 generation |
| **StructUserData** | Lua GC 回收 userdata（`__gc` 释放 Registry 条目） |

## 11. Non-blittable struct 要求（规范层）

Non-blittable struct 的 **ByValUserData** 路径须满足：

1. userdata 内 **完整拷贝** struct 实例（含引用字段）。
2. GC 须能扫描 userdata 内 **struct 内存中的托管引用**（实现层可用 Registry + push root 回调等；Mono 可用 GCHandle）。
3. userdata **`__gc`** 与 Registry **对称释放**。

Blittable struct 仅 `memcpy` 到 userdata payload，无额外 GC 登记。

## 12. 与元表 / 类型表的衔接

- value type 类型表：`__struct = true`（见 [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM)）。
- **ByVal**：`ByValUserData` + **ByVal 实例元表**（`__instance_mt`）。
- **ByObj**：`ObjectUserData` + **ByObj 实例元表**。
- **Opaque**：**无** 实例 metatable；不可 `:` / `.`。
- **禁止** 通过实例访问 static 成员。

## 13. Mono / Il2Cpp 一致性

| 项 | 要求 |
|----|------|
| 三种形态（Opaque / ByVal / ByObj） | Lua 脚本 **不区分** 平台 |
| Handle 过期 | 两边均 `luaL_error` |
| `to_user_data` | **拷贝**语义一致 |
| `Table` / `UnpackedValues` / `?` 后缀 | 同一 `[LuaMarshalAs]` 配置两边生效 |
| ref/out/in StructUserData 真 ref | 语义一致；Mono 实现可 pin/box，但行为须对齐 |

## 14. 相关文档

| 主题 | 文档 |
|------|------|
| 默认矩阵 | [01-OVERVIEW.md](./01-OVERVIEW) |
| `[LuaMarshalAs]` | [02-MARSHAL-AS.md](./02-MARSHAL-AS) |
| byref | [03-BYREF.md](./03-BYREF) |
| OpaqueValue | [04-OPAQUE.md](./04-OPAQUE) |
| 枚举 | [08-ENUM.md](./08-ENUM) |
| `zlua.*` API | [../05-LIB.md](../05-LIB) |
| 类型表 / `__call` | [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM) |
