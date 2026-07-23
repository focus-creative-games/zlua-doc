---
sidebar_position: 2
title: "宿主 API"
---

# 01 — 宿主 API

> `LuaAppDomain`、**`[LuaInvoke]`**、**`[LuaMarshalAs]`**、**`[LuaAlias]`** 与编译期 Weaver 约束。  
> C#→Lua / Lua→C# 编组细节见 [marshal/](marshal/)；Weaver 实现见 [impl/codegen/WEAVER.md](../impl/codegen/WEAVER)。

---

## 1. `LuaAppDomain`

### 1.1 职责

`ZLua.LuaAppDomain` 是宿主唯一推荐的初始化门面，将调用转发至当前后端：

| 环境 | 后端类型 | 程序集 |
|------|----------|--------|
| Editor | `ZLua.LuaMonoAppDomain` | `ZLua.Mono` |
| Player | `ZLua.LuaIl2CppAppDomain` | `ZLua.Il2Cpp` |

```csharp
public static class LuaAppDomain
{
    public static void Initialize(Func<string, object> moduleLoader);
    internal static void ProcessPendingRefReleases(); // 由 LuaFramePump 驱动
}
```

### 1.2 模块加载器

`moduleLoader(moduleName)` 由宿主提供，返回 Lua 模块源码（通常为 `string`）。native 通过 `__zlua_load_module` 与 package.searchers 集成。

**约定：**

- 模块名与 `[LuaInvoke("module", "func")]` 中的 module 字符串一致
- loader 失败应抛出明确异常，避免 silent nil

### 1.3 帧泵

`LuaAppDomain.Initialize` 注册 `LuaFramePump`，在 Unity `Update` 等时机调用 `ProcessPendingRefReleases`，处理 delegate / Lua ref 等延迟释放。详见 [10-LIFETIME.md](10-LIFETIME.md)。

---

## 2. `[LuaInvoke]` — C# 调用 Lua

### 2.1 声明形式

```csharp
[LuaInvoke("game", "OnTick")]
public static extern void OnTick(float dt);

[LuaInvoke("game", "GetScore")]
public static extern int GetScore();
```

属性定义（`ZLua.Common`）：

```csharp
[AttributeUsage(AttributeTargets.Method, AllowMultiple = false)]
public sealed class LuaInvokeAttribute : Attribute
{
    public string Module { get; }
    public string Function { get; }
    public LuaInvokeAttribute(string module, string function);
}
```

构造函数 **必须** 提供非空 `moduleName` 与 `methodName`（对应 Lua 模块全局函数名）。

### 2.2 编译期约束（Weaver 强制）

| 规则 | 违反时 |
|------|--------|
| 必须为 **`static`** | 编译失败 |
| 必须为 **`extern`**（无方法体） | 编译失败 |
| 不得位于 **泛型类型** 上 | 编译失败 |
| 方法本身不得为 **泛型方法** | 编译失败 |
| **`ref` / `in` / `out` 形参允许** | — |

> **已移除：** Editor 下通过 `RunLuaFunc(..., object[])` 反射调 Lua 的路径。新 Mono 重写使用 **per-signature Emit 桥**（与 Il2Cpp stub 语义对齐），不再文档化 `object[]` 慢路径。

### 2.3 Editor（Mono）改写

编译游戏程序集后，`LuaInvokeILPostProcessor`（dnlib）处理带 `[LuaInvoke]` 的方法：

1. 校验 §2.2 约束
2. 解析 `(moduleName, methodName)`
3. 优先：**Emit 快路径** — 改写方法体为调用 `LuaInvokeBridge` / `LuaInvokeSiteRegistry.GetOrCreateFunctionRef`，再 invoke 生成桥
4. 兜底：legacy `MethodInfo` + `RunLuaFunc`（过渡；新代码应使用 Emit 路径）
5. 添加 `[LuaInvokeWeaverProcessed]` 标记

参数与返回值编组与普通 C#→Lua 相同，见 [marshal/01-OVERVIEW.md](marshal/01-OVERVIEW.md)。**`ref` / `in` / `out` 默认 Push OpaqueValue**（[marshal/04-OPAQUE.md](marshal/04-OPAQUE.md)）。

### 2.4 Player（Il2Cpp）改写

非 Editor 构建时：

1. 移除 `[LuaInvoke]` 特性（可选，以实现为准）
2. 设置 `[MethodImpl(MethodImplOptions.InternalCall)]`
3. C++ 侧生成对应 extern stub，经 `LuaInvokeHelper` 调 Lua

Il2Cpp C# 层仅保留薄壳：

```csharp
public static class LuaIl2CppAppDomain
{
    [MethodImpl(MethodImplOptions.InternalCall)]
    private static extern void InitializeInternal(Func<string, object> moduleLoader);

    public static void Initialize(Func<string, object> moduleLoader)
        => InitializeInternal(moduleLoader);
}
```

### 2.5 调用流程（概念）

```
C# [LuaInvoke] 入口
  → marshal 参数（含 ref → OpaqueValue）
  → native: 按 module+function 取 lua ref
  → lua_pcall
  → marshal 返回值 / ref 写回
  → 异常边界转换（§6）
```

---

## 3. `[LuaMarshalAs]` — 编组标注

