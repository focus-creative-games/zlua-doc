---
sidebar_position: 2
title: "特性与用法对比"
---

# 特性与用法对比（xLua / toLua / SLua / ZLua）

> **性质：** 选型材料，非 ZLua 行为规范。  
> **ZLua 状态：** Mono（Editor）与 Il2Cpp（Player）**均已完成**（见 [impl/MONO.md](../impl/MONO)）。

---

## 1. 总览对照

| 维度 | xLua | toLua / tolua# | SLua | ZLua |
|------|------|----------------|------|------|
| **Lua 引擎** | 独立 **libxlua**（P/Invoke） | 内嵌或绑定原生 lua | 内嵌 lua | 链入 **libil2cpp**（Player）/ 内嵌（Editor） |
| **类型入口** | `CS.Namespace.Type` | 导出全局 / 包装类 | 类似 toLua + 配置 | `CSharp[assembly]['Full.Name']` 懒加载 |
| **Lua→C# 桥** | 生成 **C# Wrap** + `LuaDLL` | 生成 `*.Wrap.cs` | 自动绑定 + 导出 | C++ MethodBridge（Il2Cpp）/ Expression Emit（Mono） |
| **C#→Lua** | `LuaEnv` + `LuaFunction` + 多次 `LuaDLL` | `LuaState` / `LuaFunction` | `LuaSvr` / `LuaFunction` | `[LuaInvoke]` InternalCall + C++ 模板 |
| **白名单 / 导出** | `[LuaCallCSharp]` / `[CSharpCallLua]` + Generate | 手动列表 / Binder | 导出配置 / Attribute | **无** LuaCall 白名单；按 **public** + 懒 Bind |
| **Editor vs Player** | 基本一致（均走 libxlua + Wrap） | 基本一致 | 基本一致 | **双轨**：Mono Emit vs Il2Cpp native（语义须一致） |
| **侵入 Unity** | 插件包 + native | 插件包 | 插件包 | **fork libil2cpp**（Player） |
| **Event** | 专用支持 | 视版本 | 视版本 | **无**；用 `add_` / `remove_` 普通方法 |
| **文档 / 社区** | 强 | 弱（停更风险） | 弱 | 建设中 |

---

## 2. 类型访问

### 2.1 语法对照（同一类型 `MyGame.Demo`）

| 方案 | 典型写法 |
|------|----------|
| xLua | `CS.MyGame.Demo` |
| toLua | `Demo`（导出后全局）或 `UnityEngine.GameObject` |
| SLua | `UnityEngine.GameObject`（自动导出命名空间） |
| ZLua | `CSharp['Assembly-CSharp']['MyGame.Demo']` 或 `CSharp.AC['MyGame.Demo']` |

**ZLua 规则要点：**

- 含 **命名空间** 的类型必须用 **括号键** 整段 `typeFullName`，禁止 `CSharp.AC.MyGame.Demo`（`.` 不是表路径）。
- 嵌套类型用 `+`：`CSharp.AC['Outer+Inner']`。
- 程序集名为简单名：`Assembly-CSharp`、`mscorlib`。

详见 [spec/02-TYPE-SYSTEM.md](../spec/02-TYPE-SYSTEM) §2。

### 2.2 懒加载 vs 预导出

| 方案 | 模型 | 包体 / 链接影响 |
|------|------|-----------------|
| xLua | Generate 白名单类型 → Wrap 进包 | 未导出类型不可调；可控制体积 |
| toLua / SLua | 导出列表决定 Wrap 数量 | 导出越多，生成代码越大 |
| ZLua | 首次访问 `CSharp[asm][type]` 时 **EnsureBinding** | 运行时绑定 + Il2Cpp stub 表；**未访问类型不占桥接表项**（但链接仍保留元数据） |

### 2.3 泛型与数组

| 能力 | xLua | toLua | SLua | ZLua |
|------|------|-------|------|------|
| 闭泛型 | `CS.System.Collections.Generic.List(CS.System.Int32)` 等 | 需预导出或反射 | 配置导出 | `zlua.make_generic_type(base, ...)` |
| 数组类型 | 导出或反射 | 导出 | 导出 | `zlua.make_szarray_type` / `make_mdarray_type` |
| 运行时构造数组 | 支持（视导出） | 有限 | 有限 | `zlua.new_szarray_by_element_type` 等 |

---

## 3. 成员调用（Lua→C#）

### 3.1 静态 / 实例

**统一示例：** 静态 `Demo.Add(1, 2)`，实例 `obj:GetX()`。

| 方案 | 静态 | 实例 |
|------|------|------|
| xLua | `CS.Demo.Add(1, 2)` | `obj:GetX()` |
| toLua | `Demo.Add(1, 2)` | `obj:GetX()` |
| SLua | 同 toLua | 同 toLua |
| ZLua | `Demo.Add(1, 2)`（`Demo` 为类型表） | `obj:GetX()` |

