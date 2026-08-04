---
sidebar_position: 1
title: "总览"
---

# 00 — 总览

> ZLua 产品目标、双运行时架构、文档地图与初始化流程。  
> 术语见 [GLOSSARY.md](/docs/concepts/glossary/)。

---

## 1. 产品目标

### 1.1 使用方式

ZLua 在概念上对齐 P/Invoke、`MonoPInvokeCallback`、`MarshalAs`：

| 概念 | ZLua 对应 |
|------|-----------|
| P/Invoke | C# ↔ Lua 互调；C#→Lua 经 **`GetFunction<T>`** |
| `MarshalAs` | **`[LuaMarshalAs]`** — 参数 / 返回值 Marshal |
| C# 调 Lua | **`LuaAppDomain.GetFunction<T>`** — 取得 Delegate 后 `Invoke` |

**统一交互模型：**

- **C#→Lua**：`LuaAppDomain.GetFunction<T>(module, method)` 按模块与方法名绑定 Delegate；调用方 `Invoke`，热路径自行缓存。
- **Lua→C#**：类型 **懒注册**；首次访问 `CSharp[assembly][typeFullName]` 时绑定成员。静态成员经类型表，实例成员经 `obj:Method()`，语义贴近 C#。
- **代码生成**：Lua→C# 桥接在 Editor 生成（Mono：Expression Emit；Il2Cpp：C++ stub + 元数据），对业务开发者透明；**C#→Lua 经 `GetFunction` + Delegate 桥**，不改写用户程序集。

**深度集成：** 宿主启动时初始化 CLR 与 `lua_State`，加载 `zlua` 标准库与 `CSharp` 根表。

### 1.2 Player 发布优化（Il2Cpp）

| 优化 | 说明 |
|------|------|
| Native 桥接 | 热路径为 C++，不经 `LuaDLL` extern 逐层跳转 |
| Stub 复用 | 相同 ReducedType 签名复用桥接函数，非「每成员一个独立 C 函数」 |
| 字段 / 属性 | Il2Cpp 可走偏移 + `methodPointer` 直接访问 |
| 托管对象 | userdata 记录对象指针；`ObjectRegistry` 槽位注册为 **GC root**，Lua 释放 userdata 后解除 |

Mono（Editor）允许反射 / Emit 慢路径，但 **Lua 可见语义必须与 Il2Cpp 一致**。

### 1.3 明确不支持

| 项 | 规范行为 |
|----|----------|
| **Event 专用元表** | **无** `{ get, set, fire }`；脚本使用 `add_EventName` / `remove_EventName`（与普通方法相同） |
| **`__index` miss** | 返回 **`nil`** |
| **`__newindex` miss** | **`error`** |
| **实例继承运行时查找** | **无**；继承成员在 **Bind 期扁平化** 到当前类型三表（见 [02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) §5） |

---

## 2. 双运行时架构

```
                    LuaAppDomain.Initialize(moduleLoader)
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
            ZLua.Mono (Editor)              ZLua.Il2Cpp (Player)
            LuaMonoAppDomain                LuaIl2CppAppDomain
                    │                               │
        三表 Lua indexer / Emit 桥          libil2cpp/zlua (C++)
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
                         同一 Lua 可见语义 (spec/**)
```

| 层 | Mono | Il2Cpp |
|----|------|--------|
| 程序集 | `ZLua.Mono` | `ZLua.Il2Cpp`（薄 InternalCall 壳） |
| 互操作实现 | C# + Lua indexer | `libil2cpp/zlua/**` |
| 桥接 | 每 public 成员 Expression Emit | ReducedType stub + 生成元数据 |
| Indexer | 三表 Lua closure | native `Dispatch*` + `MetaBinding` / `TypeRegistry` |
| 共享定义 | `ZLua.Common`：`LuaMarshalAsAttribute`、`LuaAliasAttribute`、`LuaAppDomain` | 同左 |

**Il2Cpp 源码布局（Unity 构建）：**