### 3.1 作用范围

| 可标注位置 | 说明 |
|------------|------|
| **参数** | 控制 Lua↔C# 该形参的 Push/Pop |
| **返回值** | 控制 C#→Lua 返回 Push |
| **字段 / 属性** | 控制成员读写时的 marshal（codegen 消费） |

**禁止**标注在 **方法** 上（绑定期 `LuaMarshalAsConfigurationException`）。

完整选项见 [marshal/02-MARSHAL-AS.md](marshal/02-MARSHAL-AS.md)。

### 3.2 常用选项（概要）

| `LuaMarshalType` | 用途 |
|------------------|------|
| `Default` | 按类型默认规则 |
| `OpaqueValue` | C#→Lua 强制 opaque lightuserdata（by-val 引用类型 / struct） |
| `ParamsTable` | `params T[]` 接受单个 Lua table |
| `Table` / `UnpackedValues` | struct / class 从 table 或多栈参数组装（须 `FieldOrPropertyNames`） |

**默认规则摘要：**

- C#→Lua **`ref`/`in`/`out`** → **OpaqueValue**（无需再标）
- by-val 基元 / enum → Lua boolean / integer / number / string
- class → ByObj userdata；struct → ByVal 或 Handle（见 struct 分册）

### 3.3 校验时机

非法组合在 **Bind 期 / Weaver 期** 失败（`LuaMarshalAsConfigurationException`），不延迟到首次 Lua 调用。

---

## 4. `[LuaAlias]` — 方法 Lua 别名

```csharp
[LuaAlias("run_i32")]
public void Run(int value) { ... }

[LuaAlias("Foo")]   // 允许与已有方法名 / 其它别名重复
public void Bar(string s) { ... }
```

- 定义于 `ZLua.Common`
- **等价于**用该字符串作为最终 Lua 名再注册一次该方法（默认名 `MethodInfo.Name` 仍然注册）
- **允许**与其它别名或已有方法名重复；重复时该最终名下多候选，调用走 **重载分派**（见 [04-METHOD-OVERLOAD.md](04-METHOD-OVERLOAD.md) §5）
- 若某最终名下仅此一候选（例如独立的 `run_i32`），则为 **direct closure**

完整规则见 [04-METHOD-OVERLOAD.md](04-METHOD-OVERLOAD.md) §3、§5。

---

## 5. Lua→C#：无需 `[MonoLuaCallback]`

Lua 调用 C# 成员时，native 在 **EnsureBinding** 阶段为每个 public 成员生成桥接 closure 并写入三表。**不需要**也 **不提供** 业务侧 `[MonoLuaCallback]` 标记。

每种 **ReducedType（Il2Cpp）** 或 **完整签名（Mono Emit）** 对应唯一桥接入口；与 `[LuaInvoke]` 无关。

---

## 6. 异常边界

### 6.1 C# 调 Lua

| 方向 | 行为 |
|------|------|
| Lua `error()` | 捕获为 C# 异常（`LuaException` 或包装类型）；**不**泄漏未处理 native longjmp 到托管栈外 |
| C# 异常传入 native | 在边界转换为 Lua error 或记录后 rethrow（实现统一） |

脚本 **不应** 依赖 pcall 内捕获 C# 异常的具体类型字符串；仅保证「失败可检测」。

### 6.2 Lua 调 C#

| 方向 | 行为 |
|------|------|
| C# 抛异常 | 转换为 **`luaL_error`** 等价消息；Mono / Il2Cpp 文案一致或等价 |
| Lua 侧 | 使用 `pcall` 捕获错误字符串 |

### 6.3 Opaque 与边界

Opaque handle **仅在** 产生它的那次 C#→Lua 调用返回前有效；跨 `pcall` 保存后再用 → error。见 [marshal/04-OPAQUE.md](marshal/04-OPAQUE.md)、[10-LIFETIME.md](10-LIFETIME.md)。

---

## 7. Weaver 与 Codegen 约束（摘要）

| 项 | 约束 |
|----|------|
| `[LuaInvoke]` | §2.2；Player → InternalCall |
| `[LuaAlias]` | 允许与默认名 / 其它别名重复；按最终名分组（见 overload §5） |
| `[LuaMarshalAs]` | 禁止 method 级；非法 FieldOrPropertyNames → bind 失败 |
| Mono Emit | 无法 Emit 的签名 **必须显式失败**，禁止 silent `Method.Invoke` 热路径 |
| Il2Cpp stub | 未覆盖签名 → 构建期或首次绑定失败 |

Editor 程序集处理入口：`LuaInvokeILPostProcessor`（`Unity.ZLua.LuaInvoke.CodeGen`）。

---

## 8. 相关文档

| 文档 | 内容 |
|------|------|
| [00-OVERVIEW.md](00-OVERVIEW.md) | 双运行时、初始化 |
| [04-METHOD-OVERLOAD.md](04-METHOD-OVERLOAD.md) | dispatch、`register_method` |
| [marshal/01-OVERVIEW.md](marshal/01-OVERVIEW.md) | 编组总览 |
| [10-LIFETIME.md](10-LIFETIME.md) | GC、单 lua_State |
| [impl/codegen/WEAVER.md](../impl/codegen/WEAVER) | dnlib / ILPP 细节 |
