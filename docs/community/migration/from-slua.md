---
sidebar_position: 1
title: "从 SLua 迁移"
---

# 从 SLua 迁移到 ZLua

> **特性背景：** [compare/FEATURES.md](../../compare/FEATURES)  
> SLua 与 toLua 类似，强调 **导出配置 / 自动绑定**、`LuaSvr`；迁移路径与 toLua 高度重叠，本文突出 SLua 特有项。

---

## 1. 概念对照

| SLua | ZLua |
|------|------|
| `LuaSvr` / `LuaSvrGameObject` | `LuaAppDomain.Initialize` |
| `LuaState` | 内置于 ZLua 宿主；不直接暴露 |
| `[CustomLuaClass]` / 导出 XML | **无**；public 懒 Bind |
| `LuaFunction` / `LuaTable` | `[LuaInvoke]`、**返回 delegate**、形参隐式 marshal、`require` 模块 |
| `SLua.LuaObject` 绑定 | ObjectRegistry + marshal |
| 自动导出 `UnityEngine.*` | `CSharp[assembly][fullName]` 按需访问 |
| 值类型 GC 优化（版本相关） | ByVal / Opaque / ObjectRegistry（见 [compare/GC.md](../../compare/GC)） |

---

## 2. 逐步迁移

### 步骤 1：移除 SLua 运行时与生成代码

1. 删除 SLua 插件目录、`Slua` namespace 引用。
2. 删除自动生成的 `Assets/Slua/` 或 `Generated/` 绑定代码。
3. 移除场景上 `LuaSvr` / `LuaSvrMain` 等组件。

### 步骤 2：初始化对照

**Before（SLua）：**

```csharp
LuaSvr.mainState.doString("require 'Main'");
// 或 LuaSvrGameObject 启动
```

**After（ZLua）：**

```csharp
LuaAppDomain.Initialize(moduleLoader);
// Lua: require 'Main'
```

在 `RuntimeInitializeOnLoadMethod` 或游戏入口调用一次。

### 步骤 3：类型访问

SLua 常直接使用 **命名空间链**：

**Before：**

```lua
local GameObject = UnityEngine.GameObject
local obj = GameObject.Find("Root")
local list = System.Collections.Generic.List_int()()  -- 视 SLua 导出命名
```

**After：**

```lua
local GameObject = CSharp['UnityEngine.CoreModule']['UnityEngine.GameObject']
local obj = GameObject.Find("Root")

local ListDef = CSharp.mscorlib['System.Collections.Generic.List`1']
local List_int = zlua.make_generic_type(ListDef, zlua.types.int32)
local list = List_int()
```

### 步骤 4：SLua 导出配置 → 可见性

**Before：** `CustomExport.cs`、`[CustomLuaClass]`、静态导出列表

**After：**

- 删除导出配置。
- 不允许 Lua 访问的 API → `internal` / `private`。
- **注意：** 无白名单后 Il2Cpp **仍链接** public 元数据；敏感面靠 C# 可见性，非 SLua 式导出裁剪。

### 步骤 5：LuaFunction 与委托

**Before：**

```csharp
LuaFunction laf = (LuaFunction)lua["callback"];
laf.call(1, 2);
```

或 SLua 的 `LuaDelegation` 生成。

**After：**

```csharp
[LuaInvoke("mod", "callback")]
static extern void InvokeCallback(int a, int b);

// 或 Lua function 作参数
public static void SetHandler(Action<int,int> h) { ... }

// 或把 Lua 函数拿回 C#（替代长期持有 LuaFunction）
[LuaInvoke("mod", "get_callback")]
static extern Action<int,int> GetCallback();
```

```lua
mod.SetHandler(function(a,b) end)

-- get_callback 返回 function，由返回值编组为 Action
local function get_callback()
    return function(a, b) print(a, b) end
