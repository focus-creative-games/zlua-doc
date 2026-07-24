---
sidebar_position: 13
title: "Mono 实现说明"
---

# Mono 实现说明

> **源码根：** `Packages/com.code-philosophy.zlua/Runtime/Mono/`  
> **Lua 可见语义：** [../spec/](../spec/00-OVERVIEW) — 本文只写 Editor Mono 的目录、初始化与 Il2Cpp 差异。

---

## 1. 背景与目标

旧 `Runtime/Mono` 已备份至 `_archive/Mono-pre-rewrite-20260723/` 并自零重写。目标是 **Editor 开发期** 与 Il2Cpp Player **交互表现一致**，目录与 Il2Cpp `zlua/` 模块可对照阅读。

Mono 成员索引统一走 Lua 三表 closure（见 [metatable/INDEXER-MONO.md](./metatable/INDEXER-MONO)）。

---

## 2. 目录对照

```
Runtime/Mono/              ←→  Il2Cpp zlua/
├── Lvm/                   ←→  lvm/
├── Mt/                    ←→  mt/
├── Marshaling/            ←→  marshal/     （禁止依赖 Mt；避让 System.Marshal）
├── Bridge/                ←→  bridge/      （含 LuaInvoke/ 子目录）
├── Emit/                  ←→  generated/   （运行时 Expression 生成，非构建期 stub）
├── Utils/                 ←→  utils/
└── DelegateImpl/          ←    （避免与 System.Delegate 命名冲突）
```

**命名空间：** `ZLua.Lvm` / `ZLua.Mt` / `ZLua.Marshaling` / `ZLua.Bridge` / `ZLua.Emit` / `ZLua.Utils` / `ZLua.DelegateImpl`。

**入口类型名保留：** `LuaMonoAppDomain` 仍在根命名空间 `ZLua`，供 Common 反射解析；Il2Cpp 侧对应 `LuaAppDomain`。

---

## 3. 已锁定决策

| # | 决策 | Mono 落点 |
|---|------|-----------|
| D1 | 删除旧 Mono，全新重写 | 当前 `Runtime/Mono/` 为 Phase 0–4 |
| D2 | Lua **三表 indexer**；无 C# `Dispatch*` | `Mt/TypeMemberLuaIndexer.cs` |
| D3 | 无法 Expression 特化 → **绑定期显式错误** | `Emit/EmitException.cs` |
| D4 | 删除 `[LuaInvoke]` legacy（`object[]` / `TryRewriteLegacyEditorMethod`） | Phase 4 Weaver + `Bridge/LuaInvoke/` |
| D5 | **无 Event 专用支持**；`add_Xxx`/`remove_Xxx` 为普通方法 | `MetaBinding` 不扫描 event 子表 |
| D6 | Il2Cpp 复用 stub；Mono **每成员 Emit 一条桥** | `Emit/` vs Il2Cpp `generated/` |
| D7 | MetaBinding 热路径无 `methodId` / `MethodMarshalCtx` upvalue | Emit 闭包直接绑 `MethodInfo`/`FieldInfo` |
| D8 | 目录 PascalCase；`generated/` → **`Emit/`** | 见 §2 |

---

## 4. 初始化顺序

### 4.1 AppDomain 级（`Lvm/LuaMonoAppDomain.cs`）

首次 `LuaAppDomain.Initialize(moduleLoader)`：

| 步骤 | 调用 | 对照 Il2Cpp |
|------|------|-------------|
| 1 | `new LuaEnv()` | `LuaEnv::Initialize` 主体 |
| 1a | └ `luaL_openlibs` + `RegisterPrint` | `RegisterLibs` 前半 |
| 1b | └ `ObjectRegistry.Initialize` | 同 |
| 1c | └ `StructRegistry.Initialize` | 同 |
| 1d | └ `MetaTableCache.Initialize` | 同 |
| 1e | └ `TypeMemberLuaIndexer.EnsureLoaded` | Mono 独有：加载 indexer 工厂 |
| 2 | `SetModuleLoader(moduleLoader)` | `LuaLoader::SetModuleLoader` |
| 3 | `LoadBuiltinGlobals()` | `RegisterGlobals` |
| 4 | `AssemblyRegistry.EnsureCSharpRoot()` | `AssemblyRegistry::InitializeCSharpRoot` |
| 5 | `ZLuaLib.RegisterGlobals(_luaEnv)` | `ZLuaLib::RegisterGlobals` |
| 6 | `EnsureBuiltinZLuaLib()` | 嵌入 `zlualib.lua` 等价物 |
| 7 | `DelegateBridges.Warmup()` | `DelegateBridge::Initialize` 预热 |

**重复 Initialize：** 若 `_luaEnv` 已存在，仅更新 loader 并 `EnsureBuiltinZLuaLib()`。

