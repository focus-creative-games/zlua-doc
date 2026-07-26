---
sidebar_position: 10
title: "OpaqueValue（临时不透明参数）"
---

# OpaqueValue（临时不透明参数）

> **规范性：** C# 调用 Lua 时，将形参/局部在 C# 调用栈上的存储地址暴露给脚本的临时令牌；以及 `[LuaMarshalAs(OpaqueValue)]` 强制路径。  
> **byref 默认（C#→Lua）：** `ref`/`in`/`out` 形参 **默认** 即为 OpaqueValue，见 [03-BYREF.md §2](/docs/spec/marshal/03-BYREF/)。  
> **API：** `zlua.get_opaquevalue` / `zlua.set_opaquevalue`（native：`__zlua_get_opaquevalue` / `__zlua_set_opaquevalue`），签名见 [../05-LIB.md](/docs/spec/05-LIB/)。

## 1. 定义

OpaqueValue 是 **C# 调用 Lua** 时，将某个 **形参/局部在 C# 调用栈上的存储地址** 暴露给脚本的临时令牌。脚本可在 **本次调用有效期内** 读取、写回；在 **目标形参类型允许** 时亦可将 handle **原样** 作为 **Lua→C#** 实参传回（§6）；**不可** 持久化后跨调用使用。

参数/返回值标注 **`[LuaMarshalAs(LuaMarshalType.OpaqueValue)]`** 时 **强制** Push OpaqueValue（[02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/)）；**`ref` / `out` / `in`** 形参在 C#→Lua 路径上 **默认** 即为 OpaqueValue（§3）。

## 2. Lua 可见形态

| 项 | 规则 |
|----|------|
| Lua 类型 | **lightuserdata** |
| 载荷 | **handle**（编码 `generation + index`）；与 `lua_pushlightuserdata` / `lua_touserdata` 一致 |
| 平台 | 32/64 位用对应宽度整数装入 `void*`，**不得** 假定固定 64 位 |
| metatable | **无**；**不可** `:` / `.` 访问成员 |

脚本侧将其视为 **不可自解引用的临时 handle**；读写须经 `zlua.get_opaquevalue` / `zlua.set_opaquevalue`（§5）。

与长生命周期 **ByObjUserData / StructUserData** 不同：OpaqueValue **不** 注册对象表、不拷贝到独立 userdata，仅暴露「当前调用栈上的参数位置」。

## 3. 产生方向与可表达类型

| 规则 | 说明 |
|------|------|
| **仅 C# → Lua 创建** | 只由 native 在 C# 调 Lua 的 marshal 路径 Push；**无** Lua API 伪造合法 handle |
| **可产生 OpaqueValue 的形参** | ① **`ref` / `in` / `out T`**（**任意** `T`）——**默认**即为 OpaqueValue（§3.1）；② **任意 by-val CLR 类型**——标注 `[LuaMarshalAs(OpaqueValue)]` 即可 Push Opaque（含基元 / enum；对后者通常无实质必要） |
| **方向限制** | `OpaqueValue` 标注仅用于 **C#→Lua**；标在纯 Lua→C# 形参上非法（见 [02-MARSHAL-AS.md §3.1](/docs/spec/marshal/02-MARSHAL-AS/)） |
| 槽义 | `valueAddress` 指向该实参在 **当前 C# 栈帧** 上的存储位置（by-val 为值槽；`ref`/`in`/`out` 为 **指针槽**） |

### 3.1 `ref` / `out` / `in` 默认即为 OpaqueValue

| 方向 | 规则 |
|------|------|
| **C# → Lua** | 形参为 **`ref` / `out` / `in T`** 时，**默认** Push **OpaqueValue**（登记 byref 类型 + 指针槽地址）；**无需** 再标 `OpaqueValue` |
| **非 byref** | 默认走 [01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/)；任意类型标注 `OpaqueValue` 时 Push Opaque（基元 / enum 合法但通常无实质必要） |

因此 Lua 回调收到的 `ref int x` **不是** integer，而是 **lightuserdata handle**；须用 §5 API 读整数 / 写回。若再传给其它 C# 方法：对 **struct / 托管引用类型** 形参可将 handle **原样** 传回（§6）；对 **`int` 等简单类型** 形参 **必须** 先 `get_opaquevalue`（§6）。

