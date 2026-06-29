---
sidebar_position: 7
title: ZLua 与 xLua 全面对比报告
description: 基于 xLua Examples/Doc 与 ZLua 文档的全面对比，含用法逐项对照与 GC、Wrapper 证据。
---

# ZLua 与 xLua 全面对比报告

本文档面向技术选型与架构评审，系统对比 **ZLua** 与 **xLua**（Tencent，Unity Il2Cpp 常用方案）。结论侧重 ZLua 在 **设计易用性、交互开销、交互 GC、Wrapper 体积** 上的优势；xLua 在 **热更、签名校验、生产成熟度** 等项仍领先，文末单列。

**证据来源**

| 侧 | 路径 / 链接 |
|----|-------------|
| xLua Examples | `3rd/xLua/Assets/XLua/Examples/`（01–13） |
| xLua Tutorial | `Assets/XLua/Tutorial/` |
| xLua 文档 | `Assets/XLua/Doc/`（configure.md、XLua教程.md、struct GC 指南、faq.md） |
| ZLua | [zlua-demo](https://github.com/focus-creative-games/zlua-demo)、[doc.zlua.cn](https://doc.zlua.cn) |

**读前须知**

- 性能倍数为 **路径级理论推演**，见 [ZLua 与 xLua 技术架构对比](./comparison-with-xlua)；Il2Cpp Player 以 [项目状态](../getting-started/project-status) 为准。
- 下表「配置」指 xLua 的 `LuaCallCSharp` / `CSharpCallLua` / `GCOptimize` / `Generate Code` 等；ZLua **无等价白名单**（public 类型懒绑定）。

---

## 1. 执行摘要

| 维度 | xLua 典型模式 | ZLua | ZLua 显著优势？ |
|------|---------------|------|-----------------|
| 设计与易用性 | `LuaEnv` + 白名单 + `CS.*` + `Get<T>` | `Initialize` + `[LuaInvoke]` + `CSharp.*` | **是** |
| 交互开销 | libxlua + C# Wrap + 多次 LuaDLL | C++ MethodBridge + IC + offset（目标） | **是**（Player 热路径） |
| 交互 GC | 默认 boxing；无 GC 需 GCOptimize 三件套 | Opaque / 栈展开 / StructUserData 多路径 | **是** |
| Wrapper | 每类型海量 C# Wrap + CI GenAll | 懒绑定 + 签名复用 C++ 桥 | **是** |

---

## 2. 基于 xLua Examples 的架构对照

### 2.1 Examples 索引与 ZLua 映射

| # | xLua Example | 演示内容 | xLua 隐含成本 | ZLua 对照 |
|---|--------------|----------|---------------|-----------|
| 01 | Helloworld | `LuaEnv.DoString` | 每场景创建 env | `LuaAppDomain.Initialize` 一次 |
| 02 | U3DScripting | MonoBehaviour 驱动 Lua | ~100 行 C# + Tick + GenConfig | `[LuaInvoke]` + module |
| 03 | UIEvent | Button `AddListener` | 类型进 LuaCallCSharp | `CSharp.*` 懒加载 |
| 04 | InvokeLua | C# interface ← Lua table | 50+ 行 Lua metatable + CSharpCallLua | `[LuaInvoke]` + `return { }` |
| 05 | NoGc | 零 GC 热路径 | GCOptimize + 7 delegate 配置 | `[LuaMarshalAs]` / 默认路径 |
| 06 | Coroutine | `cs_coroutine` | 单独 LuaCallCSharp 列表 | 路线图 |
| 07 | AsyncTest | `async_to_sync` + MessageBox | MessageBoxConfig | `function` 作 Action 形参 |
| 08 | Hotfix | `xlua.hotfix` | 宏 + Generate + Inject | **ZLua 无** |
| 09 | GenericMethod | 泛型方法 + Extension 绕过 | 6 类 `[LuaCallCSharp]` | `zlua.make_generic_*` |
| 10 | SignatureLoader | RSA 验签 loader | 内置 | 需自建 |
| 11 | RawObject | `CS.XLua.Cast.Int32` | 精度控制 API | `[LuaMarshalAs]` |
| 12 | ReImplementInLua | `genaccessor` 改 Vector3 | 必须 Generate + Lua hack | ComposeFromStack 内置 |
| 13 | BuildFromCLI | **`Generator.GenAll()` 再 Build** | CI 硬依赖 Generate | 无 Gen 目录 |

### 2.2 Example 02 — 生产模式样板（核心证据）

**xLua `LuaBehaviour.cs` 负担：** 共享 `LuaEnv`、`NewTable` 脚本环境、`Get<Action>` 绑定生命周期、**每帧 `Tick()`**；`GameObject`/`Light`/`Vector3` 等均在 `ExampleGenConfig` 的 `LuaCallCSharp` 中。

**ZLua `Bootstrap.cs`：** `Initialize(LoadLuaModule)` + `[LuaInvoke("app","main")]`，无 Tick、无 Get、无类型列表。

### 2.3 Example 13 — Wrapper / CI 铁证

```csharp
// 13_BuildFromCLI/Editor/BuildFromCLI.cs
Generator.ClearAll();
Generator.GenAll();
BuildPipeline.BuildPlayer(...);
```

FAQ 与 GUI 文案一致：Il2Cpp 发布前须 **XLua/Generate Code**，否则 `attempt to call a nil value`。

### 2.4 ExampleGenConfig — 所有 Example 的共同地基

`Examples/ExampleGenConfig.cs` 维护 **50+ 类型** `LuaCallCSharp`、`CSharpCallLua` delegate 列表、平台相关 `BlackList`。`configure.md` 写明：未配 `LuaCallCSharp` 走反射且 Il2Cpp 可能被剪裁；**不建议** 用 Attribute 打标签（Il2Cpp 代码量更大）。

**ZLua：** `Demo.cs` **零 Attribute**，Lua 直接 `CSharp.AC.Demo.Add(3,5)`。

---

## 3. 用法逐项对比（易用性与完整性）

本节按 **同一 C# 能力** 并列 xLua 与 ZLua 的 **写法、前置配置、代码量**。xLua 列引用 Tutorial `LuaCallCs.cs` / `CSCallLua.cs` 与 Examples；ZLua 列引用 zlua-demo 与指南。

**图例**

| 符号 | 含义 |
|------|------|
| ✅ | 无需额外配置（Mono Editor） |
| ⚙️ | 须 `LuaCallCSharp` / `CSharpCallLua` / `GCOptimize` 等 |
| 🔧 | 须 `XLua/Generate Code`（Il2Cpp Player） |
| 🚧 | ZLua Il2Cpp MVP 尚未支持 |

---

### 3.1 C# 调用 Lua

| 能力 | xLua | 前置 | ZLua | 前置 |
|------|------|------|------|------|
| 调无参函数 | `luaenv.DoString(...)` 或 `Global.Get<Action>("f")();` | ⚙️ CSharpCallLua（delegate） | `[LuaInvoke("app","main")] static extern void AppMain();` `AppMain();` | ✅ |
| 带参/返回值 | `Get<FDelegate>("f"); f(1,"a", out c)` | ⚙️ 每个 delegate 类型进列表 + 🔧 | `[LuaInvoke("app","add")] static extern int AppAdd(int,int);` | ✅ |
| 多函数 | 多次 `Get<T>` 或 `LuaFunction.Call` | ⚙️ / 慢路径 | 多个 `[LuaInvoke]` 声明 | ✅ |
| 读 Lua 全局变量 | `Global.Get<int>("a")` | ✅（值类型） | 一般用 module `return` 表 + `[LuaInvoke]`，**无** 命令式 Get | ✅ |
| 读 Lua table | `Get<DClass>` / `Get<LuaTable>` / `Get<ItfD>` | ⚙️ interface 须 CSharpCallLua；LuaTable 慢 | 模块导出字段由 Lua 函数返回，或 C# 只调 `[LuaInvoke]` | ✅ |
| Lua 模块约定 | `DoString` + 全局函数 | 分散 | `return { main = main, add = add }` | ✅ |

**xLua 教程原话（`XLua教程.md`）：** 访问 Lua function/table **代价大**，应初始化时 `Get` 一次 delegate 缓存。

**ZLua 示例（Bootstrap.cs + app.lua）：**

```csharp
[LuaInvoke("app", "add")]
private static extern int AppAdd(int a, int b);
// AppAdd(10, 20)  →  30
```

```lua
local function add(a, b) return a + b end
return { add = add }
```

**简洁性：** xLua C#→Lua 有 **≥6 种映射**（class/Dictionary/List/interface/LuaTable/delegate）；ZLua **一种主路径**（`static extern`），与 P/Invoke 一致。

---

### 3.2 Lua 调用 C# — 访问静态类型

假定类型 `Demo` 在程序集 `Assembly-CSharp`，xLua 须 ⚙️ `[LuaCallCSharp]` + 🔧。

| 能力 | xLua 写法 | ZLua 写法 |
|------|-----------|-----------|
| 程序集别名 | `local GameObject = CS.UnityEngine.GameObject`（缓存类型） | `CSharp['AC'] = CSharp['Assembly-CSharp']` |
| 访问类型 | `CS.Tutorial.DerivedClass` | `CSharp.AC.Demo` 或 `CSharp.AC['MyGame.UI.Panel']` |
| 静态字段 | `CS.Tutorial.DerivedClass.BSF = 2048` | `CSharp.AC.Demo.s_x = 10` |
| 静态 Property | `CS.UnityEngine.Time.deltaTime` | `CSharp['UnityEngine.CoreModule'].['UnityEngine.Time'].deltaTime` |
| 静态方法 | `CS.UnityEngine.GameObject.Find('x')` | `CSharp.AC.Demo.Add(3, 5)` |
| 静态 event | 生成代码路径；订阅语法因版本而异 | `CSharp.AC.EventPublisher.OnGlobalTick.get(handler)` |

**配置对比**

| | xLua | ZLua |
|---|------|------|
| 新静态 API 暴露给 Lua | 改 LuaCallCSharp 列表 + Generate | ✅ 直接使用 |
| 命名空间含点 | `CS.Tutorial.DerivedClass` | **必须** `CSharp.AC['MyGame.UI.Panel']`（链式 `.` 不适用含点 namespace） |

---

### 3.3 Lua 调用 C# — 创建对象实例

| | xLua | ZLua |
|---|------|------|
| 无参构造 | `local o = CS.UnityEngine.GameObject()` | `local demo = CSharp.AC.Demo()` |
| 有参构造 | `CS.UnityEngine.GameObject('name')` | `CSharp.AC.Demo(arg1, arg2)`（支持重载 dispatch，Mono） |
| 前置 | ⚙️ 类型在 LuaCallCSharp | ✅ |
| typeof | `typeof(CS.UnityEngine.ParticleSystem)` | `zlua.typeof(CSharp.UnityEngine.ParticleSystem)` 或类型表本身 |

xLua Tutorial `LuaCallCs.cs` 演示 `newGameObj = CS.UnityEngine.GameObject()`；ZLua demo `app.lua`：`local demo = CSharp.AC.Demo()`。**语法同级**，差异在 **ZLua 无需预生成 Wrap**。

---

### 3.4 Lua 调用 C# — 实例成员

| 能力 | xLua | ZLua |
|------|------|------|
| 实例字段 | `testobj.DMF = 1024` | `demo.x = 20` |
| 无参 Property | 同字段语法 `testobj.DMF` | `demo.x` / `demo.X`（与字段写法相同） |
| 实例方法 | `testobj:DMFunc()` | `demo:SetX(10)` / `demo:Run(10)` |
| 实例 event | `testobj:TestEvent('+', cb)` / `TestEvent('-', cb)` | `obj.OnChanged.get(obj, handler)` / `.set(obj, handler)` |
| 继承基类成员 | `testobj:BMFunc()`、`DerivedClass.BSFunc()` | 同 C# 继承规则，懒绑定父类元数据 |

**xLua 特殊语法：** event 用 **`'+''/'-'`** 字符串操作符（`LuaCallCs.cs` L261–267）。

**ZLua：** event 暴露为 `{ get, set }` 表，语义对齐 C# `+=` / `-=`，handler 为普通 `function`（无需 CSharpCallLua）。

---

### 3.5 泛型类

| 能力 | xLua | ZLua |
|------|------|------|
| `List<int>` | ⚙️ `typeof(List<int>)` 须进 LuaCallCSharp 列表（ExampleGenConfig 含 `List<int>`） | `zlua.make_generic_type(ListDef, zlua.types.int32)` |
| `Dictionary<K,V>` | 闭合适型须列入生成列表 | `make_generic_type(DictDef, zlua.types.string, zlua.types.int32)` |
| 嵌套泛型 | 每个闭合类型单独配置 | typeArg 可嵌套 `make_szarray_type` 等 |
| 文档限制 | Tutorial：**泛型方法不直接支持**，靠 Extension 封装（Ex09） | `make_generic_type` 闭合类；方法见下节 |
| Player | 🔧 已配置类型可生成 | 🚧 Il2Cpp MVP |

**xLua Ex09 `Foo.cs`：** 6 个类/静态类均 `[LuaCallCSharp]`；注释列出 **不支持的泛型方法** 形态。

**ZLua（generics-and-arrays.md）：**

```lua
local ListInt = zlua.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zlua.types.int32)
local list = ListInt()
list:Add(10)
```

**简洁性：** xLua 每闭合泛型一个配置项；ZLua **运行时闭合**，无 Generate 步骤。

---

### 3.6 泛型方法

| 能力 | xLua | ZLua |
|------|------|------|
| 类上方法 `List<int>.Add` | 类型闭合后普通调用 | `list:Add(10)` ✅ |
| 方法自身泛型 `Foo<T>(T a)` | Tutorial：**不直接支持**；`Extension1<T>` 包装（Ex09） | `SomeType.Foo(zlua.make_generic_inst(zlua.types.int32), value)` |
| 约束 | 生成器拒绝部分约束（Ex09 UnsupportedMethod*） | 规范见 type-system-spec §6 |
| Player | 🔧 | 🚧 |

---

### 3.7 一维数组（szarray）

| 能力 | xLua | ZLua |
|------|------|------|
| 创建 `int[]` | C# 侧创建传给 Lua，或 Lua 通过已导出类型 | `zlua.new_szarray_by_element_type(zlua.types.int32, 4)` |
| 数组类型 `T[]` | ⚙️ 元素类型须在 LuaCallCSharp | `zlua.make_szarray_type(zlua.types.int32)` |
| 下标 | 生成 Wrap 后 `arr[0]` | `arr[0] = 10`（0 基，与 C# 一致） |
| 长度 | C# `Length` / 生成属性 | `#arr`（`__len`） |
| 转 Lua table | 手动循环或 C# 方法 | `zlua.to_table(arr)` |
| 转 bytes | — | `zlua.to_bytes`（blittable 基元） |
| Ex05 数组无 GC | `farr(a1)` 预绑 delegate + GCOptimize | 同数组 API + Marshal 规则 |

xLua **无** 文档级 `make_szarray_type` API；依赖 **C# 数组类型已导出**。ZLua 提供 **与 C# 对称的构造 API**（lib-spec §7）。

---

### 3.8 多维数组（mdarray）

| 能力 | xLua | ZLua |
|------|------|------|
| 类型 `int[,]` | ⚙️ 闭合适型进列表（若需 Lua 构造） | `zlua.make_mdarray_type(zlua.types.int32, 2)` |
| 创建 | 通常 C# 创建后传入 | `zlua.new_mdarray_by_mdarray_type(IntMatrix, {0,0}, {3,4})` |
| 长度 | `GetLength(dimension)` | 同 C#；**无** `#` 运算符 |
| 文档 | Tutorial 未专章 | generics-and-arrays.md、type-system-spec §7 |

**完整性：** ZLua 对 mdarray 有 **显式一等 API**；xLua 依赖生成 Wrap 访问已存在的 C# 多维数组实例。

---

### 3.9 重载函数

| 机制 | xLua | ZLua |
|------|------|------|
| 默认 `obj:Run(x)` | int/string 可分派；**int/float/double 同映射 number 会歧义**（Tutorial 原文） | 运行时分派 + 可选显式签名 |
| 热路径 | 生成 Wrap 内写死分派 | `[LuaAlias("run_i32")]` → `demo:run_i32(10)` |
| 显式绑定 | 无一等 API；靠 cast/生成顺序 | `zlua.get_method(demo,"Run", zlua.signature(zlua.types.int32), false)` |
| 配置 | 🔧 所有重载须生成 | ✅ |

**ZLua demo（app.lua）：**

```lua
local run_i32 = zlua.get_method(demo, "Run", zlua.signature(zlua.types.int32), false)
run_i32(demo, 10)
```

**简洁性：** xLua 歧义时只能改 BlackList/生成顺序；ZLua **`[LuaAlias]` 或 `get_method`** 可确定性选型。

---

### 3.10 ref / in / out

| 能力 | xLua | ZLua |
|------|------|------|
| out 多返回值 | `local ret, p2, p3 = testobj:ComplexFunc(...)`（Tutorial 规则） | `local r = zlua.new_ref(zlua.types.int32); TryParse(s, r)` |
| ref 基元 | 生成 Wrap 路径 | `local n = zlua.new_ref(zlua.types.int32, 5)` |
| ref struct | table 或 GCOptimize userdata | `Point2D(1,2)` 或 `new_ref(Point2D,...)` |
| 裸 number 传 ref | 可能静默拷贝 | ⚠️ 文档明确：**不回写**，须 `new_ref` |
| `[LuaInvoke]` | — | **不支持** ref/out 参数 |
| Player | 🔧 | 🚧 |

xLua `LuaCallCs` `ComplexFunc` 演示 out + Lua 回调组合；ZLua 用 **`zlua.new_ref` 统一槽位模型**，语义在 marshal 规范中单点定义。

---

### 3.11 用法对比总表（配置步数）

| 任务 | xLua 最少步骤 | ZLua 最少步骤 |
|------|---------------|---------------|
| 新类型给 Lua 用 | 1. LuaCallCSharp 2. Generate 3. CS.Type | 1. `CSharp.asm.Type` |
| C# 调 Lua 函数 | 1. CSharpCallLua 2. Generate 3. Get 4. Call | 1. `[LuaInvoke]` 2. module return |
| UI 按钮回调 | 1. Button/UnityAction 进列表 2. Generate 3. Lua AddListener | 1. `AddListener(function() end)` |
| List&lt;int&gt; | 1. 闭合适型进列表 2. Generate | 1. `make_generic_type` |
| int[] 构造 | C# 侧或已导出类型 | `new_szarray_by_element_type` |
| 零 GC Vector3 | GCOptimize 或 Ex12 genaccessor | `[LuaMarshalAs]` / ComposeFromStack |
| Il2Cpp 发布 | **Generate Code**（Ex13） | Codegen/Weaver（无 Gen 目录） |

---

## 4. GC 优化对比

### 4.1 xLua 默认与「专家路径」

**文档（`XLua复杂值类型（struct）gc优化指南.md`）：** 默认 struct **引用传递 + boxing → GC**；无 GC 须 `[GCOptimize]` + **生成列表** + struct 仅含基本类型字段。

**Ex05 NoGc 检查清单：** `[GCOptimize][LuaCallCSharp]` struct/enum；7 个 `[CSharpCallLua]` delegate；`Start` 里 `Global.Get` **禁止** `LuaFunction.Call`；`Update` 只调缓存 delegate。

**Ex12 ReImplementInLua：** `xlua.genaccessor` 重写 Vector3 metatable，或 `[GCOptimize(PackAsTable)]` — 官方承认是为 **省 Wrap 体积与性能** 的高级技巧。

### 4.2 ZLua 三条 GC 路径

| 路径 | Lua 形态 | C# GC | 适用 |
|------|----------|-------|------|
| **OpaqueValue**（OpaqueLightUserData） | lightuserdata 句柄 | **零**（无 full userdata） | C#→Lua 同步链内临时 struct；`zlua.to_user_data` 升级 |
| **零 GC struct 传递**（ComposeFromStack / LuaStackFields） | 多个 number 或 table 字段 | **零** | `Vector2` 等 blittable 热路径；`Foo(1.0, 2.0)` |
| **StructUserData** | full userdata | **仅 userdata 自身**；payload 内 non-blittable 字段另计 | 持有、改字段、`ref`/`out`；**无论是否 blittable** |

#### OpaqueValue

| | xLua | ZLua |
|---|------|------|
| 机制 | 无对等一等概念；RawObject/Cast 处理精度 | C#→Lua：`StructStackScope` + lightuserdata handle |
| 生命周期 | — | **同步调用链内**；跨 `pcall` 须 `zlua.to_user_data` |
| 声明 | — | `[return: LuaMarshalAs(LuaMarshalType.OpaqueLightUserData)]` |

#### 零 GC struct 传递（ComposeFromStack）

| | xLua | ZLua |
|---|------|------|
| Vector2/3 热路径 | `[GCOptimize]` Unity 内置类型 或 Ex12 手写 metatable | C# 侧 `LuaStackFields` / 调用侧多 number |
| Lua 写法 | `Vector3ParamMethod(v3)` userdata | `Foo(1.0, 2.0)` 两个 number |
| 配置 | ⚙️ GCOptimize + Generate | `[LuaMarshalAs]` 或类型默认规则 |

#### StructUserData

| | xLua | ZLua |
|---|------|------|
| 语义 | GCOptimize 后 userdata 或 PackAsTable | 显式 **StructUserData** 路径 |
| non-blittable | GCOptimize 字段类型受限 | StructUserData **统一**承载；GC 扫 payload |
| ref 传参 | 生成代码 + GCOptimize | `new_ref` / struct `_ctor` → 真 ref |

**显著优势：** xLua 零 GC = **独立 Example + 三件套**；ZLua 将路径写入 **Marshal 规范**，按场景选型而非全局 GCOptimize。

---

## 5. Marshal 规则对比

xLua 编组分散在 **生成模板 + GCOptimize + Cast/RawObject**；ZLua 用 **`[LuaMarshalAs]` + 默认规则表**（[编组速查表](../reference/marshal-cheatsheet)）统一覆盖。

### 5.1 Marshal 函数（Delegate / Lua function）

| | xLua | ZLua |
|---|------|------|
| Lua function → C# delegate | ⚙️ CSharpCallLua + Generate；或慢路径 | `host:RegisterCallback(function(v) end)` ✅ |
| C# delegate → Lua | 生成 Wrap 调用 | userdata `__call`：`handler(42)` |
| 热路径 | Ex05：预 `Get` delegate | typed push/pop，无 object[] |
| 规范 | 分散在生成器 | [Function 编组](../spec/marshal/function) |

### 5.2 Marshal string

| | xLua | ZLua |
|---|------|------|
| 默认 | string ↔ Lua string | 同左 |
| 强制 userdata | — | `[LuaMarshalAs(UserData)]` |
| 与 byte[] 区分 | 一般分开 | `Bytes` 专用于 octet |

### 5.3 Marshal byte[]

| | xLua | ZLua |
|---|------|------|
| 默认 | ArrayUserData（生成 Wrap） | ArrayUserData |
| 二进制协议 | 常走 C# 侧 | `[LuaMarshalAs(LuaMarshalType.Bytes)]` → Lua **string**（原始字节） |
| 示例 | — | `void Send([LuaMarshalAs(Bytes)] byte[] data)` |

### 5.4 Marshal struct

| C#→Lua 默认 | xLua | ZLua |
|-------------|------|------|
| 常见路径 | boxing / userdata（GCOptimize） | **OpaqueValue**（lightuserdata） |
| Lua→C# | table 代替（Tutorial §自动转换）或 userdata | StructUserData / table（便捷） |
| 热路径 | GCOptimize / Ex12 | ComposeFromStack / LuaStackFields |
| 配置 | 每类型 GCOptimize | 方法/参数/返回值 `[LuaMarshalAs]` |

Tutorial 允许 `obj:Foo({b={a=100}, c=200})` **table 代替 struct** — 便捷但有 **table 分配**；ZLua 默认可走 **零 GC 路径**，table 为可选便捷写法。

### 5.5 Marshal OpaqueValue

| | xLua | ZLua |
|---|------|------|
| 概念 | 无统一 Opaque 模型 | `OpaqueLightUserData` + `StructStackScope` |
| 升级 | — | `zlua.to_user_data(opaque)` → StructUserData |
| 非法持久化 | — | 跨 pcall 使用 → 规范错误 |

### 5.6 Marshal 能力矩阵

| 类型 | xLua 覆盖方式 | ZLua 覆盖方式 |
|------|---------------|---------------|
| 基元 | 生成 Wrap / GCOptimize | 默认 + `UserData` 覆盖 |
| string | 生成 | 默认 + `UserData`/`Bytes` |
| byte[] | 生成 | 默认 / `Bytes` |
| struct | GCOptimize / table / Ex12 | Default / Opaque / StructUserData / ComposeFromStack |
| delegate | CSharpCallLua | 形参隐式 marshal |
| 数组 | LuaCallCSharp | ArrayUserData + zlua 构造 API |

**简洁性：** ZLua **一张速查表 + 四个 LuaMarshalType** 覆盖双向；xLua 需交叉查阅 GCOptimize、生成列表、Cast、NoGc Example。

---

## 6. 交互开销优化（调用链证据）

### 6.1 路径对比

**xLua（Lua → C#）：**

```text
lua_pcall → C# Wrap [MonoPInvokeCallback] → LuaDLL → C# 方法 → LuaDLL 写回
```

**ZLua 目标（Il2Cpp）：**

```text
lua_pcall → C++ MethodBridge → methodPointer / offset 直读
```

**C# → Lua：** xLua 多次 LuaDLL；ZLua `[LuaInvoke]` **单次 InternalCall**（见 [ZLua 与 xLua 技术架构对比](./comparison-with-xlua) §2）。

### 6.2 理论量级（Player 目标态）

| 场景 | xLua 粗算 | ZLua 目标 | 倍数 |
|------|-----------|-----------|------|
| `Add(int,int)` | 150–600 ns | 30–100 ns | 2–5× |
| `GetX()` | Wrap + translator | MethodBridge | 3–6× |
| 读 `int` 字段 | Wrap/getter | offset | 5–15× |
| C#→Lua 少参 | 5–15 次 LuaDLL | 1× IC | 2–4× |

Ex12 用 `genaccessor` **绕过字段 Wrap** — 侧证 xLua 默认字段路径不足快；ZLua 将 offset 设为规范默认。

---

## 7. Wrapper 函数对比

| | xLua | ZLua |
|---|------|------|
| C# Wrap | 每类型每成员生成（`Assets/XLua/Gen`） | **无** |
| 字段桥 | getter/setter Wrap 或 genaccessor hack | **无独立桥**（offset） |
| 签名复用 | 生成代码内部分共享 | C++ MethodBridge **按签名复用** |
| CI | Ex13 `GenAll` 强制 | 无 Generate 菜单 |
| 改 API | 改列表 + Regenerate | `EnsureBinding` 懒更新 |

`configure.md`：`[LuaCallCSharp]` 生成构造、成员/静态方法、属性、字段的适配代码；未配置 → 反射（慢 + Il2Cpp 剪裁风险）。

---

## 8. xLua 仍领先的项（公平边界）

| 项 | 说明 |
|----|------|
| **08 Hotfix** | 宏 + Generate + Inject + `xlua.hotfix` |
| **10 SignatureLoader** | 内置 RSA 验签 loader |
| **06 Coroutine** | `cs_coroutine` 成熟方案 |
| **生产生态** | 大量上线项目、中英文 Doc |
| **ZLua Player** | Il2Cpp MVP，泛型/ref/数组等见 [兼容性](../getting-started/compatibility) |

---

## 9. 选型建议

| 优先选 xLua | 优先选 ZLua（目标态） |
|-------------|----------------------|
| 现在要热更、少踩坑 | 互调性能/GC 是瓶颈 |
| 已有 xLua 资产 | 希望 **无 Generate**、语义贴近 C# |
| 不改 libil2cpp | 可投入 Il2Cpp 集成与双运行时测试 |

---

## 10. 相关文档

| 文档 | 内容 |
|------|------|
| [为什么选择 ZLua](./why-zlua) | 选型理由摘要 |
| [ZLua 与 xLua 技术架构对比](./comparison-with-xlua) | 调用栈、ns 量级推演 |
| [ZLua 与 xLua 全面对比报告](./xlua-comparison-report) | Examples 详证 + 用法逐项对照 |
| [编组速查表](../reference/marshal-cheatsheet) | ZLua 默认 Marshal |
| [Struct 编组规范](../spec/marshal/struct) | Opaque / StructUserData |
| [泛型与数组](../guides/generics-and-arrays) | szarray / mdarray API |
| [迁移草稿](../community/migration-from-xlua) | 存量 xLua 项目 |

---

*文档版本：基于 xLua Examples 01–13 与 ZLua doc 站；Player 实测数据待补充至 [ZLua 与 xLua 技术架构对比](./comparison-with-xlua)。*
