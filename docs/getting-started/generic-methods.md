---
sidebar_position: 4
title: 泛型方法（入门）
description: 先分清「泛型类上的普通方法」与「方法自身带类型参数」，再以 GetComponent 为例。
---

# 泛型方法（入门）

和 C# 一样，Lua 侧先分清两类情况：

| 情况 | 例子 | Lua 怎么做 |
|------|------|------------|
| **泛型类已闭合**，调其上的普通方法 | `List<int>.Add` | 先 `make_generic_type`，再像普通实例方法调用 |
| **方法自身** 带类型参数 | `NameOf<T>()` / `GetComponent<T>()` | 用 `inflate` 或 GTAP **闭合方法上的 `T`** |

完整类型闭合与更多规则见 [泛型](/docs/guides/generics/)。

## 1. 泛型类上的普通方法

声明类型上的 `T` 已在类型侧闭合后，成员不再是「开放泛型方法」，**不需要** `inflate` / GTAP：

```lua
-- 模块顶层 / 初始化时闭合一次并缓存
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32
)

local list = ListInt()
list:Add(10)    -- 普通实例方法
list:Add(20)
print(list.Count)
```

`Dictionary<string, int>` 等同理：先闭合类型，再 `dict:Add("hp", 100)`。

:::tip
`make_generic_type` 有 intern，但 **不要** 在热循环里反复调用同一组实参；把 `ListInt` 等闭合类型表缓存在 upvalue / 模块字段。
:::

## 2. 方法自身带泛型参数

方法签名里还有自己的 `<T>`（与声明类型是否泛型无关）时，短名默认是 **开放** 的，须先闭合再调。

假设 C#：

```csharp
public class Sample
{
    public static string NameOf<T>() => typeof(T).Name;

    public T Echo<T>(T value) => value;
}
```

### `zlua.inflate`（推荐热路径）

```lua
local Sample = CSharp.AC.Sample   -- 按工程装配 / 命名空间取类型表

-- 静态：闭合一次，缓存 closure
local NameOfInt = zlua.inflate(Sample, "NameOf", zlua.types.int32)
print(NameOfInt())                -- "Int32"

-- 实例：同样先 inflate 再调
local sample = Sample()
local EchoStr = zlua.inflate(Sample, "Echo", zlua.types.string)
print(EchoStr(sample, "hi"))      -- "hi"
```

typeArg 还可用类型表、`zlua.typeof(...)`、类型名字符串等（见 [05-LIB §9](/docs/spec/05-LIB/)）。

:::warning
**勿在循环里 inflate。** 热路径也避免用类型名字符串作 typeArg（按名解析更重），优先类型表 / `zlua.types.*`。

```lua
-- ✗ 每帧 / 每次调用都 inflate
for i = 1, n do
    zlua.inflate(Sample, "Echo", zlua.types.string)(sample, "hi")
end
```

应在外层缓存 `EchoStr`，循环内只 `EchoStr(sample, …)`。
:::

### GTAP（偶发调用更方便）

调用前前缀 **N** 个 `System.Type`（用 `zlua.typeof`），**不能**直接塞类型表：

```lua
print(Sample.NameOf(zlua.typeof(zlua.types.int32)))

local sample = Sample()
print(sample:Echo(zlua.typeof(zlua.types.string), "hi"))
```

:::warning
**热路径慎用 GTAP。** 每次调用都走开放方法前缀路径，且常伴随 `typeof`。初始化、工具脚本可用；**Update / 战斗逻辑**请改用上方已缓存的 `inflate` closure。

```lua
-- ✗ 热循环
for i = 1, n do
    sample:Echo(zlua.typeof(zlua.types.string), "hi")
end

-- ✓
local EchoStr = zlua.inflate(Sample, "Echo", zlua.types.string)
for i = 1, n do
    EchoStr(sample, "hi")
end
```
:::

| 路径 | 要点 |
|------|------|
| `inflate` | 先闭合再调；**热路径首选**（缓存 closure） |
| GTAP | 短名 + `typeof` 前缀；适合偶发，不适合热循环 |

## 3. 示例：`GameObject.GetComponent`

Unity 里最常见的开放泛型方法：`GameObject.GetComponent<T>()`（声明类型是普通 class，**方法** 带 `T`）。

```lua
local UE = CSharp['UnityEngine.CoreModule']
local GameObject = UE['UnityEngine.GameObject']
local Rigidbody = UE['UnityEngine.Rigidbody']
-- local go = ...  -- 某个 GameObject 实例
```

### inflate（推荐）

```lua
-- 启动时 / 模块加载时闭合一次
local GetRb = zlua.inflate(GameObject, "GetComponent", Rigidbody)

local rb = GetRb(go)   -- 等价于 C# go.GetComponent<Rigidbody>()
```

:::tip
反复取同一组件类型时，**只 inflate 一次**，热路径只调 `GetRb(go)`。
:::

### GTAP

```lua
local rb = go:GetComponent(zlua.typeof(Rigidbody))
```

- **不能**写 `go:GetComponent(Rigidbody)`（类型表不是合法 GTAP 前缀）
- 存在 `GetComponent(Type)` 等非泛型重载时，GTAP 仍优先匹配开放泛型候选

:::warning
**勿在 Update 里每帧 GTAP。** 若坚持 GTAP，至少缓存 `local rbType = zlua.typeof(Rigidbody)`，避免循环内反复 `typeof`；仍不如直接缓存 `GetRb`。

```lua
-- ✗
function Update()
    local rb = go:GetComponent(zlua.typeof(Rigidbody))
end

-- ✓
local GetRb = zlua.inflate(GameObject, "GetComponent", Rigidbody)
function Update()
    local rb = GetRb(go)
end
```
:::

### 和「非泛型重载」别混

| 写法 | 含义 |
|------|------|
| `go:GetComponent(zlua.typeof(Rigidbody))` | GTAP → `GetComponent<Rigidbody>()` |
| `go:GetComponent(Rigidbody)` | **错误**（类型表当普通实参） |
| `go:GetComponent("UnityEngine.Rigidbody")` | 若存在 string 重载则走 string，**不是**泛型闭合 |

### 返回值门面

闭合后声明返回常为 `Component`。若希望返回值直接按实际组件类型访问成员，见 [返回值门面类型](/docs/guides/actual-type-userdata/)；或脚本侧 `zlua.cast`。

## 下一步

开放声明类型再 `inflate`、更多 typeArg / 错误表见 [泛型](/docs/guides/generics/)。