## 4. 生命周期与禁止持久化

| 规则 | 说明 |
|------|------|
| 有效域 | **仅** 产生它的那次 **C# 调用 Lua** 尚未返回期间（与 OpaqueParameterScope / generation 同步） |
| 回调内可用 | 在同一回调内：`get` / `set`；以及按 §6 规则作为 **Lua→C#** 实参传回 |
| **禁止保存** | **不得** 写入全局、upvalue、表字段后在 **异步**、**后续 pcall** 或 **C# 已返回** 后再使用 |
| 失效后 | `get` / `set` / 作为实参 Pop（自动解路径） → **报错**（`invalid opaque parameter handle`） |

```lua
-- C# 调 Lua 回调期间：
function OnTick(h)                      -- h = OpaqueValue (e.g. ref int)
    local v = zlua.get_opaquevalue(h)   -- 合法
    zlua.set_opaquevalue(h, v + 1)      -- 合法
    CS.Demo.UseInt(v)                   -- 合法：简单类型须先解值再传
    -- CS.Demo.UseInt(h)                -- 不合法：int 形参不自动识别 OpaqueValue
end

function OnPoint(h)                     -- h = OpaqueValue (e.g. Point2D / ref Point2D)
    CS.Demo.UsePoint(h)                 -- 合法：struct 形参自动解 OpaqueValue（§6）
    local p = zlua.get_opaquevalue(h)   -- 亦可先解再传 / 访问成员
    print(p:GetSum())
end
-- C# 返回后仍持有 h → 下次使用报错
```

**长生命周期：** 须用 **`zlua.to_user_data(opaque)`**（**拷贝** 到 StructUserData / ClassUserData）或 C#→Lua 默认 Push 的 StructUserData 路径，见 [05-STRUCT.md](/docs/spec/marshal/05-STRUCT/)。

## 5. 读写 API：`get_opaquevalue` / `set_opaquevalue`

OpaqueValue **无** 成员访问；脚本侧读写指向内存须通过下列 API。

### 5.1 `zlua.get_opaquevalue(opaque_handle) → value`

将 handle 指向的参数 **按默认 C#→Lua 规则压栈并返回**（Lua 封装通常返回单值）：

| handle 指向类型 | 行为 |
|-----------------|------|
| **非** `ref`/`in`/`out` | 对槽上值走 [01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/) **默认 marshal** Push（如 `int` → integer，`string` → string） |
| **`ref` / `in` / `out T`** | **先解引用** 指针槽，再对 **`T`**（去 byref）做默认 Push。例：`ref int` → **integer**，**不是** 指针 / lightuserdata |

### 5.2 `zlua.set_opaquevalue(opaque_handle, new_value)`

用 `new_value` **更新** handle 指向的参数：

| handle 指向类型 | 行为 |
|-----------------|------|
| **非** `ref`/`in`/`out` | 按 [01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/) **默认 Lua→C#** marshal 写入槽 |
| **`ref` / `in` / `out T`** | **先解引用**，再按 **`T`** 的默认 Lua→C# 规则写入目标内存。例：`ref int` ← integer，更新指针所指单元 |

```lua
function OnRefInt(h)
    local x = zlua.get_opaquevalue(h)   -- integer
    zlua.set_opaquevalue(h, x + 10)
end
```

过期 / 非 lightuserdata / 损坏 handle → `luaL_error`。

## 6. 作为 Lua→C# 实参传回（按目标类型分流）

在 handle **仍有效** 的同步链内，脚本可将 OpaqueValue 用于 **Lua→C#** 形参。为降低热路径开销，**并非** 所有目标类型都会在 Pop 时探测 lightuserdata 是否为 OpaqueValue：

