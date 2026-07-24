---
sidebar_position: 1
title: "总览"
---

# 00 — 总览

> ZLua 产品目标、双运行时架构、文档地图与初始化流程。  
> 术语见 [GLOSSARY.md](../concepts/glossary)。

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
| **实例继承运行时查找** | **无**；继承成员在 **Bind 期扁平化** 到当前类型三表（见 [02-TYPE-SYSTEM.md](02-TYPE-SYSTEM.md) §5） |

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

**Il2Cpp 源码布局（Unity 构建自动编译）：**

- `libil2cpp/lua` — Lua 5.4 源码
- `libil2cpp/zlua` — ZLua native 实现

权威参考路径：`build-win64/Il2CppOutputProject/IL2CPP/libil2cpp/zlua`（包内 `ZLua~/libil2cpp-2022` 为手动同步副本）。

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
│   ├── metatable/              __index、三表、布局
│   └── marshal/                Push/Pop、[LuaMarshalAs]
├── impl/                       实现说明（不改变 Lua 语义）
├── guides/                     测试、迁移
└── compare/                    与 xLua / toLua / SLua 对比
```

**阅读顺序建议：**

1. 本文件 → [01-HOST-API.md](01-HOST-API.md)（宿主集成）
2. [02-TYPE-SYSTEM.md](02-TYPE-SYSTEM.md) + [metatable/README.md](metatable/)（Lua 如何访问 C#）
3. [marshal/README.md](marshal/)（参数如何传递）
4. [04-METHOD-OVERLOAD.md](04-METHOD-OVERLOAD.md) + [05-LIB.md](05-LIB.md)（重载与标准库）
5. [10-LIFETIME.md](10-LIFETIME.md)（内存与 GC）

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

### 4.2 Native / Mono 侧（概念顺序）

| 步骤 | 动作 |
|------|------|
| 1 | 创建主 `lua_State`（**单状态**模型，见 [10-LIFETIME.md](10-LIFETIME.md)） |
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

顺序细节见 [10-LIFETIME.md](10-LIFETIME.md) 与 [impl/IL2CPP.md](../impl/IL2CPP)。

---

## 5. 与其它文档的边界

| 主题 | 所在文档 |
|------|----------|
| `__index` / 三表 / miss 语义 | [metatable/](metatable/) |
| Push / Pop / ref / Opaque | [marshal/](marshal/) |
| `zlua.make_*` / `register_method` | [05-LIB.md](05-LIB.md) |
| `GetFunction` 与 Delegate 桥 | [01-HOST-API.md](01-HOST-API.md) |
| ObjectRegistry / GC root | [10-LIFETIME.md](10-LIFETIME.md) |

---

## 6. 示例：最小脚本

```lua
-- 程序集别名（可选）
CSharp.AC = CSharp['Assembly-CSharp']

local Demo = CSharp.AC.Demo
local demo = Demo()

demo:SetX(10)
print(demo:GetX())

-- 显式重载别名（见 04-METHOD-OVERLOAD）
local run = demo.run_i32   -- [LuaAlias] 或 register_method
run(demo, 42)
```

C# 侧：

```csharp
var onStart = LuaAppDomain.GetFunction<Action>("main", "OnStart");
onStart();

public event Action<int> ValueChanged;
// Lua: demo:add_ValueChanged(function(v) ... end)
//      demo:remove_ValueChanged(handler)
```