- `libil2cpp/lua` — Install 按选定引擎叠加：**PUC-Rio** 为可编译源码树（经 patch，见 [build/01-OFFICIAL-LUA.md](/docs/spec/build/01-OFFICIAL-LUA/)）；**LuaJIT** 为公共头文件（静态库由开发者放入 Plugins，见 [build/02-LUAJIT.md](/docs/spec/build/02-LUAJIT/)）
- `libil2cpp/zlua` — ZLua native 实现（来自包内 `ZLua~/zlua-runtime`）

开发期可编辑参考：`build-win64/Il2CppOutputProject/IL2CPP/libil2cpp/zlua`。  
包布局、多 Unity / 多 Lua、patch、DLL 命名、Il2Cpp `ZLuaConf.inc` / Compatible 头 → [11-MULTI-VERSION.md](/docs/spec/11-MULTI-VERSION/)（§12）。

---

## 3. 文档地图

```
Docs/
├── GLOSSARY.md                 术语表
├── spec/
│   ├── 00-OVERVIEW.md          ← 本文件
│   ├── 01-HOST-API.md          LuaAppDomain、GetFunction
│   ├── 02-TYPE-SYSTEM.md       CSharp、类型表、构造、数组
│   ├── 04-METHOD-OVERLOAD.md   dispatch、别名、签名
│   ├── 05-LIB.md               zlua.* API
│   ├── 10-LIFETIME.md          Registry、GC、异常边界
│   ├── 11-MULTI-VERSION.md     Unity/Lua 多版本、Install、DLL、ZLuaConf
│   ├── 12-MIGRATION-ADAPTORS.md xLua/toLua/SLua Lua→C# 类型路径适配
│   ├── build/                  官方 Lua / LuaJIT 构建；Mono gate；EmmyLua 调试器
│   ├── metatable/              __index、三表、布局
│   └── marshal/                Push/Pop、[LuaMarshalAs]
├── impl/                       实现说明（不改变 Lua 语义）
├── guides/                     测试、迁移
└── compare/                    与 xLua / toLua / SLua 对比
```

**阅读顺序建议：**

1. 本文件 → [01-HOST-API.md](/docs/spec/01-HOST-API/)（宿主集成）
2. [02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) + [metatable/README.md](/docs/spec/metatable/)（Lua 如何访问 C#）
3. [marshal/README.md](/docs/spec/marshal/)（参数如何传递）
4. [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) + [05-LIB.md](/docs/spec/05-LIB/)（重载与标准库）
5. [10-LIFETIME.md](/docs/spec/10-LIFETIME/)（内存与 GC）
6. 集成包 / 换 Unity 或 Lua 版本 → [11-MULTI-VERSION.md](/docs/spec/11-MULTI-VERSION/)
7. 官方 Lua 构建 → [build/01-OFFICIAL-LUA.md](/docs/spec/build/01-OFFICIAL-LUA/)
8. LuaJIT 构建 → [build/02-LUAJIT.md](/docs/spec/build/02-LUAJIT/)
9. Editor Mono 回调错误边界（全系列） → [build/03-MONO-LUAJIT-CALLBACK-GATE.md](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/)
10. Editor EmmyLua 调试器 → [build/04-EMMYLUA-DEBUGGER.md](/docs/spec/build/04-EMMYLUA-DEBUGGER/)
11. 第三方原生模块（socket / cjson 等） → [build/05-NATIVE-MODULES.md](/docs/spec/build/05-NATIVE-MODULES/)
11. 从 xLua / toLua / SLua 迁移类型访问适配 → [12-MIGRATION-ADAPTORS.md](/docs/spec/12-MIGRATION-ADAPTORS/)

**冲突裁决：** `spec/**` > Il2Cpp 源码 > `impl/**`。

---

## 4. 初始化流程

### 4.1 C# 入口

```csharp
LuaAppDomain.Initialize(moduleName => {
    // 返回模块源码 string，或 byte[] 等 loader 约定类型
    return LoadLuaModule(moduleName);
});
```