ZLua 静/实例 **分离三表**（method / fieldGetter / fieldSetter）；继承成员在 **Bind 期扁平化**，无运行时沿继承链查找。

### 3.2 字段与属性

| 方案 | 读字段 | 写只读属性 |
|------|--------|------------|
| xLua | 常经 Wrap / property | Wrap 报错 |
| toLua / SLua | Wrap 或 getter | 同左 |
| ZLua | `obj.x` → fieldGetter 表；Il2Cpp 可走 **offset 直读** | `__newindex` miss → **error** |

### 3.3 方法重载

| 方案 | 策略 |
|------|------|
| xLua | 生成 Wrap 内 overload 分派 |
| toLua / SLua | Wrap 内分派或单一签名 |
| ZLua | Bind 期注册；默认 **最佳匹配**；`[LuaAlias]` / `register_method` 显式绑定（见 [spec/04-METHOD-OVERLOAD.md](../spec/04-METHOD-OVERLOAD)） |

**ZLua 特有能力：**

```lua
-- Bind 期 [LuaAlias("foo_str")] 单候选 direct closure
obj:foo_str("a")

-- 或运行时挂新名（须尚未占用）
local run = demo.run_i32
zlua.register_method("run_hot", run)
demo:run_hot(1)
```

### 3.4 `__index` miss 语义

| 方案 | 不存在成员 |
|------|------------|
| xLua | 通常 `nil` 或 error（视 Wrap） |
| toLua / SLua | 多 error |
| ZLua | **`nil`**（读）；写未知键 **`error`** |

---

## 4. C#→Lua

### 4.1 入口对照

| 方案 | C# 调 Lua 函数 | Lua 函数 → C# delegate |
|------|----------------|------------------------|
| xLua | `LuaEnv.DoString` / `LuaFunction.Call` / `[CSharpCallLua]` | `LuaFunction` / `Delegate` 桥 |
| toLua | `LuaState.DoFile` / `LuaFunction` | `LuaFunction.ToDelegate` 等 |
| SLua | `LuaSvr` + `LuaFunction` | SLua delegate 绑定 |
| ZLua | `[LuaInvoke("module", "func")]` static extern | 方法形参 **隐式 marshal**（`Action`/`Func` 等） |

**ZLua `[LuaInvoke]` 示例：**

```csharp
[LuaInvoke("game", "OnTick")]
public static extern void OnTick(float dt);
```

- Editor：Weaver + Emit 桥（**无** `object[]` legacy）。
- Player：`InternalCall` → C++ `LuaInvokeRuntime::Call`，构建期解析 `moduleRef`/`funcRef`。

### 4.2 模块加载

| 方案 | 加载 |
|------|------|
| xLua | `require` + 自定义 loader |
| toLua / SLua | 自定义 loader |
| ZLua | `LuaAppDomain.Initialize(moduleLoader)`；与 `require` 集成（见 [spec/01-HOST-API.md](../spec/01-HOST-API)） |

---

## 5. 值类型、ref、struct

| 主题 | xLua | toLua / SLua | ZLua |
|------|------|--------------|------|
| struct 传参 | 多装箱或 table | 视 Wrap | **ByVal userdata** 拷贝 / **ByObj** boxed |
| struct 返回值 | 常分配 | 同左 | ByVal payload 或 boxed（见 [spec/marshal/05-STRUCT.md](../spec/marshal/05-STRUCT)） |
| `ref`/`out` Lua→C# | 多返回值或 table | 多返回值 | StructUserData（`Type(...)` / C# 推送）或拷贝语义 |
| C#→Lua `ref`/`out` | 视版本 | 有限 | **OpaqueValue**（仅当次调用帧有效） |
| enum | number / 导出类型 | 导出 | integer 默认；可 ByObj boxed |
| `zlua.cast` | — | — | 声明类型门面转换 |

**Opaque 边界（ZLua 特有，迁移易踩坑）：**

- C# `[LuaInvoke]` 的 `ref int` 推到 Lua 侧是 **OpaqueValue**，不是 integer；须 `zlua.get_opaquevalue` / `set_opaquevalue`。
- Opaque **不可跨 pcall 持久化**。

---

## 6. 热更、代码生成与裁剪

| 维度 | xLua | toLua / SLua | ZLua |
|------|------|--------------|------|
| 热更实践 | 大量现成方案（字节码、资源） | 项目自建 | **需自建**；ZLua 不绑定特定热更框架 |
| 代码生成 | XLua Generate All | 导出 Wrap | Il2Cpp：**Codegen C++ stub** + Weaver `[LuaInvoke]`；Mono：**Emit**（不进 Player 包） |
| 反射兜底 | 有（慢路径） | 部分 | **禁止**热路径静默 `Method.Invoke`；无法 Emit 则 **绑定期失败** |
| 链接 / 裁剪 | 白名单控制 Wrap | 导出列表 | public 类型可懒 Bind；Il2Cpp **ReducedType** 控制 stub 体积（见 [BRIDGE.md](./BRIDGE)） |
| Unity 升级 | 升 xLua 包为主 | 风险高 | **merge libil2cpp 补丁**（工程债） |

