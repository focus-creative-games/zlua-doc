---
sidebar_position: 2
title: "从 toLua 迁移"
---

# 从 toLua（tolua#）迁移到 ZLua

> **特性背景：** [compare/FEATURES.md](/docs/compare/FEATURES/)  
> toLua / tolua# 以 **预生成 Wrap**、**LuaState**、全局导出类为特征；ZLua 以 **懒绑定**、**CSharp 根表**、**Il2Cpp 内嵌桥** 为特征。  
> **类型路径适配（可选）：** [规范 12 · tolua adaptor](/docs/spec/12-MIGRATION-ADAPTORS/) · [迁移索引](/docs/guides/migration/)

---

## 1. 概念对照

| toLua / tolua# | ZLua |
|----------------|------|
| `LuaState` / `ToLua` | `LuaAppDomain` |
| `*.Wrap.cs` 导出类 | **无 Wrap**；`EnsureBinding` 写三表 |
| `CustomSettings.cs` 导出列表 | **无**访问控制白名单；public 懒 Bind（适配清单仅迁移期） |
| 全局 / 命名空间 `UnityEngine.GameObject` | 原生：`CSharp[asm][full]`；**或** adaptor 挂 `_G.UnityEngine.GameObject` |
| `LuaFunction` / `LuaTable` | `GetFunction`、形参隐式 marshal、`require` 模块 table（**适配不覆盖**） |
| `ToLua.Push` / 手动绑定 | 自动 marshal（spec/marshal） |
| `out` 多返回值 | StructUserData（`Type(...)`）/ 拷贝语义（视签名） |
| Binder 注册 | `CSharp` 懒加载 + Codegen（Il2Cpp） |

---

## 2. 逐步迁移

### 步骤 1：移除 toLua 生成物

1. 删除 `Source/Generate/` 或工程中全部 `*Wrap.cs`、`*Binder.cs`。
2. 移除 toLua `#if` 宏、`LuaClient`、`LuaState` 单例。
3. 卸载 tolua# 插件 dll（若有独立 native）。

### 步骤 2：初始化

**Before（tolua#）：**

```csharp
LuaState lua = new LuaState();
lua.Start();
LuaBinder.Bind(lua);
lua.DoFile("Main.lua");
```

**After（ZLua）：**

```csharp
LuaAppDomain.Initialize(LoadModule);
// bootstrap + require 由 ZLua 与宿主 loader 负责
```

### 步骤 3：类型与调用（二选一）

#### 3A. 使用 tolua adaptor（减改写，推荐过渡）

包内：`ZLua~/adaptors/tolua/ExportTypes.cs` + 共用 `ZLua~/adaptors/adaptor.lua`。契约见 [规范 12](/docs/spec/12-MIGRATION-ADAPTORS/)。

1. 在 **仍含 toLua** 的工程复制 `ExportTypes.cs` → Editor，菜单 **`ZLua/ExportTypes`**
2. 按 `CustomSettings.customTypeList` 生成 `tolua_export_types.lua`（`export_name` 为 `UnityEngine.GameObject` 这类命名空间路径）
3. 将清单与 **`adaptor.lua`** 放入 ZLua 工程可 `require` 的目录
4. 入口：

```lua
local export_types = require "tolua_export_types"
local adaptor = require "adaptor"
adaptor.init(export_types)
-- 此后 UnityEngine.GameObject 等可用（清单内；冲突会 fail-fast）
```

**注意：** 与运行时 `BeginModule` 一致，默认挂 **命名空间链**，不是「仅全局短名」。`SetNameSpace(null)` / `SetLibName` 会反映到 `export_name`。成员调用等仍按 ZLua 语义。

#### 3B. 改写为原生 `CSharp`

toLua 习惯 **扁平全局**；ZLua 原生要求 **程序集 + 全名**。

**Before：**

```lua
local go = GameObject.Find("Player")
local demo = Demo.New()
demo:SetValue(10)
local x = demo.x
```

**After：**

```lua
local GameObject = CSharp['UnityEngine.CoreModule']['UnityEngine.GameObject']
local Demo = CSharp['Assembly-CSharp']['Demo']

local go = GameObject.Find("Player")
local demo = Demo()           -- 构造：Type()，非 Demo.New()（除非静态方法名如此）
demo:SetValue(10)
local x = demo.x
```

**注意：** toLua 的 `Type.New()` 在 ZLua 中一般为 **`Type()`**（类型表 `__call` → 构造）。若 C# 仅有静态工厂，仍用 `Demo.New()`。

### 步骤 4：自定义 Loader

**Before：** `LuaState.AddSearchPath` / 自定义 `LuaFileUtils`

**After：** `LuaAppDomain.Initialize(moduleLoader)` 统一解析：

```csharp
Func<string, object> loader = module =>
{
    var path = Path.Combine(projectRoot, "Lua", module.Replace('.', '/') + ".lua");
    return File.ReadAllText(path);
};
```

Player 路径规则见 [TESTING.md](/docs/community/testing/) §5。

### 步骤 5：C# 调 Lua

**Before：**

```csharp
LuaFunction func = lua.GetFunction("Update");
func.Call(Time.deltaTime);
func.Dispose();
```

**After：**

```csharp
static readonly Action<float> LuaUpdate =
    LuaAppDomain.GetFunction<Action<float>>("game", "Update");
```

### 步骤 6：Delegate 与 tolua 事件

toLua 项目常用 **LuaFunction.ToDelegate** / 长期持有 `LuaFunction`：

