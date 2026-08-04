---
sidebar_position: 12.5
title: LuaAlias
description: "[LuaAlias] 换名与 XML（luaAliasXmlPaths / ZLuaAlias）。"
---

# LuaAlias

给某个 C# 方法指定 **Lua 侧最终键名**（**换名**，不是「默认名 + 额外别名」）。有别名时 **不再** 以 `MethodInfo.Name` 注册该方法。单候选时为 **direct**（O(1)），适合热路径。

权威：[重载规范 §5](/docs/spec/04-METHOD-OVERLOAD/)。与其它选重载手段对照见 [方法重载](/docs/guides/overloads/)。

## 何时用

| 场景 | 做法 |
|------|------|
| 能改 C#，热路径要短名 + 冒号 | **`[LuaAlias]`** |
| 不能改源码（预编译 DLL） | Settings **`luaAliasXmlPaths`** + `ZLuaAlias` XML |
| 不能改 C#、运行时临时挂名 | `zlua.register_method`（见 [重载](/docs/guides/overloads/)） |
| 只想精确点名、不在乎写法 | 全签名键 `demo['Run(System.Int32)'](demo, 5)` |

## `[LuaAlias]` 属性

```csharp
using ZLua;

public class Demo
{
    [LuaAlias("run_i32")]
    public void Run(int value) { }

    public void Run(string value) { }
}
```

```lua
local demo = CSharp.AC.Demo()
demo:run_i32(10)    -- 命中 Run(int)；该方法不再挂名为 "Run"
demo:Run("hi")      -- 仅剩 Run(string) 等未换名的重载 → 此处为 direct 或 dispatch
```

| 项 | 说明 |
|----|------|
| 目标 | 仅 **Method** |
| 每方法 | 最多一个别名（`AllowMultiple = false`） |
| 继承 | **不**继承到子类重写 |
| 语义 | **替换**默认 Lua 名；不是追加 |

### 撞名（允许）

别名可以和其它方法的默认名或其它别名相同 → 并入同一 overload 组，调用时走 **dispatch**：

```csharp
public void Foo(int x) { }

[LuaAlias("Foo")]           // Bar 换名为 Foo，并入 "Foo" 组；不再挂 "Bar"
public void Bar(string s) { }

[LuaAlias("print")]
public void LogA(int x) { }

[LuaAlias("print")]         // 两个 print → dispatch
public void LogB(string s) { }
```

```lua
d:Foo("hi")     -- 组内选 Bar(string)
d:print(1)      -- 组内选 LogA(int)
-- d:Bar("x")   -- 不可用
```

静态方法写在类型表上：`Demo.add_i32(...)`；实例用冒号：`obj:run_i32(...)`。

## XML 配置

与 `[LuaMarshalAs]` **分开**：

| | Alias | MarshalAs |
|--|-------|-----------|
| Settings 字段 | **`luaAliasXmlPaths`** | `marshalAsXmlPaths` |
| 根元素 | **`ZLuaAlias`** | `ZLuaMarshalAs` |
| 文件 | **分文件** | 分文件 |

```xml
<?xml version="1.0" encoding="utf-8"?>
<ZLuaAlias version="1">
  <Assembly name="Assembly-CSharp">
    <Type fullName="Demo">
      <Method name="Run" signature="(System.Int32)" alias="run_i32"/>
    </Type>
    <Type fullName="MyGame.UI.Panel">
      <Method name="Show" signature="()" alias="show_panel"/>
    </Type>
  </Assembly>
</ZLuaAlias>
```

| 属性 | 说明 |
|------|------|
| `Assembly/@name` | 程序集短名（如 `Assembly-CSharp`） |
| `Type/@fullName` | CLR 全名；嵌套 `Outer+Inner` |
| `Method/@name` | C# 方法名 |
| `Method/@signature` | **仅参数**：`()` / `(System.Int32)`；byref 加 `&`；**不含**返回类型 |
| `Method/@alias` | **必填**；该方法的唯一最终 Lua 名 |

本文件 **只**允许 `Assembly` → `Type` → 带 `@alias` 的 `Method`。不要写 `MarshalAs` / `Param` / `Return` 等。

### 优先级与平台

- 同一方法：**Attribute > XML**（有 Attribute 则忽略该槽位 XML）
- **Mono**：运行时读 `luaAliasXmlPaths`
- **Il2Cpp**：Generate 写入静态表，**Player 不读 XML**（改 XML 后须重新 Generate）
- 同一 `(assembly, type, method, signature)` 多条 `@alias` → **失败**

在 Project Settings → **ZLua** 里把 XML 路径填入 **`luaAliasXmlPaths`**（与 MarshalAs 路径列表并列）。

## 与全签名键 / `register_method`

| 方式 | 说明 |
|------|------|
| 全签名键 | Bind 自动；不换默认名；写法 `demo['Run(System.Int32)'](demo, 5)` |
| `[LuaAlias]` / XML | Bind 期 **换名**；热路径首选短名冒号 |
| `register_method` | 运行时把已有 direct 挂到 **空位**短名；不合并 overload |

## 常见错误

| 现象 | 原因 |
|------|------|
| `demo:Run(10)` 调不到已标 alias 的重载 | 已换名，应使用别名或其它未换名的重载 |
| `demo:Bar` 为 nil | `Bar` 被 `[LuaAlias("Foo")]` 换走 |
| XML 不生效（Player） | 未重新 **Generate**；或路径写在了 `marshalAsXmlPaths` |
| 与 MarshalAs 写在同一根元素 | 须独立 `ZLuaAlias` 文件 |






## 学习路径

| | |
|---|---|
| **上一篇** | [方法重载](/docs/guides/overloads/) |
| **下一篇** | [常用 zlua 库](/docs/guides/zlua-lib/) |

## 相关文档

- [方法重载](/docs/guides/overloads/)  
- [重载规范 §5](/docs/spec/04-METHOD-OVERLOAD/)  
- [LuaAlias 参考](/docs/reference/csharp/lua-alias/)  
- [LuaMarshalAs](/docs/guides/lua-marshal-as/)（另一套 XML，勿混用）