`LuaAppDomain` 按 `Application.isEditor` 解析后端：

- Editor → `ZLua.LuaMonoAppDomain.Initialize`
- Player → `ZLua.LuaIl2CppAppDomain.Initialize` → native `InitializeInternal`

初始化完成后注册 `LuaFramePump`，在 Unity 帧回调中处理 pending ref 释放等 housekeeping。

Editor 可选：Settings `enableDebugger` 时在 Mono `Initialize` 末尾启动 EmmyLua（见 [build/04-EMMYLUA-DEBUGGER.md](/docs/spec/build/04-EMMYLUA-DEBUGGER/)）。

### 4.2 Native / Mono 侧（概念顺序）

| 步骤 | 动作 |
|------|------|
| 1 | 创建主 `lua_State`（**单状态**模型，见 [10-LIFETIME.md](/docs/spec/10-LIFETIME/)） |
| 2 | 打开标准库；执行 `zlualib.lua`（`ZLuaLib::RegisterGlobals` 注册 `__zlua_*`） |
| 3 | 初始化 Registry：`ObjectRegistry`、`TypeRegistry`、Opaque scope 等 |
| 4 | 创建全局 `CSharp` 根表（程序集 / 类型懒加载 `__index`） |
| 5 | 安装模块 loader（`__zlua_load_module` searcher） |
| 6 | 可选：执行 `globals.lua` 等项目脚本 |

### 4.3 首次类型访问

```
CSharp.__index(assemblyName)
  → 创建程序集表，rawset 缓存

assembly.__index(typeFullName)
  → CLR 解析 Type，EnsureBinding
  → 构建 SMT / IMT、三表、dispatch
  → PushTypeTable，rawset 缓存
```

之后 Lua 侧通过类型表 / userdata 元表访问成员，**无需** `[MonoLuaCallback]` 或手动 Export。

### 4.4 关闭

宿主销毁或域卸载时：

1. 排空 pending Lua ref 释放队列
2. `ObjectRegistry::Shutdown`、Struct registry shutdown
3. 关闭 `lua_State`

顺序细节见 [10-LIFETIME.md](/docs/spec/10-LIFETIME/) 与 [impl/IL2CPP.md](/docs/impl/IL2CPP/)。

---

## 5. 与其它文档的边界

| 主题 | 所在文档 |
|------|----------|
| `__index` / 三表 / miss 语义 | [metatable/](/docs/spec/metatable/) |
| Push / Pop / ref / Opaque | [marshal/](/docs/spec/marshal/) |
| `zlua.make_*` / `register_method` | [05-LIB.md](/docs/spec/05-LIB/) |
| `GetFunction` 与 Delegate 桥 | [01-HOST-API.md](/docs/spec/01-HOST-API/) |
| ObjectRegistry / GC root | [10-LIFETIME.md](/docs/spec/10-LIFETIME/) |
| xLua / toLua / SLua 类型路径适配 | [12-MIGRATION-ADAPTORS.md](/docs/spec/12-MIGRATION-ADAPTORS/) |

---

## 6. 示例：最小脚本

```lua
-- 程序集别名（可选）
CSharp.AC = CSharp['Assembly-CSharp']

local Demo = CSharp.AC.Demo
local demo = Demo()

demo:SetX(10)
print(demo:GetX())

-- 显式重载（见 04-METHOD-OVERLOAD）
demo['Run(System.Int32)'](demo, 42)          -- 全签名键
local run = demo['Run(System.Int32)']
zlua.register_method("run_i32", run)         -- 短名后可冒号
demo:run_i32(42)
```

C# 侧：

```csharp
var onStart = LuaAppDomain.GetFunction<Action>("main", "OnStart");
onStart();

public event Action<int> ValueChanged;
// Lua: demo:add_ValueChanged(function(v) ... end)
//      demo:remove_ValueChanged(handler)
```
