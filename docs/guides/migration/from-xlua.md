---
sidebar_position: 3
title: "从 xLua 迁移"
---

# 从 xLua 迁移到 ZLua

> **特性背景：** [compare/FEATURES.md](/docs/compare/FEATURES/)  
> **性能/GC：** [compare/PERFORMANCE.md](/docs/compare/PERFORMANCE/)、[compare/GC.md](/docs/compare/GC/)  
> **类型路径适配（可选）：** [规范 12 · xlua adaptor](/docs/spec/12-MIGRATION-ADAPTORS/) · [迁移索引](/docs/guides/migration/)

---

## 1. 概念对照

| xLua | ZLua |
|------|------|
| `CS.Namespace.Type` | 原生：`CSharp[assembly]['Namespace.Type']`；**或** xlua adaptor 继续写 `CS.*` |
| `LuaEnv` | `LuaAppDomain` + `moduleLoader` |
| `luaEnv:DoString` / `require` | 同 `require`；loader 由宿主提供 |
| `[LuaCallCSharp]` + Generate | **无**；public 类型 **懒 Bind**（适配清单仅迁移期路径兼容） |
| `[CSharpCallLua]` | `LuaAppDomain.GetFunction<T>("module","func")`（**适配不覆盖**） |
| `LuaFunction` / `xlua.tofunction` | `GetFunction` 直接调，或 **形参隐式 marshal** / `to_delegate`（见 [Function](/docs/guides/functions/)） |
| `ObjectTranslator` | `ObjectRegistry` + marshal 分册 |
| xLua Event 语法 | **无**；`add_Xxx` / `remove_Xxx` |
| `CS.System.Collections.Generic.List(CS.System.Int32)` | `zlua.make_generic_type(...)`（**适配不兼容**旧泛型构造语法） |
| struct / `out` | ByVal / Opaque / StructUserData（见 spec/marshal） |

---

## 2. 逐步迁移

### 步骤 1：替换宿主初始化

**Before（xLua）：**

```csharp
var luaEnv = new LuaEnv();
luaEnv.AddLoader(customLoader);
luaEnv.DoString("require 'main'");
```

**After（ZLua）：**

```csharp
LuaAppDomain.Initialize(moduleName =>
{
    // 返回 Tests/Lua/... 或 StreamingAssets 下源码
    return LoadLuaModuleSource(moduleName);
});
// Lua 侧自行 require('main')
```

确保 `RuntimeInitializeOnLoadMethod` 或场景入口调用 `Initialize` 一次。

### 步骤 2：类型路径（二选一）

#### 2A. 使用 xlua adaptor（减改写，推荐过渡）

包内：`ZLua~/adaptors/xlua/`（`adaptor.lua` + `ExportTypes.cs`）。契约见 [规范 12](/docs/spec/12-MIGRATION-ADAPTORS/)。

1. 在 **仍含 xLua** 的工程复制 `ExportTypes.cs` → Editor，菜单 **`ZLua/ExportTypes`**
2. 生成物按 `[LuaCallCSharp]` / 既有 Gen 白名单写出 `xlua_export_types.lua`（**不**扫全程序集）
3. 将 `xlua_export_types.lua` 与 `adaptor.lua` 放入 ZLua 工程可 `require` 的 Lua 目录
4. 在 `Initialize` 之后、业务脚本之前：

```lua
local export_types = require "xlua_export_types"
local adaptor = require "adaptor"
adaptor.init(export_types)
-- 此后 CS.UnityEngine.GameObject 等仍可用（清单内）
```

**仍须手改：** `GetFunction`、Event、`ref`/Opaque、以及 `List(Int32)` 式泛型构造 → `zlua.make_generic_type`。

#### 2B. 改写为原生 `CSharp`（长期收口）

**Before：**

```lua
local GameObject = CS.UnityEngine.GameObject
local Demo = CS.MyGame.Demo
local list = CS.System.Collections.Generic.List(CS.System.Int32)()
```

**After：**