---

## 7. Editor / Player 一致性

| 方案 | 双端 |
|------|------|
| xLua / toLua / SLua | 通常同一套 lib + Wrap，Editor ≈ Player |
| ZLua | **必须** Mono 与 Il2Cpp **Lua 可见语义一致**；实现不同（Emit vs C++ stub） |

**测试要求：** 同一套用例在 Editor 与 Il2Cpp Player 各跑一遍；任一失败即失败（见 [guides/TESTING.md](../community/testing)）。

**索引器 Property / 开放泛型等**：见 [兼容性矩阵](https://doc.zlua.cn/docs/getting-started/compatibility) 与 [spec](../spec/00-OVERVIEW)；双端语义一致，有限制项两端相同。

---

## 8. 侵入性与维护

```text
浅 ←────────────────────────────────────────→ 深（Il2Cpp 侵入）

纯 C# 反射桥
  xLua / toLua / SLua（插件 + native / Wrap）
    ★ ZLua Player 目标（嵌入 libil2cpp）
      HybridCLR 级 VM 改造（ZLua 不做）
```

| 层级 | xLua | toLua / SLua | ZLua |
|------|------|--------------|------|
| 修改 libil2cpp | 否 | 否 | **是**（Player） |
| 独立 native | libxlua | 可选 | 否（与 il2cpp 同二进制） |
| GC 钩子 | 一般无 | 一般无 | non-blittable struct 等可能 hook `push_other_roots` |
| 维护焦点 | 包版本 | 停更风险 | **Unity 版本 + zlua 补丁 merge** |

---

## 9. 配置与白名单

| 方案 | 机制 |
|------|------|
| xLua | `[LuaCallCSharp]`、`[CSharpCallLua]`、`[ReflectionUse]`、Generate 配置 |
| toLua | 自定义 `CustomSettings.cs` 导出列表 |
| SLua | `[CustomLuaClass]`、导出 XML / 代码 |
| ZLua | **无** LuaCall 式白名单；**public** 成员可 Bind；`[LuaMarshalAs]` / `[LuaAlias]` 影响 Marshal 与别名；Weaver 处理 `[LuaInvoke]` |

**迁移含义：** 从 xLua 迁出时需 **删除** Generate 配置，改为确认程序集内 public API 是否应暴露给 Lua；敏感 API 应改 **非 public** 而非依赖导出列表。

---

## 10. 不支持或弱支持项（迁移检查清单）

| 项 | xLua | toLua / SLua | ZLua |
|----|------|--------------|------|
| C# **Event** 语法糖 | 有 | 视版本 | **无** → `add_Xxx` / `remove_Xxx` |
| 运行时继承查找 | 有 | 有 | **无**（Bind 期扁平化） |
| `CS.` 全局 | 有 | N/A | 用 **`CSharp`** |
| 热路径反射 Invoke | 兜底 | 部分 | **显式错误** |
| 跨帧 Opaque | N/A | N/A | **禁止** |
| 任意 Lua function 存成永久 delegate 无 GC 顾虑 | 需注意 translator | 需注意 | 须理解 [spec/10-LIFETIME.md](../spec/10-LIFETIME) |

---

## 11. 同一示例四列对照

**需求：** 调用 `MyGame.Demo.Add(1, 2)`，创建实例并读字段 `x`。

```lua
-- xLua
local Demo = CS.MyGame.Demo
local sum = Demo.Add(1, 2)
local obj = Demo()
local x = obj.x

-- toLua（已导出 Demo 到全局）
local sum = Demo.Add(1, 2)
local obj = Demo.New()
local x = obj.x

-- SLua
local Demo = MyGame.Demo
local sum = Demo.Add(1, 2)
local obj = Demo()
local x = obj.x

-- ZLua
local Demo = CSharp['Assembly-CSharp']['MyGame.Demo']
local sum = Demo.Add(1, 2)
local obj = Demo()
local x = obj.x
```

---

## 12. 选型摘要

| 更适合 | 方案 |
|--------|------|
| 立刻上线、要少踩坑、团队已有 xLua 资产 | **xLua** |
| 老项目 toLua/SLua 已稳定、改动面小 | **维持原方案**（迁移 ZLua 成本高） |
| Player 性能边界是瓶颈、愿维护 libil2cpp、要 C# 语义一致 | **ZLua** |
| 不愿改引擎层、不需极致互调性能 | **xLua** 优于 ZLua |

迁移步骤见 [guides/migration/](../community/migration/)。

---

## 相关文档

| 文档 | 内容 |
|------|------|
| [PERFORMANCE.md](./PERFORMANCE) | 性能对比 |
| [GC.md](./GC) | GC 对比 |
| [spec/02-TYPE-SYSTEM.md](../spec/02-TYPE-SYSTEM) | ZLua 类型系统规范 |