end
```

动态按名 / 任意委托类型：见 [回调与 Delegate §3](../../guides/callbacks-and-delegates)。
### 步骤 6：SLua 特有 API 替换

| SLua | ZLua |
|------|------|
| `LuaVar` / `LuaArray` | 原生 Lua table 或 C# 数组 marshal |
| `checkVar` / 手动类型检查 | marshal 错误由 ZLua 抛 |
| `Slua.CreateClass` | **无**；用 C# 类型 + 构造 |
| `LuaSvr.doUpdate` | C# `Update` 内 `[LuaInvoke]` |

### 步骤 7：值类型

SLua 部分版本对 Vector3 等有优化；ZLua 侧：

```lua
-- Unity Vector3 经程序集类型表
local Vector3 = CSharp['UnityEngine.CoreModule']['UnityEngine.Vector3']
local v = Vector3(1, 2, 3)
-- struct ByVal；见 tc_marshal_unity_vector
```

`ref` / `out` / C#→Lua Opaque 规则同 [from-xlua.md](./from-xlua) §步骤 7。

### 步骤 8：测试

- 将原 SLua 关键用例迁入 `Tests/Lua/cases/`
- [TESTING.md](../testing) 双端跑 manifest

---

## 3. 常见坑

| 坑 | 说明 |
|----|------|
| `UnityEngine.X` 全局不存在 | 必须 `CSharp[assembly]['UnityEngine.X']` |
| 依赖 SLua 自动导出顺序 | ZLua 懒 Bind，无顺序依赖 |
| `[CustomLuaClass]` 子类导出 | 改 public 继承 + 正常类型访问 |
| `LuaSvr` 多状态 | ZLua 默认 **单主** `lua_State` |
| 热更 DLL + SLua | 需重建 ZLua Codegen / 程序集加载策略 |
| Editor 与 Player 差异 | SLua 较一致；ZLua **必须** 验 Player |
| 以为「无导出 = 无包体成本」 | 见 [compare/BRIDGE.md](../../compare/BRIDGE) 裁剪节 |

---

## 4. Before / After 示例

### 4.1 组件脚本（Lua 调 Unity）

**Before（SLua）：**

```lua
function OnEnable()
    self.transform = self.gameObject.transform
    self.timer = 0
end

function Update()
    self.timer = self.timer + UnityEngine.Time.deltaTime
end
```

**After（ZLua）：**

```lua
local Time = CSharp['UnityEngine.CoreModule']['UnityEngine.Time']

function OnEnable()
    self.transform = self.gameObject.transform
    self.timer = 0
end

function Update()
    self.timer = self.timer + Time.deltaTime
end
```

（MonoBehaviour 脚本若仍由 SLua 驱动，须先改为 ZLua 宿主 + 模块加载；具体宿主集成因项目而异。）

### 4.2 静态工具类

**Before：**

```lua
local util = Slua.CreateClass("MyUtil")
function util.foo() return 1 end
```

**After：** 在 C# 定义 `public static class MyUtil`，Lua：

```lua
local MyUtil = CSharp['Assembly-CSharp']['MyUtil']
MyUtil.Foo()
```

### 4.3 事件（无 SLua/xLua 语法糖）

**Before（若用 SLua 委托绑定）：**

```csharp
// SLua 生成或手动 Bind
```

**After：**

```lua
obj:add_Click(function() end)
obj:remove_Click(fn)
```

---

## 5. API 逐项对照（速查）

| 能力 | SLua | ZLua |
|------|------|------|
| 启动 VM | `LuaSvr.init` | `LuaAppDomain.Initialize` |
| 执行文件 | `doFile` | `require` + loader |
| 调 C# 静态 | 导出类 | `CSharp[asm][type].Method` |
| 调 C# 实例 | `:` | `:`（同 Lua 语义） |
| C# 调 Lua | `LuaFunction` | `[LuaInvoke]` |
| 创建 delegate | SLua 生成 / `LuaFunction` | 形参隐式 marshal，或 `[LuaInvoke]` **返回** delegate / `to_delegate` |
| 泛型 List | 导出闭合类型 | `zlua.make_generic_type` |
| 数组 | 导出 | `zlua.make_szarray_type` / `new_*array*` |
| 反射 | SLua 部分支持 | `zlua.typeof` / `CSharp` 懒 Bind |

---

## 6. 与 toLua 迁移文档的关系

| 主题 | 参考 |
|------|------|
| 删 Wrap、全局类 | [from-tolua.md](./from-tolua) |
| `[LuaInvoke]`、Opaque | [from-xlua.md](./from-xlua) |
| 性能/GC | [compare/](../../compare/) |

---

## 7. 验收清单

- [ ] 无 `Slua` / `LuaSvr` 引用
- [ ] 无 SLua 生成绑定目录
- [ ] Lua 脚本无隐式全局 `UnityEngine` / `System`（除非 bootstrap 刻意 alias）
- [ ] Il2Cpp Player 全量测试通过
- [ ] 性能 profiling（若 SLua 迁因性能）见 P1–P6

---

## 相关文档

| 文档 | 内容 |
|------|------|
| [migration/README.md](./) | 共用迁移清单 |
| [spec/02-TYPE-SYSTEM.md](../../spec/02-TYPE-SYSTEM) | 类型命名 |
| [compare/GC.md](../../compare/GC) | GC 边界 |