**Before：**

```csharp
LuaFunction lf = lua.GetFunction("onClick");
Button.onClick.AddListener(lf.ToDelegate<Action>());
```

**After（推荐：Lua 传 function 给 C#）：**

```csharp
public static void SetClickHandler(Action cb) { button.onClick.AddListener(() => cb()); }
```

```lua
ui:SetClickHandler(function() print("click") end)
```

**After（C# 主动取回 Lua 函数再调）：** 使用 `GetFunction<Action>`/`GetFunction<Func<…>>`，或 `GetFunction<Delegate>` + `zlua.to_delegate`。见 [Function 与 Delegate](/docs/guides/functions/)、[from-xlua 步骤 5](/docs/guides/migration/from-xlua/)。

```csharp
static readonly Func<Action> GetOnClick =
    LuaAppDomain.GetFunction<Func<Action>>("ui", "get_on_click");

button.onClick.AddListener(GetOnClick());
```
### 步骤 7：值类型与 out

toLua 常用 **多返回值 out**：

**Before：**

```lua
local ok, result = luaObj:TryParse(str)
```

**After：**

```lua
-- struct out：Type(...) 构造 StructUserData
local outPoint = Point2D()
local ok = obj:TryGetPoint(outPoint)

-- 基元 out：裸实参走拷贝/default 分支；须 observable 写回时用 struct 形参或 C# 多返回值
```

struct 默认 **ByVal userdata**；`ref`/`out` observable 写回须 `Type(...)` StructUserData；boxed 场景用 `zlua.box`。

### 步骤 8：Unity 引擎 API

toLua 预导出大量 `UnityEngine.*` Wrap。迁移时：

1. 按 **实际使用** 改 `CSharp[assembly][typeFullName]`（程序集名查 `.asmdef` / Inspector）。
2. 不必一次性改完全部引擎 API；按模块迁移。
3. Il2Cpp Player 需程序集在 Codegen 输入内。

---

## 3. 常见坑

| 坑 | 说明 |
|----|------|
| 依赖全局类名 | `Demo` 未定义 → **tolua adaptor**（`Namespace.Demo`）、`CSharp[...]['Demo']` 或局部 alias |
| `Demo.New()` vs `Demo()` | ZLua 构造优先 `Type()` |
| Wrap 删除后链接错误 | C# 侧仍引用 `LuaInterface` 类型 → 一并删 |
| tolua `#if UNITY_EDITOR` 双份逻辑 | 合并为 ZLua 双端同一套 Lua |
| 导出列表当安全边界 | 改 **非 public** API |
| `LuaTable` 强依赖 | 改用 Lua module return table + `require` |
| 性能假设 | toLua 与 xLua 类似经 Wrap；ZLua Player 路径不同，见 [compare/PERFORMANCE.md](/docs/compare/PERFORMANCE/) |

---

## 4. Before / After 示例

### 4.1 模块组织

**Before（toLua + 全局）：**

```lua
-- Main.lua
UpdateBeat = UpdateBeat or {}
function UpdateBeat.OnUpdate(dt)
    -- ...
end
```

**After（ZLua 模块）：**

```lua
-- game.lua
local M = {}

function M.OnUpdate(dt)
    -- ...
end

return M
```

```csharp
```csharp
static readonly Action<float> OnUpdate =
    LuaAppDomain.GetFunction<Action<float>>("game", "OnUpdate");
```

### 4.2 数组

**Before：**

```lua
local arr = System.Array.CreateInstance(typeof(int), 10)
```

**After：**

```lua
local arr = zlua.new_szarray_by_element_type(zlua.types.int32, 10)
-- 或
local intArrType = zlua.make_szarray_type(zlua.types.int32)
local arr2 = zlua.new_szarray_by_szarray_type(intArrType, 10)
```

### 4.3 清理 Wrap 引用（C#）

**Before：**

```csharp
DemoWrap.Register(L);
```

**After：** 删除；首次 `CSharp[...]['Demo']` 访问时自动 Bind。

---

## 5. CustomSettings 迁移对照

| toLua CustomSettings | ZLua |
|----------------------|------|
| `customTypeList` | 删除；按需 `internal` 隐藏 |
| `staticClassList` | 不需要；静态成员在类型表 |
| `dynamicList` | 不需要 |
| `outList` | 遵循 C# 签名 + marshal spec |
| `sealedList` | 无对应；继承规则见 type system |

---

## 6. 验收

- [ ] 无 `LuaInterface` / `ToLua` / `*Wrap` 残留
- [ ] `Tests/Lua` 覆盖原 toLua 关键 API
- [ ] Editor + Il2Cpp Player manifest 全绿
- [ ] 移除 toLua 后包体与启动无 lib 冲突
- [ ] （若用 adaptor）`tolua_export_types` + `adaptor.init` 后 `UnityEngine.GameObject` 等命名空间路径可用；冲突/缺失类型有明确 error

---

## 相关文档

| 文档 | 内容 |
|------|------|
| [migration/](/docs/guides/migration/) | 共用清单与适配层总览 |
| [spec/12-MIGRATION-ADAPTORS.md](/docs/spec/12-MIGRATION-ADAPTORS/) | tolua adaptor 契约 |
| [from-xlua.md](/docs/guides/migration/from-xlua/) | xLua 对照（C#→Lua 更详） |
| [spec/05-LIB.md](/docs/spec/05-LIB/) | `zlua.*` API |
| [TESTING.md](/docs/community/testing/) | 回归测试 |
