---
sidebar_position: 3
title: "从 xLua 迁移"
---

# 从 xLua 迁移到 ZLua

> **特性背景：** [compare/FEATURES.md](../../compare/FEATURES)  
> **性能/GC：** [compare/PERFORMANCE.md](../../compare/PERFORMANCE)、[compare/GC.md](../../compare/GC)

---

## 1. 概念对照

| xLua | ZLua |
|------|------|
| `CS.Namespace.Type` | `CSharp[assembly]['Namespace.Type']`（含 namespace **必须括号**） |
| `LuaEnv` | `LuaAppDomain` + `moduleLoader` |
| `luaEnv:DoString` / `require` | 同 `require`；loader 由宿主提供 |
| `[LuaCallCSharp]` + Generate | **无**；public 类型 **懒 Bind** |
| `[CSharpCallLua]` | `[LuaInvoke("module","func")]` static extern |
| `LuaFunction` / `xlua.tofunction` | `[LuaInvoke]` 直接调，或 **返回** `Action`/`Func`/`Delegate`（见 [回调 §3](../../guides/callbacks-and-delegates)） |
| `ObjectTranslator` | `ObjectRegistry` + marshal 分册 |
| xLua Event 语法 | **无**；`add_Xxx` / `remove_Xxx` |
| `CS.System.Collections.Generic.List(CS.System.Int32)` | `zlua.make_generic_type(...)` |
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

### 步骤 2：改写类型路径

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
[LuaInvoke("game", "OnTick")]
public static extern void OnTick(float dt);
```

Lua 模块 `game.lua` 须 **return table** 且含全局函数名 `OnTick`（与 `[LuaInvoke]` 第二参数一致）。

### 步骤 5：Lua function → C# delegate（含「把函数拿回 C#」）

ZLua **支持** C# 持有并多次调用 Lua 函数，不要误以为只能「单向 `[LuaInvoke]` 调一次」。

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

#### B. `[LuaInvoke]` **返回** delegate（替代 `Get<Action>` / `LuaFunction`）

**Before（xLua）：**

```csharp
Action<float> onTick = luaEnv.Global.Get<Action<float>>("OnTick");
onTick(dt);
```

**After（固定签名）：**

```csharp
[LuaInvoke("game", "get_on_tick")]
private static extern Action<float> GetOnTick();

var onTick = GetOnTick();
onTick(dt);
```

```lua
-- game.lua
local function get_on_tick()
    return function(dt) print(dt) end
end
return { get_on_tick = get_on_tick }
```

**After（动态按名 + 任意委托类型）：** 返回 `System.Delegate`，参数带 `module` / `method` / `Type`，Lua 内 `zlua.to_delegate(fn, type)`。完整写法见指南 [回调与 Delegate §3](../../guides/callbacks-and-delegates)。

```csharp
[LuaInvoke("bridge", "resolve_delegate")]
private static extern Delegate ResolveDelegate(string module, string method, Type delegateType);

Action<float> onTick = (Action<float>)ResolveDelegate("game", "OnTick", typeof(Action<float>));
```

详见 [spec/marshal/09-FUNCTION.md](../../spec/marshal/09-FUNCTION)、[回调与 Delegate](../../guides/callbacks-and-delegates)。

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
-- C# [LuaInvoke] void Foo(ref int x) 推到 Lua 的不是 number
local h = ... -- OpaqueValue from invoke
local v = zlua.get_opaquevalue(h, zlua.types.int32)
zlua.set_opaquevalue(h, v + 1)
-- 勿跨 pcall 保存 h
```

### 步骤 8：测试与 Player 验证

- 按 [TESTING.md](../testing) 添加 `tc_*.lua`
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
| Editor 某 API 为 nil | 类型未绑定 / 非 public / 用法错误 | 查 [spec](../../spec/00-OVERVIEW) 与 [impl/MONO.md](../../impl/MONO) |
| 性能预期 | xLua 与 ZLua 架构不同 | 见 [compare/PERFORMANCE.md](../../compare/PERFORMANCE) |
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

-- 歧义时：Bind 期 [LuaAlias] 或本地缓存 direct closure
obj:foo_str("a")   -- 例：[LuaAlias("foo_str")] 单候选

-- 或运行时注册新名（须尚未占用）
local fooStr = obj.foo_str
zlua.register_method("foo_str_hot", fooStr)
fooStr(obj, "a")
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
[LuaInvoke("game", "update")]
static extern void LuaUpdate(float dt);

void Update() => LuaUpdate(Time.deltaTime);
```

---

## 6. 迁移时间线建议

| 阶段 | 工作 |
|------|------|
| W1 | 初始化、`CSharp` 路径工具函数、删 xLua 包 |
| W2 | 核心 gameplay Lua 改路径 + delegate |
| W3 | struct/ref/Event 专项 + `Tests/Lua` |
| W4 | Il2Cpp Player 全量回归 + 性能 profiling |

---

## 相关文档

| 文档 | 内容 |
|------|------|
| [migration/README.md](./) | 共用清单 |
| [spec/02-TYPE-SYSTEM.md](../../spec/02-TYPE-SYSTEM) | 类型语法 |
| [spec/01-HOST-API.md](../../spec/01-HOST-API) | LuaInvoke |
