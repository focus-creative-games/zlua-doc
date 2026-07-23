---
sidebar_position: 9
title: "`ref` / `in` / `out` 编组"
---

# `ref` / `in` / `out` 编组

> **规范性：** byref 形参（元素类型记为 **A**）在 C# ↔ Lua 双向调用中的编组语义。  
> **C#→Lua：** 默认 **OpaqueValue**，细节见 [04-OPAQUE.md](./04-OPAQUE)。  
> **Lua→C#：** 本节 §3 起。

## 1. 适用范围

| 路径 | `ref` / `out` / `in` |
|------|----------------------|
| **C# → Lua**（`[LuaInvoke]`、delegate bridge） | **支持**；默认 Push **OpaqueValue** |
| **Lua → C#**（普通方法 / 构造、delegate `Invoke` / `__call`） | **支持**；规则见 §3 |

**统一规则（Lua→C#）：** Lua 侧 **不区分** `ref` / `out` / `in`，均按同一 Pop 规则处理；C# 侧仍保留各自 CLR 语义（如 `in` 只读）。

下文将 C# 形参写作 `ref A` / `in A` / `out A`，其中 **A** 为去 byref 后的元素类型。

---

## 2. C# → Lua

形参为 `ref` / `in` / `out A` 时，**默认** Push **OpaqueValue**（lightuserdata handle，指向 C# 调用栈上的该参数槽）。

- 脚本经 `zlua.get_opaquevalue` / `zlua.set_opaquevalue` 读写。
- **不** 在此路径 Push ByValUserData / ClassUserData。
- 完整规则：[04-OPAQUE.md](./04-OPAQUE)。

---

## 3. Lua → C#：总原则

对 `ref` / `in` / `out A`，绑定层最终向 C# 传入的是 **某个 `A*`（或等价托管 byref）地址**。

| Lua 实参形态 | 行为概要 | C# 对 `*slot` 的修改能否反映到该 Lua 值 |
|--------------|----------|----------------------------------------|
| **OpaqueValue**（类型兼容） | 使用 handle 指向的地址 | **能**（写回原 C# 栈槽 / 已绑定地址） |
| **ByValUserData** 且类型与 **A** 相等 | 使用 userdata **payload 地址** | **能**（写回 userdata 载荷） |
| **其它一切可接受形态** | 先编组出值，写入 **本次调用的栈临时变量**，再传 **临时变量地址** | **不能**（临时槽在 Invoke 后丢弃） |

因此：裸 `number` / Lua `string` / 多数 ByObjUserData 等传入 `ref A` 时 **不报错**，但脚本侧原值 **看不到** C# 的写回（与「无 Lua lvalue」一致）。

```lua
local x = 5
CS.Demo.Increment(x)   -- 拷贝进临时 int；C# 改的是临时槽；x 仍为 5

local p = Point2D(1, 2)          -- ByValUserData，类型 == Point2D
CS.Demo.Offset(p, 10, 20)        -- 传 payload 地址；Invoke 后 p 的字段已变
```

---

## 4. Lua → C#：分支细则

按 **Lua 实参形态** 与 **A** 的类别依次判定。类型不兼容 → `luaL_error`（示例：`ref object` 的 OpaqueValue **不得** 传给 `ref int`）。

### 4.1 OpaqueValue

1. 校验 handle 有效（generation / scope，见 [04-OPAQUE.md](./04-OPAQUE)）。
2. 校验 handle 登记的元素类型与 **A** **兼容**（须精确匹配或实现定义的可赋值规则；**禁止** 如 `ref object` → `ref int` 这类不相容配对）。
3. 将 **handle 指向的地址** 交给 C# byref（**不** 再拷贝到临时槽）。

### 4.2 A 为值类型（struct / enum 等，非下文单独列出的基元路径）

| Lua 实参 | 行为 |
|----------|------|
| **ByValUserData**，且 userdata 绑定类型 **等于 A** | 传 **payload 地址**（可写回 userdata） |
| **ByValUserData**，类型 **≠ A**，但 **A 为 `Nullable<T>`** 且 userdata 类型 **等于 T** | 将 T 的值 **复制** 到栈上 **`Nullable<T>` 临时变量**，传该临时变量地址（**不** 写回原 ByValUserData） |
| **其它**（含 integer 表示的 enum、table 等，在 by-val 规则允许的前提下） | 按 by-val 规则得到 `A` 值 → 写入栈临时变量 → 传临时地址 |

### 4.3 A 为基元类型（`bool` / `char` / 整型 / 浮点等）

| Lua 实参 | 行为 |
|----------|------|
| 对应 **primitive** Lua 值（integer / number / boolean 等，规则同 [01-OVERVIEW.md](./01-OVERVIEW)） | **复制** 到栈上临时变量，传临时地址 |
| **OpaqueValue**（类型兼容） | 见 §4.1 |
| **ByValUserData** | 通常不用于基元；若实现不提供基元 ByValUserData，则按非法或不走 payload 直传 |

基元 **没有**「改 Lua `local`」的路径：即使 C# 修改了 `ref int`，裸 number 实参也只影响临时槽。