```lua
local GameObject = CSharp['UnityEngine.CoreModule']['UnityEngine.GameObject']
-- 或若类型在 Assembly-CSharp：
local Demo = CSharp['Assembly-CSharp']['MyGame.Demo']

local ListDef = CSharp.mscorlib['System.Collections.Generic.List`1']
local List_int = zlua.make_generic_type(ListDef, zlua.types.int32)
local list = List_int()
```

**别名（可选）：**

```lua
CSharp.AC = CSharp['Assembly-CSharp']
local Demo = CSharp.AC['MyGame.Demo']
```

### 步骤 3：删除 Generate 管线

1. 移除 `XLuaGenConfig`、`[LuaCallCSharp]`、`[CSharpCallLua]`、`[ReflectionUse]` 等 Generate 输入。
2. 删除 `Assets/XLua/Gen/` 等生成 Wrap（或整个 xLua 包）。
3. **访问控制：** 不应再依赖白名单；不想暴露给 Lua 的 API 改为 `internal` / `private`。

### 步骤 4：C# 调 Lua

**Before：**

```csharp
[LuaCallCSharp]
public class LuaBridge {
    public static Action<float> onTick;
}
// 或 luaEnv.Global.Get<Action<float>>("onTick")
```

**After：**

```csharp
static readonly Action<float> OnTick =
    LuaAppDomain.GetFunction<Action<float>>("game", "OnTick");

void Update() => OnTick(Time.deltaTime);
```

Lua 模块 `game.lua` 须 **return table** 且含全局函数名 `OnTick`（与 `GetFunction` 的 method 参数一致）。

### 步骤 5：Lua function → C# delegate（含「把函数拿回 C#」）

ZLua **支持** C# 持有并多次调用 Lua 函数，不要误以为只能「单向 `GetFunction` 调一次」。

#### A. Lua 作为 C# 方法参数（隐式 marshal）

**Before：**

```csharp
luaEnv.Global.Get<LuaFunction>("callback"):Call(1);
// 或 CSharpCallLua 生成 delegate
```

**After：**

```csharp
// C# 方法接收 delegate，Lua 传 function 即可
public static void Register(Action<int> cb) { ... }
```

```lua
obj:Register(function(x) print(x) end)
```

#### B. `GetFunction` 按名取 delegate（替代 `Get<Action>` / `LuaFunction`）

**Before（xLua）：**

```csharp
Action<float> onTick = luaEnv.Global.Get<Action<float>>("OnTick");
onTick(dt);
```

**After：**

```csharp
static readonly Action<float> onTick =
    LuaAppDomain.GetFunction<Action<float>>("game", "OnTick");
onTick(dt);
```

```lua
-- game.lua
local function OnTick(dt) print(dt) end
return { OnTick = OnTick }
```

任意签名只要换成对应的 `T` 即可。Lua 侧已有 function、需显式指定类型时用 `zlua.to_delegate`（见 [Function 与 Delegate](/docs/guides/functions/)）。

详见 [spec/marshal/09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/)、[Function 与 Delegate](/docs/guides/functions/)。

### 步骤 6：Event

**Before（xLua）：**

```lua
obj.SomeEvent = function() end
-- 或 += 风格（视版本）
```

**After：**

```lua
obj:add_SomeEvent(function() end)
obj:remove_SomeEvent(handler)
```

### 步骤 7：struct / ref / out

**Before：**

```lua
local ok, outVal = cs_obj:TryParse(s)
```

**After（Lua→C# ref / out）：**

```lua
-- struct ref/out：Type(...) 构造 StructUserData
local outPoint = Point2D()
local ok = obj:TryGetPoint(outPoint)

