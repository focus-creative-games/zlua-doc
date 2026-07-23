---
sidebar_position: 7
title: "MethodOverloadResolver 实现"
---

# MethodOverloadResolver 实现

> **Il2Cpp：** `marshal/MethodOverloadResolver.cpp`  
> **Mono：** Phase 3 `Emit/` + 计划中的 managed resolver（语义对齐）  
> **规范权威：** [../../spec/04-METHOD-OVERLOAD.md](../../spec/04-METHOD-OVERLOAD) — 本文只描述 runtime 数据结构与 C++ 落点

---

## 1. 调用链

1. Lua 调用 **dispatch closure**（非 direct method closure）。
2. Dispatch closure upvalue 携带 `MethodGroups*`（`MetaBinding::CreateMethodDispatchClosureRef`）。
3. `MethodOverloadResolver::Resolve(L, groups, argStart, argCount)` 返回唯一 `MethodMarshalCtx*` 或报错。
4. `MethodBridge::InvokeLua2Cs(L, target, argStart, ctx)` 执行选中重载。

Direct closure（单重重载）**不**经过 Resolver。

---

## 2. `MethodGroups` 桶结构

定义于 `MarshalDefs.h`：

```cpp
constexpr size_t kMaxSmallArgCount = 4;

struct MethodGroup {
    const MethodMarshalCtx** methods;
    size_t methodCount;
};

struct MethodGroups {
    const MethodGroup* smallArgCountMethodGroups[kMaxSmallArgCount + 1];
    const MethodMarshalCtx** largeArgCountMethods;
    size_t largeArgCountMethodCount;
};
```

**绑定期分桶：** 按 **参数个数**（不含 `this`）将同名重载分组。Resolve 时先 O(1) 取 `groups->smallArgCountMethodGroups[argCount]`，若为空再查 `largeArgCountMethods` 线性扫描。

同一 argCount 桶内顺序 = Codegen 声明顺序（spec §3.2 tie-break 用）。

---

## 3. `ConversionKind` 与 Better Match

```cpp
enum class ConversionKind : uint8_t {
    None, Identity, ImplicitNumeric, ImplicitEnum, NullLiteral,
    ImplicitReference, ImplicitExtendedInteger, ImplicitBoxing,
    ImplicitArray, NotConvertible,
};

struct MethodOverloadResolutionResult {
    MethodOverloadResolutionKind kind;  // None / BestMatch / Ambiguous
    const MethodMarshalCtx* method;
};
```

`GetConversionKind(L, stackIndex, paramMeta)`（`MethodOverloadResolver.cpp`）：

- 读 Lua 栈类型 + `MarshalMetaInfo` 的目标 `Il2CppType*`；
- 返回该实参到形参的转换类别；
- 与 spec §3.3 / §3.6 **better function member** 规则一致（Identity 优于 ImplicitBoxing 等）。

**逐参比较：** 对桶内每个 candidate 检查 applicability；在 applicable 集合中选最优；同分用声明顺序。

---

## 4. `Resolve` 算法概要

```cpp
MethodOverloadResolutionResult MethodOverloadResolver::Resolve(
    lua_State* L, const MethodGroups* groups, int32_t argStart, int32_t argCount)
{
    // 1. 按 argCount 取 MethodGroup*
    // 2. 遍历 methods[]：
    //    - 参数个数 / params 数组 / optional 规则
    //    - 每参 GetConversionKind；NotConvertible → 跳过
    //    - CompareConversionKind 更新 best / ambiguous
    // 3. BestMatch → 返回 method；Ambiguous → luaL_error；None → luaL_error
}
```

错误消息前缀 `zlua:`，与 Mono 目标一致（spec §7）。

---

## 5. 与 `MethodMarshalCtx` 的配合

每个候选重载在 Bind 期已有独立 `MethodMarshalCtx`（含 `paramsMeta[]`、`retMeta`、`lua2CsInvoker` stub）。

Resolver **只选** ctx，不重新 marshal；选中后：

```cpp
MethodBridge::InvokeLua2Cs(L, target, argStart, ctx);
```

虚调：`MetadataUtil::ResolveInvokeMethod(ctx->method, target, ctx->sealed)` 在 `InvokeLua2Cs` 内处理。

---

## 6. 构造 overload

类型 `SMT.__call` 使用同一 `MethodGroups` / Resolver 机制，ctx 来自 `.ctor` 重载集合（`TypeBinding::ctorGroups`），argStart 跳过类型表 `this`（静态构造无 this）。

Mono Phase 3：`ConstructorEmitter` 已替换 `ConstructorNotReady`；当前按 **arity 先到先得**，完整 better-member Resolver 仍待接入。

---

## 7. 别名、`register_method` 与 Resolver

规范：

| 来源 | 撞名策略 |
|------|----------|
| Bind 期默认名 + `[LuaAlias]` | **允许**；按最终名聚合进 `MethodGroups` |
| 运行时 `register_method` | **禁止**占用已有 method / overload 组名；仅空位挂 direct |

| 机制 | 实现落点 |
|------|----------|
| 单候选 → direct closure | `MetaBinding::CreateDirectMethodClosureRef` |
| 多候选 → dispatch | `CreateMethodDispatchClosureRef` → Resolver |
| `[LuaAlias]` | Bind 期并入对应最终名的 `MethodGroups` |
| `register_method` | 名已存在 → error；否则写入 method map / 索引表（direct closure） |

别名键仅在该最终名 **只有一个候选** 时为 O(1) direct；Bind 期撞名则走 Resolver。

---

## 8. 已知限制（代码现状）

| 项 | 状态 |
|----|------|
| `byref` 参数 | `GetConversionKind` 中 `FIXME: handle byref`；当前仅 lightuserdata Identity |
| 静态 generic method | `InvokeMethodDirectGeneric` → 显式 error |
| `[LuaMarshalAs(ParamsTable)]` | 需与 params 打包规则同步（见 spec §3.3） |

实现或修复时须同步更新 spec 测试与 Mono Emit。

---

## 9. Mono 对齐计划

Phase 3 Emit 将为多重载方法生成：

1. dispatch Lua/C# closure（捕获 `MethodGroups` 等价结构）；
2. managed `MethodOverloadResolver.Resolve`（镜像 `ConversionKind` 枚举与比较规则）；
3. 选中后跳转到 **该重载专用** Emit bridge（非 `Method.Invoke`）。

验收：与 Il2Cpp 对同一 Lua 调用选中相同重载（含 tie-break）。

---

## 10. 相关文件

| 文件 | 职责 |
|------|------|
| `marshal/MethodOverloadResolver.cpp/.h` | Resolve、GetConversionKind |
| `marshal/MarshalDefs.h` | MethodGroups、ConversionKind |
| `mt/MetaBinding.cpp` | 构建 groups、dispatch closure |
| `bridge/MethodBridge.cpp` | InvokeLua2Cs |
| `Editor/CppCodeGen/AotMethodAnalyzer.cs` | 构建期重载元数据顺序 |

规范详述：[../../spec/04-METHOD-OVERLOAD.md](../../spec/04-METHOD-OVERLOAD)