### 4.4 A 为 `string`

| Lua 实参 | 行为 |
|----------|------|
| **`string` 的 ByObjUserData** | 将托管对象指针写入栈临时变量，传临时地址 |
| **Lua `string`** | 创建托管 `System.String`，指针写入栈临时变量，传临时地址 |
| **`nil`** | 临时槽为 `null`；传临时地址（`out` 等同理，见 §5） |
| **OpaqueValue**（类型兼容） | 见 §4.1 |

两种非 Opaque 路径均为 **临时槽**：**C# 对 `ref string` 重新赋值不会改写** Lua 侧原 userdata / 原 Lua string。

### 4.5 A 为其它引用类型（class / interface / 数组 / delegate / `object` 等）

| Lua 实参 | 行为 |
|----------|------|
| 可 Pop 为托管对象的形态（ByObjUserData、`nil`、以及声明类型允许的其它 by-val 形态） | 取得托管对象指针（或 `null`）→ 写入栈临时变量 → 传临时地址 |
| **OpaqueValue**（类型兼容） | 见 §4.1 |

同样：**临时槽** ⇒ C# **`ref` 重新绑定**（`refParam = other`）**不** 反映到 Lua；对象 **原地可变字段** 仍可通过共享引用可见（见 [06-CLASS.md](./06-CLASS)）。

---

## 5. `out` 与缺省 / `nil`

| 情况 | 行为 |
|------|------|
| 实参省略或 `nil`，且走 **临时槽** 路径 | 临时槽置 `default(A)`（引用类型为 `null`）；Invoke 后丢弃 |
| 实参为 **ByValUserData**（类型 == A）或兼容 **OpaqueValue** | 绑定已有地址；`out` 写回该地址 |

若脚本需要观察到 `out` / `ref` 写回结果，应传入：

- 类型匹配的 **ByValUserData**（值类型），或
- 仍在有效期内的兼容 **OpaqueValue**（常见于 C#→Lua 回调内再调回 C#）。

---

## 6. 桥接流程（概念）

```text
PopRefArgument(luaIndex, A):
  if IsOpaqueValue(luaIndex):
      CheckCompatible(opaque.ElementType, A)   // 例如禁止 object → int
      return BindRef(opaque.Address)

  if A is valuetype:
      if IsByValUserData(luaIndex):
          U = userdata.Type
          if U == A:
              return BindRef(&payload)
          if A is Nullable<T> && U == T:
              temp = (Nullable<T>)CopyFromPayload()
              return BindRef(&temp)
      // fallthrough → by-val into temp

  if A is primitive:
      value = PopPrimitive(luaIndex, A)
      temp = value
      return BindRef(&temp)

  if A is string:
      obj = PopStringAsManagedObject(luaIndex)  // ByObj 或 Lua string→new String
      temp = obj
      return BindRef(&temp)

  // other reference types
  obj = PopReference(luaIndex, A)
  temp = obj
  return BindRef(&temp)
```

Il2Cpp：`temp` 位于当前 `MethodBridge` / 调用帧；ByValUserData 为 `lua_newuserdata` payload。  
Mono：实现可不同（pin / box），**可观察语义**须与上表一致。

---

## 7. 双向对照

| 方向 | 默认形态 | 写回 |
|------|----------|------|
| **C# → Lua** | OpaqueValue | `set_opaquevalue` 或把 handle 再传入兼容 `ref A` |
| **Lua → C#** | Opaque / 匹配 ByValUserData → 直传地址；其它 → 临时槽 | 仅直传地址路径可改「原」存储 |

---

## 8. 示例

```lua
-- 临时槽：裸 number
CS.Demo.Increment(5)

-- ByValUserData：payload 真写回
local p = Point2D(1, 2)
CS.Demo.Offset(p, 10, 20)
assert.equal(p.x, 11)

-- Nullable：ByValUserData(T) → 拷入 Nullable<T> 临时槽（不写回原 userdata）
-- CS.Demo.SetNullable(p)   -- void SetNullable(ref Nullable<Point2D> n)

-- string：Lua string / ByObj → 临时槽（rebind 不可见）
CS.Demo.Replace(refStrHolder)  -- 视 API；裸 "hello" 亦进临时槽

-- C#→Lua 回调内：Opaque 再传回
function OnRefInt(h)
    zlua.set_opaquevalue(h, zlua.get_opaquevalue(h) + 1)
    CS.Demo.IncrementOpaque(h)   -- 兼容的 ref int Opaque → 直传地址
end
```

---

## 9. 相关文档

| 主题 | 文档 |
|------|------|
| OpaqueValue 生命周期与 get/set | [04-OPAQUE.md](./04-OPAQUE) |
| ByValUserData / struct | [05-STRUCT.md](./05-STRUCT) |
| 引用类型门面与 rebind | [06-CLASS.md](./06-CLASS) |
| 默认 by-val 矩阵 | [01-OVERVIEW.md](./01-OVERVIEW) |
| `[LuaInvoke]` / delegate | [09-FUNCTION.md](./09-FUNCTION)、[../01-HOST-API.md](../01-HOST-API) |
