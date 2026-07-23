---
sidebar_position: 4
title: "LuaInvoke Weaver"
---

# LuaInvoke Weaver

> **Editor：** `Editor/CodeGen/LuaInvokeILPostProcessor.cs` → `LuaInvokeAssemblyRewriter`  
> **Mono 运行时：** `Runtime/Mono/Bridge/LuaInvoke/LuaInvokeBridge.cs`、`LuaInvokeSiteRegistry.cs`  
> **Player：** InternalCall + `generated/LuaInvokeStub.cpp`（见 [STUBS-IL2CPP.md](./STUBS-IL2CPP)）  
> **重写约束：** [../MONO.md](../MONO) D4 — **删除 legacy `object[]` 路径**

---

## 1. 职责

将用户程序集中标记 `[LuaInvoke("moduleName", "methodName")]` 的 **static extern** 方法改写为可执行 IL：

| 环境 | 改写结果 |
|------|----------|
| **UNITY_EDITOR**（开发） | 调用 `LuaInvokeBridge.{TypedMethod}(module, name, …)` + `LuaInvokeSiteRegistry.GetOrCreateFunctionRef` |
| **Player / 非 Editor** | `InternalCall` + native 符号，链接到 Codegen C++ |

C#→Lua 的 marshal 规则见 [../../spec/05-LIB.md](../../spec/05-LIB) 与 [../../spec/marshal/](../../spec/marshal/)。

---

## 2. 触发条件

`LuaInvokeILPostProcessor.WillProcess`：

- 程序集 **引用** `ZLua`（Mono）、`ZLua.Common` 或 `ZLua.Il2Cpp`；
- 排除 mscorlib、System.*、UnityEngine.* 等框架程序集。

每个编译单元在 IL 后处理阶段运行 **一次**；已处理程序集标记 `[LuaInvokeWeaverProcessed]` 避免重复。

---

## 3. Editor 路径（typed bridge，目标态）

### 3.1 流程

```
[LuaInvoke] extern static void Foo(int x)
    ↓ LuaInvokeAssemblyRewriter.Process
ValidateLuaInvokeMethod (必须 static、无 body、非泛型)
    ↓
LuaInvokeBridgeCatalog.TryResolveBridgeMethod → Bridge/LuaInvokeBridge 上的 typed 方法
    ↓
LuaInvokeWeaverFastPath.TryRewriteEditorMethod
    ↓
生成 IL：GetOrCreateFunctionRef(module, name) + 压参 + call typed bridge
```

`LuaInvokeBridge` 为 **partial class**，含 default `Invoke_*` 与 `InvokeM_*` catalog（Phase 4 已接入）。Weaver 通过 **方法名 + 参数签名** 解析对应 bridge；**无** `object[]` legacy。

### 3.2 站点注册

`LuaInvokeSiteRegistry.GetOrCreateFunctionRef`：

- 缓存 `(moduleName, methodName) → Lua function ref`；
- 首次调用时 `require`/loader 解析模块并取函数。

Il2Cpp Player 在 `InitLuaInvokeSites` / stub 注册阶段 **预解析** 等价站点。

---

## 4. Legacy 路径（待删除）

`TryRewriteLegacyEditorMethod` 仍存在于 `LuaInvokeAssemblyRewriter.cs`：

- 注入 `MethodInfo` + `RunLuaFuncVoidWithMethodInfo` / `RunLuaFuncGenericWithMethodInfo`；
- 使用 **`object[]`** 装箱参数。

**Mono D4：** 接入 typed bridge 的同一阶段 **同步删除** 此路径及 `RunLuaFunc(object[])` API。新代码 **不得** 依赖 legacy fallback。

若 typed bridge 解析失败，当前会尝试 legacy；目标态改为 **编译期 Error**（与 D3 Emit 失败策略一致）。

---

## 5. Player 路径

`RewritePlayerMethod`：

1. 清除 managed body；
2. 设置 `MethodImplAttributes.InternalCall`；
3. 设置 `ImplMap` 指向 Codegen 生成的 native 入口（`LuaInvokeStub.cpp`）。

Runtime：`luainvoke::RegisterGeneratedInternalCalls()` 在 `LuaAppDomain::Initialize` 注册。

---

## 6. 校验规则

`ValidateLuaInvokeMethod` 拒绝：

- 实例方法；
- 已有方法体（非 extern）；
- 声明在泛型类型上；
- 泛型方法。

`[LuaInvoke]` 构造参数必须非空 `moduleName` + `methodName`。

---

## 7. 与 Mono / Il2Cpp 的分工

| 组件 | 位置 |
|------|------|
| IL 改写 | `Editor/CodeGen/*`（**仅 Editor 构建**） |
| Typed bridge 实现 | `Runtime/Mono/Bridge/LuaInvoke/LuaInvokeBridge*.cs` |
| 站点表 | `LuaInvokeSiteRegistry.cs` |
| Player native | `generated/LuaInvokeStub.cpp` + `bridge/LuaInvokeHelper.cpp` |
| 引用导入 | `LuaInvokeMonoReferenceImporter.cs`（dnlib 解析 ZLua 程序集类型） |

Il2Cpp 包目录 `ZLua~/libil2cpp-2022` 不含 Weaver；Weaver 只处理 **用户程序集** C#。

---

## 8. 调试

- Weaver 失败时 ILPostProcessor 返回 `DiagnosticType.Error`，Unity Console 可见完整异常。
- 确认程序集引用 `ZLua` 且 `LuaInvokeBridge` 存在匹配签名的 partial 方法。
- Player 问题查 Codegen 是否生成对应 binding 及 IC 是否注册。

---

## 9. 相关文件

| 文件 | 职责 |
|------|------|
| `Editor/CodeGen/LuaInvokeILPostProcessor.cs` | Unity ILPP 入口 |
| `Editor/CodeGen/LuaInvokeAssemblyRewriter.cs` | 单方法改写逻辑 |
| `Editor/CodeGen/LuaInvokeWeaverFastPath.cs` | typed IL 生成 |
| `Editor/CodeGen/LuaInvokeBridgeCatalog.cs` | bridge 方法解析 |
| `Runtime/Mono/Bridge/LuaInvoke/LuaInvokeBridge.cs` | typed catalog 声明 |
| `Editor/CppCodeGen/LuaInvokeCodegen.cs` | Player stub |
