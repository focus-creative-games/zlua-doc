---
sidebar_position: 5
title: "Il2Cpp 实现对照"
---

# Il2Cpp 实现对照

> **源码根（可编辑）：** `build-win64/Il2CppOutputProject/IL2CPP/libil2cpp/zlua`  
> **包内镜像（手动同步，勿直接改）：** `Packages/com.code-philosophy.zlua/ZLua~/libil2cpp-2022/zlua`  
> **Lua 可见语义：** [../spec/](../spec/00-OVERVIEW) — 本文只描述 C++ 模块划分、初始化顺序与文件职责。

---

## 1. 模块图

Il2Cpp runtime 按职责拆成七个顶层目录，与 Mono 重写后的 `Runtime/Mono/` 一一对应（见 [MONO.md](./MONO) §2）。

```
zlua/
├── lvm/          宿主生命周期、Lua 状态、ZLuaLib、InternalCall、Loader
├── mt/           类型注册、元表绑定、成员索引（`Dispatch*` + `MetaBinding`）
├── marshal/      Push/Pop、Registry、MarshalMeta、Overload 解析
├── bridge/       Method / Property / Field / Delegate 调用体
├── generated/    构建期 Codegen 产物（stub 表、BuiltinScripts.inc）
├── utils/        横切：MetadataUtil、异常、栈守卫、分配器
├── ZLuaCommon.*  公共头、宏门控、与 Lua VM 的 ABI 约定
└── LuaConsts.h   元表字段名、userdata kind 常量
```

**依赖方向（硬约束）：**

- `marshal/` **不得** `#include` `mt/`（Mt 通过 `MetatableHooks` 回调或上层装配）。
- `bridge/` 可依赖 `marshal/` 与 `generated/`；`mt/` 在绑定期调用 `bridge/` 与 `MarshalMeta`。
- `generated/` 仅被 `lvm/`、`bridge/` 引用；不参与运行时逻辑分支。

---

## 2. 初始化顺序

### 2.1 AppDomain 级（`lvm/LuaAppDomain.cpp`）

Player 进程进入 Il2Cpp 后，托管侧调用 `LuaAppDomain::Initialize()`，顺序固定：

| 步骤 | 调用 | 职责 |
|------|------|------|
| 1 | `LuaMetadataAlloc::Initialize()` | 绑定期元数据堆（`MethodMarshalCtx`、`MarshalMetaInfo` 等） |
| 2 | `MetadataUtil::Initialize()` | 程序集 / 类型 / 方法解析缓存 |
| 3 | `PropertyBridge::Initialize()` | 加载 `generated/PropertyBridgeStub.h` 中的 getter/setter 函数表 |
| 4 | `MethodBridge::Initialize()` | 加载 `generated/MethodBridgeStub.h` 中的 `lua2CsInvoker` 表 |
| 5 | `DelegateBridge::Initialize()` | 加载 `generated/DelegateBridgeStub.h` |
| 6 | `LuaInternalCalls::RegisterCoreInternalCalls()` | 核心 InternalCall |
| 7 | `LuaLoader::RegisterRoots()` | StreamingAssets / 模块搜索根 |
| 8 | `LuaEnv::Initialize()` | 创建 `lua_State` 并完成 Lua 侧 bootstrap（见下节） |

可选：`LuaAppDomain::InitializeFromManaged(Il2CppDelegate*)` 在步骤 8 之后注入托管 `moduleLoader` delegate。

### 2.2 Lua 状态级（`lvm/LuaEnv.cpp`）

`LuaEnv::Initialize()` 在 **单一全局** `lua_State*` 上执行：