| 目标 C# 形参类型（去 byref 后的元素类型） | Lua→C# 是否自动解 OpaqueValue | 脚本侧做法 |
|------------------------------------------|-------------------------------|------------|
| **托管引用类型**：普通 `class`、`string`、`delegate`、数组、boxed struct（`object` / ByObj 路径上的装箱值类型）等 | **是** | 可将 handle **原样** 传入；校验 + 类型兼容后从登记的 `valueAddress` **拷贝 / 绑定** 到目标槽 |
| **`struct`（普通值类型 struct，非 enum）** | **是** | 同上；典型零拷贝/同槽回传场景 |
| **简单类型**：`bool`、`char`、整型、`float`/`double`、`IntPtr`/`UIntPtr`、**enum** 等 | **否** | Pop **不** 检查 OpaqueValue。须先 `zlua.get_opaquevalue(h)` 得到默认 marshal 后的 Lua 值（如 integer），再传入 |

```lua
-- struct / class：自动解
function OnOpaquePoint(h)
    CS.Demo.AcceptPoint(h)                          -- OK
end

-- int / enum 等：不自动解
function OnOpaqueInt(h)
    CS.Demo.AcceptInt(zlua.get_opaquevalue(h))      -- OK
    -- CS.Demo.AcceptInt(h)                         -- 失败
end
```

| 细则 | 说明 |
|------|------|
| **性能动机** | 基元 Pop 是极热路径；若每次先测 OpaqueValue，会拖慢全部 `int`/`float` 等 Marshal |
| **byref**（`ref`/`in`/`out` A） | **一律** 按 [03-BYREF.md](/docs/spec/marshal/03-BYREF/)：**先**识别 OpaqueValue，类型兼容则 **直传地址**（含 `ref int`）；**不** 套用上表「简单类型不自动解」规则 |
| **by-val 简单类型** | 上表「否」：须先 `get_opaquevalue` 再传入 |
| **类型兼容** | Opaque→byref / 自动解时须与目标类型兼容，否则报错（禁止 `ref object` Opaque → `ref int`） |
| **过期 handle** | 仅在 **会走自动解** 的路径上才执行 OpaqueValue 校验 |
| **成员访问** | 期望 **ByObjUserData / StructUserData** 的 API **不得** 对 opaque 做 `:` / `.`；须先 `get_opaquevalue`，或传给接受该类型的 C# 形参让绑定层自动解 |

## 7. 与 struct Handle 路径的关系

struct 的 **默认 C#→Lua by-val** 路径在同步调用链内也可能产出 OpaqueValue（lightuserdata handle），与 §2 形态一致。脚本 **不可** 对 opaque 做字段/方法访问；须：

- `zlua.get_opaquevalue` / `zlua.set_opaquevalue` 读写；或
- `zlua.to_user_data(opaque)` **拷贝** 为 StructUserData 后再 `:` / `.`；或
- 在 §6 允许的类型上 **原样传回** C# 形参。

详细 struct 形态见 [05-STRUCT.md](/docs/spec/marshal/05-STRUCT/)。

## 8. 设计要点摘要

| 维度 | 结论 |
|------|------|
| 仅 C#→Lua 创建 | 地址来自 C# 调用栈；Lua 无法伪造合法槽 |
| 谁可 Opaque | **`ref`/`in`/`out`（任意 T）** 默认；**任意 by-val 类型**均可标注 `OpaqueValue`（基元 / enum 合法但通常无实质必要） |
| 无 metatable | 避免误当 userdata 成员访问；强制经 get/set |
| 禁止跨调用保存 | `generation` 拦截过期 use-after-return |
| get 解引用 byref | `ref int` 对脚本呈现为 int，符合默认 marshal 心智 |
| Lua→C# 自动解分流 | **仅** struct / 托管引用类型 Pop 识别 OpaqueValue；简单类型须 `get_opaquevalue` 后再传 |

## 9. 相关文档

| 主题 | 文档 |
|------|------|
| Lua→C# byref | [03-BYREF.md](/docs/spec/marshal/03-BYREF/)（Opaque / ByValUserData 直传地址；其余临时槽） |
| `[LuaMarshalAs(OpaqueValue)]` | [02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/) |
| struct ByVal / StructUserData | [05-STRUCT.md](/docs/spec/marshal/05-STRUCT/) |
| `zlua.*` 签名 | [../05-LIB.md](/docs/spec/05-LIB/) |
| 实现细节 | [../../impl/marshal/](/docs/impl/marshal/) |
