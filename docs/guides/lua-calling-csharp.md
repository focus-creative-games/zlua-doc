---
sidebar_position: 4
title: Lua 调用 C#
description: 访问类型、静态/实例成员、构造与 Event（add_/remove_）。
---

# Lua 调用 C#

通过全局 **`CSharp`** 根表访问 public 类型与成员。语义贴近 C#：`Type()` 构造、`obj:Method()` 调实例方法、静态走类型表。含 namespace 须括号键。

Canonical：[app.lua](https://github.com/focus-creative-games/zlua-demo/blob/main/LuaScripts/app.lua)、[Demo.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Demo.cs)

同名多签名的解析见 [方法重载](/docs/guides/overloads/)（本章末有预告）。

## 1. 访问类型

```
CSharp
  └─ Assembly-CSharp
       └─ Demo
       └─ ['MyGame.UI.Panel']
```

```lua
CSharp['AC'] = CSharp['Assembly-CSharp']   -- 推荐短别名

local Demo = CSharp.AC.Demo
local Panel = CSharp.AC['MyGame.UI.Panel']
local Nested = CSharp.AC['Outer+Nested']   -- 嵌套类型用 +
```

| 类型 | Lua 访问 |
|------|----------|
| 无 namespace | `CSharp.AC.Demo` |
| 含 namespace | `CSharp.AC['MyGame.UI.Panel']` |
| 嵌套 | `CSharp.AC['Outer+Nested']` |
| BCL | `CSharp.mscorlib['System.Int32']` 等 |

:::warning
含点号的 namespace **不能** `CSharp.AC.MyGame.UI.Panel` 链式点开，必须字符串键。
:::

- 类型 **懒加载**；仅 **public** 可见  
- 静态与实例元数据 **独立**，不可混用  

## 2. 静态成员（字段、属性、方法）

```lua
-- 静态方法
print(CSharp.AC.Demo.Add(3, 5))

-- 静态字段 / 无参 Property
CSharp.AC.Demo.s_x = 10
print(CSharp.AC.Demo.GetSX())
```

| C# | Lua 读 | Lua 写 |
|----|--------|--------|
| 静态字段 `s_x` | `Type.s_x` | `Type.s_x = v` |
| 静态无参 Property | `Type.Prop` | `Type.Prop = v` |
| 静态方法 | `Type.Add(a, b)` | — |

## 3. 构造实例

```lua
local demo = CSharp.AC.Demo()   -- ≡ new Demo()
```

有参构造支持默认重载分派；多构造见 [方法重载](/docs/guides/overloads/)。

## 4. 实例成员（字段、属性、方法）

```lua
local demo = CSharp.AC.Demo()

demo:SetX(10)          -- 实例方法（冒号传 self）
print(demo:GetX())

demo.x = 20            -- public 字段与无参 Property 写法相同
print(demo.x)
```

| 语法 | 含义 |
|------|------|
| `demo:GetX()` | 实例方法 |
| `demo.x` | 字段或无参 Property |
| `CSharp.AC.Demo.Add(3,5)` | 静态方法 |

### 字段与 Property 要点

- 无参 `{ get; set; }` 与字段语法一致；Il2Cpp Player 上简单 int property 可走 offset 快路径，热路径优先 `demo.x` 而非 `GetX()`  
- 带参 indexer（`this[int]`）按 **方法** 分派，不能随意写 `obj[i]`（szarray 等有专门规则，见 [数组](/docs/guides/arrays/)）  
- 未注册成员 **strict miss** → `error`，无反射 fallback  

### 继承

子类实例可调基类 public 实例成员；静态成员走 **声明类型** 的类型表。

### nil 与 null

- Lua `nil` → C# 引用类型 `null`；反之亦然  
- 值类型 struct **不能**为 nil（除非 `Nullable<T>`，见 [值类型](/docs/guides/value-types/)）  

## 5. Event（`add_` / `remove_`）

ZLua **没有** Event 专用元表（无 `.get` / `.set` / 赋值糖）。使用编译器生成的普通方法：

```lua
local function onChanged(v)
    print("hp", v)
end

host:add_OnHealthChanged(onChanged)
-- ...
host:remove_OnHealthChanged(onChanged)  -- 须同一 function 引用
```

静态 event：`Type.add_Foo(handler)`。handler 为 Lua `function`，按 [Function](/docs/guides/functions/) 隐式 marshal。

若看到 `OnX.get is nil`，说明仍在用 xLua 式糖语法，改为 `add_` / `remove_`。

## 完整示例（摘自 Demo）

```lua
local function test_call_static_method()
    print("Demo.Add:", CSharp.AC.Demo.Add(3, 5))
end

local function test_call_instance_method()
    local demo = CSharp.AC.Demo()
    print("Demo:GetX():", demo:GetX())
end

local function test_access_instance_field()
    local demo = CSharp.AC.Demo()
    demo:SetX(10)
    assert(demo.x == 10)
    demo.x = 20
    assert(demo:GetX() == 20)
end
```

## 方法重载预告

`demo:Run(10)` 与 `demo:Run("hi")` 在多重载时走运行时分派。精确点名用全签名键 `demo['Run(System.Int32)'](demo, 10)`（Bind 自动，无需 API）；热路径短名用 `[LuaAlias]` 或 `register_method`。见 [方法重载](/docs/guides/overloads/)。

## 常见错误

| 现象 | 处理 |
|------|------|
| `type not found` | 程序集名、namespace 括号、是否 public |
| `static member not found` | 勿用实例访问静态；用类型表 |
| `instance member not found` | 拼写 / 可见性 |
| `member not writable` | 只读 Property |
| Event `.get` 为 nil | 改用 `add_` / `remove_` |













## 学习路径

| | |
|---|---|
| **上一篇** | [EmmyLua 调试器](/docs/guides/debugger/) |
| **下一篇** | [C# 调用 Lua](/docs/guides/csharp-calling-lua/) |

## 相关文档

- [类型系统规范](/docs/spec/02-TYPE-SYSTEM/)  
- [CSharp 根表参考](/docs/reference/lua/csharp-root/)  
- [元表模型](/docs/concepts/metatable-model/)  
- [方法重载](/docs/guides/overloads/)