-- 基元 ref：裸值走拷贝语义（C# 内可变，Lua local 不变）
local x = 0
obj:Increment(x)   -- x 仍为 0
```

**C#→Lua `ref`（Opaque，易踩坑）：**

```lua
-- C# GetFunction 取得的 delegate 上 void Foo(ref int x) 推到 Lua 的不是 number
local h = ... -- OpaqueValue from invoke
local v = zlua.get_opaquevalue(h, zlua.types.int32)
zlua.set_opaquevalue(h, v + 1)
-- 勿跨 pcall 保存 h
```

### 步骤 8：测试与 Player 验证

- 按 [TESTING.md](/docs/community/testing/) 添加 `tc_*.lua`
- **Il2Cpp Player** 跑全量 manifest（xLua 与 ZLua 双端行为须分别验证）

---

## 3. 常见坑

| 坑 | 说明 | 处理 |
|----|------|------|
| `CSharp.AC.MyGame.Demo` | `.` 被解析为多级表 | 改用 `CSharp.AC['MyGame.Demo']` |
| 嵌套类型 `Outer.Inner` | 错误键 | 用 `Outer+Inner` |
| 以为 Generate 白名单仍有效 | ZLua 无 LuaCall 列表 | 用可见性控制 API |
| `ref` 当 integer | C#→Lua Opaque | `zlua.get_opaquevalue` |
| Opaque 跨帧 | 规范禁止 | 仅在单次 C#→Lua 调用内使用 |
| 继承成员找不到 | Bind 期扁平化 | 确认成员在声明类型 public API 中 |
| `__index` 无成员不报错 | ZLua 返回 **nil** | 勿依赖 xLua 式 error |
| Editor 某 API 为 nil | 类型未绑定 / 非 public / 用法错误 | 查 [spec](/docs/spec/00-OVERVIEW/) 与 [impl/MONO.md](/docs/impl/MONO/) |
| 性能预期 | xLua 与 ZLua 架构不同 | 见 [compare/PERFORMANCE.md](/docs/compare/PERFORMANCE/) |
| libil2cpp merge | Unity 升级成本 | 评估工程债后再迁 |

---

## 4. 错误信息对照（典型）

| xLua 现象 | ZLua 可能表现 |
|-----------|---------------|
| `cannot find wrapper` | 类型未加载 / 非 public / 拼写错误 → `nil` 或 load 异常 |
| `invalid lua stack` | marshal 类型不匹配 → Lua error 带 ZLua 前缀 |
| Generate 遗漏类型 | xLua 编译期即缺 Wrap | ZLua 首次访问时 Bind；Il2Cpp 缺 stub 则 Codegen 期应已覆盖 |

---

## 5. Before / After 完整小脚本

### 5.1 游戏入口

**Before（xLua）：**

```lua
-- main.lua
local CS = CS
local Demo = CS.MyGame.Demo

function start()
    local d = Demo()
    d.Name = "test"
    print(d:GetName())
end

start()
```

**After（ZLua）：**

```lua
-- main.lua
local Demo = CSharp['Assembly-CSharp']['MyGame.Demo']

local function start()
    local d = Demo()
    d.Name = "test"
    print(d:GetName())
end

start()
```

### 5.2 重载

**Before：**

```lua
obj:Foo(1)      -- xLua Generate 已分派
obj:Foo("a")
```

**After：**

```lua
obj:Foo(1)      -- 默认最佳匹配，多数情况可直接用
obj:Foo("a")

-- 歧义时：全签名键（Bind 自动，无需 API）
obj['Foo(System.Int32)'](obj, 1)
obj['Foo(System.String)'](obj, "a")

-- 或 Bind 期 [LuaAlias] 短名
obj:foo_str("a")

-- 或 register_method 挂自定义短名后冒号调用
local foo_i32 = obj['Foo(System.Int32)']
zlua.register_method("foo_i32", foo_i32)
obj:foo_i32(1)
```

### 5.3 C# 主循环调 Lua

**Before：**

```csharp
void Update() {
    luaEnv.Global.Get<Action<float>>("update")(Time.deltaTime);
}
```

**After：**

```csharp
static readonly Action<float> LuaUpdate =
    LuaAppDomain.GetFunction<Action<float>>("game", "update");

void Update() => LuaUpdate(Time.deltaTime);
```

---

## 6. 迁移时间线建议

| 阶段 | 工作 |
|------|------|
| W1 | 初始化；**xlua adaptor** 或 `CSharp` 路径工具；删 xLua 包 |
| W2 | 核心 gameplay（delegate / GetFunction）；逐步收口 `CS.*` |
| W3 | struct/ref/Event 专项 + `Tests/Lua` |
| W4 | Il2Cpp Player 全量回归 + 性能 profiling；可选卸掉 adaptor |

---

## 相关文档

| 文档 | 内容 |
|------|------|
| [migration/](/docs/guides/migration/) | 共用清单与适配层总览 |
| [spec/12-MIGRATION-ADAPTORS.md](/docs/spec/12-MIGRATION-ADAPTORS/) | xlua adaptor 契约 |
| [spec/02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) | 类型语法 |
| [spec/01-HOST-API.md](/docs/spec/01-HOST-API/) | GetFunction |