**Shutdown：** `ProcessPendingRefReleases` → `LuaEnv.Dispose()`（逆序释放 Registry / MetaTableCache，见 `LuaEnv.cs`）。

Il2Cpp 在 AppDomain 级额外提前执行 `MethodBridge::Initialize` 等 stub 表加载；Mono 对应桥由 **Emit 按类型绑定** 写入三表（Phase 3）。

---

## 5. 阶段进度与模块落点

| Phase | 状态 | 要点 | 主要文件 |
|-------|------|------|----------|
| 0 | ✅ | 备份、骨架、LuaInvoke 占位 | `ZLua.asmdef`、`Bridge/LuaInvoke/*` |
| 1 | ✅ | Lvm 链、ObjectRegistry、cast/box、struct ByVal/ByObj | `Lvm/LuaEnv.cs`、`Marshaling/*` |
| 2 | ✅ | `TypeRegistry*`、SMT/IMT、三表 indexer、`MetaBinding` 扫描 | `Mt/TypeRegistry*.cs`、`Mt/MetaBinding.cs`、`Mt/TypeMemberLuaIndexer.cs` |
| 3 | ✅ | Emit 写入三表；ctor/`__call`；arity overload MVP | `Emit/*`、`MemberTableEmitter.Fill` |
| 4 | ✅ | Delegate Emit、`ZLuaLib` 大部、`LuaInvokeBridge` typed catalog、删 legacy | `DelegateImpl/`、`Bridge/LuaInvoke/`、`Marshaling/DelegateMarshal.cs` |
| 5 | ✅ 实现 / ⏳ 验收 | NYI 补齐、Vector LuaInvoke、MethodClosureTag、LuaAlias、Pointer/`params`；manifest 待 Editor 跑通 | `Emit/*`、`Marshaling/PointerMarshal`、`ZLuaLib` |

**Phase 5：** `register_method` / `make_generic_method` / opaque get/set 已实装；开放泛型方法写入 throw stub + tag；Unity Vector LuaInvoke catalog 已加；`[LuaAlias]` 与 Il2Cpp 一致（别名替换默认键）；Pointer lightuserdata + DynamicMethod；TypedReference/decimal/ByRefLike 调用期拒绝；`params T[]` 按数组 Marshal。

---

## 6. 与 Il2Cpp 的关键差异

| 主题 | Il2Cpp | Mono |
|------|--------|------|
| **成员索引** | C `Dispatch*` + `MetaBinding` / `TypeRegistry` | Lua function `__index`/`__newindex` + 三表 upvalue |
| **Lua→C# 桥** | 构建期 C++ stub；`MethodBridge::ResolveMethodInvoker` 按签名查表 | 绑定期 `Expression.Compile()` → `lua_pushcfunction`；**不**共享 ReducedType stub |
| **MetaBinding 上下文** | `MethodMarshalCtx` + registry ref closure | 特化闭包 **无** runtime methodId upvalue |
| **C#→Lua** | InternalCall + `generated/LuaInvokeStub.cpp` | IL PostProcessor 改写为 `LuaInvokeBridge.{Method}` + `LuaInvokeSiteRegistry` |
| **Legacy LuaInvoke** | N/A（Player 仅 IC） | **已删除** `TryRewriteLegacyEditorMethod` / `RunLuaFunc(object[])`；仅 typed `LuaInvokeBridge` |
| **Event** | 无专用 `MetaKind::Event` | 无 Event 子表；`add_*`/`remove_*` 进 `methodTable` |
| **GC / 性能** | Il2Cpp GC + 槽位 pin | 槽位强引用 + weak cache；non-blittable ByVal 用 boxed companion |

语义一致性验收以 [../spec/](../spec/00-OVERVIEW) 为准；实现路径不同 **允许**，但 miss/strict、overload、cast、struct 等行为须与 Il2Cpp 一致。

---

## 7. 验收标准

实现完成后须满足：

- [ ] Editor Mono：`Tests/Lua/manifest.lua` 全绿
- [ ] 与 Il2Cpp 一致：类型门面、`zlua.cast`、虚方法、overload、struct、delegate、数组
- [ ] 无 Event 专用 API；`add_`/`remove_` 仅作普通方法
- [ ] 无 LuaInvoke legacy；无 ReducedType 共享桥
- [ ] MetaBinding 热路径无 `methodId` / MarshalCtx upvalue
- [ ] 热路径无巨量 GC / `Method.Invoke` 兜底

---

## 8. 关联文档

- Il2Cpp 模块图：[IL2CPP.md](./IL2CPP)
- 三表 indexer：[metatable/INDEXER-MONO.md](./metatable/INDEXER-MONO)
- Expression Emit：[codegen/EMIT-MONO.md](./codegen/EMIT-MONO)
- Weaver：[codegen/WEAVER.md](./codegen/WEAVER)