| 步骤 | 调用 | 职责 |
|------|------|------|
| 1 | `luaL_newstate()` | 分配 VM |
| 2 | `RegisterGlobals()` | `__ZLUA_IL2CPP_PLAYER__=true`；嵌入 `globals.lua`（`generated/BuiltinScripts.inc`）；缓存 `__zluaErrorHandler` ref |
| 3 | `RegisterLibs()` | `luaL_openlibs`；重定向 `print` → Unity `Debug.Log`；`ZLuaLib::RegisterGlobals` + 嵌入 `zlualib.lua` |
| 4 | `ObjectRegistry::Initialize(L)` | ByObj 弱缓存表 + 槽位强引用表 |
| 5 | `StructRegistry::Initialize(L)` | non-blittable ByVal GC root 登记 |
| 6 | `MetaTableCache::Initialize(L)` | 类型元表 registry 缓存 |
| 7 | `LuaLoader::InstallHooks()` | `package.searchers` / 自定义 loader |
| 8 | `AssemblyRegistry::InitializeCSharpRoot(L)` | 挂 `csharp` 根表，延迟类型绑定入口 |

**Shutdown**（`LuaEnv::Shutdown`）与上述 **逆序** 释放：`ProcessPendingRefReleases` → `MetaTableCache` → `StructRegistry` → `ObjectRegistry` → `LuaGlobalRefs::Clear` → 释放 error handler ref → `lua_close` → `LuaLoader::Clear`。

---

## 3. 文件 → 职责表

### 3.1 `lvm/`

| 文件 | 职责 |
|------|------|
| `LuaAppDomain.cpp/.h` | Il2Cpp 入口：`Initialize` / `InitializeFromManaged` / `Shutdown` 转发 |
| `LuaEnv.cpp/.h` | 全局 `lua_State`、globals/libs 注册、error handler、dostring、pending ref 队列 |
| `ZLuaLib.cpp` | C API 实现：`zlua.import_type`、`zlua.cast`、`zlua.box` 等（语义见 [../spec/05-LIB.md](../spec/05-LIB)） |
| `LuaInternalCalls.cpp/.h` | InternalCall 注册 |
| `LuaGlobalRefs.cpp/.h` | registry 强引用集中管理 |
| `LuaLoader.cpp/.h` | 模块搜索、StreamingAssets loader、托管 delegate loader |

### 3.2 `mt/`

| 文件 | 职责 |
|------|------|
| `AssemblyRegistry.cpp/.h` | `csharp` 根、`import_type` 触发的程序集扫描 |
| `TypeRegistry.cpp/.h` | 类型门面分派入口（reference / valuetype / array / enum） |
| `TypeRegistryCommon.cpp/.h` | 共用：类型表字段、IMT/SMT 填充、`Dispatch*` 挂载 |
| `TypeRegistryReference.cpp/.h` | class / interface / delegate 绑定 |
| `TypeRegistryValueType.cpp/.h` | struct / Nullable 绑定 |
| `TypeRegistryArray.cpp/.h` | 数组类型、`__len` |
| `MetaBinding.cpp/.h` | Bind 期扫描 public 成员 → `NameMetaMap`；构造 method closure ref；overload group |
| `MetaTableCache.cpp/.h` | 按 `Il2CppClass*` 缓存 IMT/SMT registry ref |
| `InstanceTarget.cpp/.h` | userdata → `this` 指针 / ByVal payload 地址解析 |

### 3.3 `marshal/`

| 文件 | 职责 |
|------|------|
| `TypedMarshal.cpp/.h` | 按 `Il2CppType*` 分派的 Push/Pop 门面 |
| `MarshalMeta.cpp/.h` | 为 field/property/method 参数创建 `MarshalMetaInfo` 与 writer 函数指针 |
| `MarshalDefs.h` | `MarshalMetaInfo`、`MethodMarshalCtx`、`MethodGroups`、`ConversionKind` 等核心结构 |
| `ObjectRegistry.cpp/.h` | ByObj userdata：`(obj, viewKlass)` 弱缓存 + 槽位强引用 |
| `StructRegistry.cpp/.h` | non-blittable ByVal：GC root 跟踪 |
| `ObjectMarshal.cpp/.h` | 引用类型 push/pop |
| `StructMarshal.cpp/.h` | 值类型 ByVal/ByObj |
| `PrimitiveMarshal.cpp/.h` | 基元读写 |
| `StringMarshal.cpp/.h` | string |
| `ArrayMarshal.cpp/.h` | 数组 |
| `DelegateMarshal.cpp/.h` | delegate / Lua function |
| `OpaqueValueMarshal.cpp/.h` | opaque / lightuserdata 路径 |
| `IntrinsicTypes.cpp/.h` | Vector2/3/4 等内建 struct 特化 |
| `MethodOverloadResolver.cpp/.h` | 运行时 overload 选择（规范 [../spec/04-METHOD-OVERLOAD.md](../spec/04-METHOD-OVERLOAD)） |

