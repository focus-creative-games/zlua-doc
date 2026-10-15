---
sidebar_position: 3
title: 函数调用
description: 方法重载、泛型方法与 params 在 Lua 侧的最短用法。
---

# 函数调用

从 Lua 调 C# 方法时，除普通冒号 / 点号调用外，常见还有三类情况：

| 主题 | 一句话 | 更深 |
|------|--------|------|
| **方法重载** | 默认按实参匹配；歧义用全签名键或 `[LuaAlias]` | [方法重载](/docs/guides/overloads/) |
| **泛型方法** | 方法自身带 `<T>` 时用 `inflate` / GTAP 闭合 | [泛型](/docs/guides/generics/) |
| **`params`** | 可展开多槽，或整段传 `T[]` userdata；**不能**传 table | [params 参数](/docs/guides/params/) |

日常静态 / 实例调用见 [快速开始](/docs/getting-started/quick-start/)、[Lua 调用 C#](/docs/guides/lua-calling-csharp/)。

---

## 1. 方法重载

Lua 没有编译期重载选择。同名多签名时，默认按实参匹配；需要点名再用全签名键或 Bind 期别名。

### 默认写法（优先）

```lua
demo:Run(10)        -- 匹配 Run(int)
demo:Run("hello")   -- 匹配 Run(string)
```

多候选时走 **dispatch**；只有一个 public 候选时该短名是 **direct**（零分派）。

### 精确点名

```lua
demo['Run(System.Int32)'](demo, 10)
```

键名含括号，须用括号键，并 **显式传 `self`**。方法名是 CLR `MethodInfo.Name`（不是 `[LuaAlias]` 短名）。

### 想要冒号短名

在 C# 标 `[LuaAlias("run_i32")]`（或 Alias XML），Bind 后即可 `demo:run_i32(10)`。**不要**期待运行时再挂短名。详见 [LuaAlias](/docs/guides/lua-alias/)。

默认参数、全签名键懒解析与排错见 [方法重载（指南）](/docs/guides/overloads/)。

---

## 2. 泛型方法

和 C# 一样，先分清两类情况：

| 情况 | 例子 | Lua 怎么做 |
|------|------|------------|
| **泛型类已闭合**，调其上的普通方法 | `List<int>.Add` | 先 `make_generic_type`，再像普通实例方法调用 |
| **方法自身** 带类型参数 | `NameOf<T>()` / `GetComponent<T>()` | 用 `inflate` 或 GTAP **闭合方法上的 `T`** |

### 2.1 泛型类上的普通方法

声明类型上的 `T` 已在类型侧闭合后，成员不再是「开放泛型方法」，**不需要** `inflate` / GTAP：

```lua
-- 模块顶层 / 初始化时闭合一次并缓存
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32
)

local list = ListInt()
list:Add(10)
list:Add(20)
```

:::tip
`make_generic_type` 有 intern，但 **不要** 在热循环里反复调用同一组实参；把 `ListInt` 等缓存在 upvalue / 模块字段。
:::

### 2.2 方法自身带泛型参数

短名默认是 **开放** 的，须先闭合再调。假设 C#：

```csharp
public class Sample
{
    public static string NameOf<T>() => typeof(T).Name;
    public T Echo<T>(T value) => value;
}
```

**`zlua.inflate`（推荐热路径）：**

```lua
local Sample = CSharp.AC.Sample

local NameOfInt = zlua.inflate(Sample, "NameOf", zlua.types.int32)
print(NameOfInt())

local sample = Sample()
local EchoStr = zlua.inflate(Sample, "Echo", zlua.types.string)
print(EchoStr(sample, "hi"))
```

:::warning
**勿在循环里 inflate。** 热路径也避免用类型名字符串作 typeArg，优先类型表 / `zlua.types.*`。

```lua
-- ✗
for i = 1, n do
    zlua.inflate(Sample, "Echo", zlua.types.string)(sample, "hi")
end
```
:::

**GTAP（偶发更方便）：** 前缀必须是 `System.Type`（`zlua.typeof`），不能直接塞类型表。

```lua
print(Sample.NameOf(zlua.typeof(zlua.types.int32)))
print(sample:Echo(zlua.typeof(zlua.types.string), "hi"))
```

:::warning
**热路径慎用 GTAP。** 每次调用都走开放方法前缀路径；Update / 战斗逻辑请缓存 `inflate` 返回的 closure。
:::

| 路径 | 要点 |
|------|------|
| `inflate` | 先闭合再调；**热路径首选** |
| GTAP | 短名 + `typeof` 前缀；适合偶发 |

### 2.3 示例：`GameObject.GetComponent`

```lua
local UE = CSharp['UnityEngine.CoreModule']
local GameObject = UE['UnityEngine.GameObject']
local Rigidbody = UE['UnityEngine.Rigidbody']

local GetRb = zlua.inflate(GameObject, "GetComponent", Rigidbody)
local rb = GetRb(go)

-- 偶发也可用 GTAP：
-- local rb = go:GetComponent(zlua.typeof(Rigidbody))
```

:::warning
**勿在 Update 里每帧 GTAP / inflate。** 启动时闭合一次，热路径只调 `GetRb(go)`。
:::

| 写法 | 含义 |
|------|------|
| `go:GetComponent(zlua.typeof(Rigidbody))` | GTAP → `GetComponent<Rigidbody>()` |
| `go:GetComponent(Rigidbody)` | **错误**（类型表当普通实参） |
| `go:GetComponent("UnityEngine.Rigidbody")` | 若存在 string 重载则走 string，**不是**泛型闭合 |

闭合后声明返回常为 `Component`；按实际类型出门面见 [返回值门面类型](/docs/guides/actual-type-userdata/)。更多见 [泛型](/docs/guides/generics/)。

---

## 3. `params` 参数

C# 尾部 `params T[]` 在 Lua 侧可 **展开** 多个实参，或传入 **整段** `T[]` userdata。与普通数组形参不同：**不能**用 Lua table / 单独的 `nil` 当整个数组。

```csharp
static void Sum(params int[] values) { }
static void Prefix(int head, params int[] tail) { }
```

```lua
Demo.Sum(1, 2, 3)      -- 展开 → int[]{1,2,3}
Demo.Sum()             -- → int[0]
Demo.Prefix(0, 1, 2)

-- 整段 userdata
Demo.Sum(arr)          -- arr 为 int[] ByObjUserData

-- ✗ Demo.Sum({ 1, 2, 3 })   -- table 不行
-- ✗ Demo.Sum(nil)           -- 不是 null 数组
```

与重载并存时，定参候选通常优先于 params 展开。完整规则与陷阱见 [params 参数](/docs/guides/params/)。

---

## 下一步

| 主题 | 指南 |
|------|------|
| 重载 / 默认参数 / 全签名键 | [方法重载](/docs/guides/overloads/) |
| 闭合类型与泛型方法 | [泛型](/docs/guides/generics/) |
| params 展开 / 整段 / 不支持范围 | [params 参数](/docs/guides/params/) |
| 别名短名 | [LuaAlias](/docs/guides/lua-alias/) |