详见 [marshal/README.md](./marshal/)。

### 3.4 `bridge/`

| 文件 | 职责 |
|------|------|
| `MethodBridge.cpp/.h` | 解析 stub 表 → `FnLua2CsInvoker`；默认 alloca + writer 慢路径 |
| `PropertyBridge.cpp/.h` | property getter/setter stub 调度 |
| `FieldBridge.cpp/.h` | 字段 offset 读写（与 `FieldMarshalCtx` 配合） |
| `DelegateBridge.cpp/.h` | C# delegate ↔ Lua function；**C#→Lua `GetFunction` 调用** 亦经此路径 |
| `BridgeDefs.h` | bridge 侧共享 typedef |

### 3.5 `generated/`（构建产出，勿手改）

| 产物 | 生成器 | 职责 |
|------|--------|------|
| `MethodBridgeStub.h` | `MethodBridgeCodegen` | 每个 AOT 方法一条 `Bridge_*` + `lua2CsInvoker` 条目 |
| `PropertyBridgeStub.h` | `PropertyBridgdeCodegen` | property accessor stub |
| `DelegateBridgeStub.h` | `DelegateBridgeCodgen` | delegate invoke stub |
| `MarshalBindings.*` | `MarshalAsCodegen` | `[LuaMarshalAs]` 扩展 writer |
| `BuiltinScripts.inc` | `BuiltinScriptsCodegen` | 嵌入 `globals.lua` / `zlualib.lua` |

详见 [codegen/STUBS-IL2CPP.md](./codegen/STUBS-IL2CPP)。

### 3.6 `utils/`

| 文件 | 职责 |
|------|------|
| `MetadataUtil.cpp/.h` | Il2Cpp 反射：类型查找、方法 sealed 判定、value size |
| `LuaException.cpp/.h` | C++ → 托管异常 / Lua error |
| `LuaUtil.cpp/.h` | registry ref、字符串、栈辅助 |
| `LuaStackGuard.h` | RAII 栈平衡 |
| `LuaMetadataAlloc.cpp/.h` | 绑定期分配器 |
| `Collection.h` | `AppendOnlyStringHashMap` 等绑定期容器 |

---

## 4. 与 Mono 的对照要点

| 维度 | Il2Cpp | Mono |
|------|--------|------|
| 成员索引 | `Dispatch*` + `MetaBinding` / `TypeRegistry`（[INDEXER-IL2CPP.md](./metatable/INDEXER-IL2CPP)） | Lua 三表 indexer（[INDEXER-MONO.md](./metatable/INDEXER-MONO)） |
| Lua→C# 桥 | Codegen **stub 复用**（按 ReducedType 签名） | **Emit/** 每成员 `Expression.Compile` |
| C#→Lua | `GetFunction` + Delegate 桥（`LuaCallInvoker`） | 同左 |
| Event | 已移除专用元数据；`add_*`/`remove_*` 为普通方法 | 同左 |

---

## 5. 关联文档

- 元表实现分册：[metatable/README.md](./metatable/)
- Marshal 实现分册：[marshal/README.md](./marshal/)
- Codegen 分册：[codegen/README.md](./codegen/)
- Mono 实现对照：[MONO.md](./MONO)
