---
sidebar_position: 2
title: "宿主 API"
---

# 01 — 宿主 API

> `LuaAppDomain`（含 **`GetFunction`**）、**`[LuaMarshalAs]`**、**`[LuaAlias]`**。  
> C#→Lua / Lua→C# Marshal 细节见 [marshal/](/docs/spec/marshal/)。

---

## 1. `LuaAppDomain`

### 1.1 职责

`ZLua.LuaAppDomain` 是宿主唯一推荐的初始化门面。后端通过 **`ILuaRuntime` + `LuaAppDomain.SetRuntime`** 注册（反转依赖，Common 不引用 Mono/Il2Cpp）：

| 环境 | 后端 | 程序集 | 注册时机 |
|------|------|--------|----------|
| Editor | `LuaMonoAppDomain` | `ZLua.Mono` | `RuntimeInitializeOnLoadMethod(SubsystemRegistration)` |
| Player | `LuaIl2CppAppDomain` | `ZLua.Il2Cpp` | 同上（`#if !UNITY_EDITOR`，避免 Editor 双注册） |

```csharp
public interface ILuaRuntime
{
    void Initialize(Func<string, object> moduleLoader);
    void ProcessPendingRefReleases();
}

public static class LuaAppDomain
{
    public static void SetRuntime(ILuaRuntime runtime); // 由后端程序集调用

    public static void Initialize(Func<string, object> moduleLoader);

    public static T GetFunction<T>(string luaModule, string luaMethodName)
        where T : MulticastDelegate;

    internal static void ProcessPendingRefReleases(); // 由 LuaFramePump 驱动
}
```

### 1.2 模块加载器

`moduleLoader(moduleName)` 由宿主提供，返回 Lua 模块源码（通常为 `string`）。native 通过 `__zlua_load_module` 与 package.searchers 集成。

**约定：**

- 模块名与 `GetFunction` 的 `luaModule` 字符串一致
- loader 失败应抛出明确异常，避免 silent nil

### 1.3 帧泵

`LuaAppDomain.Initialize` 注册 `LuaFramePump`，在 Unity `Update` 等时机调用 `ProcessPendingRefReleases`，处理 delegate / Lua ref 等延迟释放。详见 [10-LIFETIME.md](/docs/spec/10-LIFETIME/)。

---

## 2. `GetFunction` — C# 调用 Lua

C#→Lua 的 **唯一正式入口**：按模块名与方法名取得绑定好的 **Delegate**，再由调用方 `Invoke`（或直接调用）。

### 2.1 签名

```csharp
public static T GetFunction<T>(string luaModule, string luaMethodName)
    where T : MulticastDelegate;
```

| 参数 | 说明 |
|------|------|
| `luaModule` | 非空；交给 `moduleLoader` / `require` 的模块名 |
| `luaMethodName` | 非空；模块 `return { ... }` 表中的键名 |
| `T` | 具体委托类型（如 `Action`、`Action<float>`、`Func<int,int,int>`） |

### 2.2 行为

1. 按 `luaModule` 加载（或命中已加载）模块表  
2. 取 `module[luaMethodName]`，须为 Lua `function`  
3. 按 `T` 的签名将 function **Marshal** 为 closed delegate（规则同 [marshal/09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/)）  
4. 返回该 `T` 实例  

**缓存：** API **不保证**跨调用复用同一 delegate 实例；热路径由调用方自行保存（字段 / 局部变量）。须在 `Initialize` **之后**再调用（例如 `Awake`）；**勿**放在与 `RuntimeInitializeOnLoadMethod` 同类型的 static 字段初始化器中。

### 2.3 示例

```csharp
// 一次性 / 启动期取得
var add = LuaAppDomain.GetFunction<Func<int, int, int>>("app", "add");
int sum = add(10, 20);

var onTick = LuaAppDomain.GetFunction<Action<float>>("game", "OnTick");
onTick(0.016f);
```

```lua
-- app.lua
local function add(a, b) return a + b end
return { add = add }
```

### 2.4 错误

| 条件 | 行为 |
|------|------|
| 未 `Initialize` / loader 未配置 | 抛 C# 异常 |
| 模块加载失败 / 键不存在 / 非 function | 抛 C# 异常（含可诊断信息） |
| `T` 无法从该 function 绑定（签名不兼容等） | 抛 C# 异常 |

### 2.5 调用与 Marshal

对返回的 delegate 执行 `Invoke` 时：

- 参数 / 返回值 Marshal 与普通 **C#→Lua（delegate bridge）** 相同，见 [marshal/01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/)
- **`ref` / `in` / `out` 默认 Push OpaqueValue**（[marshal/04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/)）

### 2.6 流程（概念）

```
GetFunction<T>(module, method)
  → require / 取模块表
  → 取 Lua function
  → Marshal 为 T
  → 返回 T

此后：T.Invoke(...)
  → marshal 参数（含 ref → OpaqueValue）
  → lua_pcall
  → marshal 返回值 / ref 写回
  → 异常边界转换（§6）
```

Il2Cpp C# 层初始化仍为薄壳（与 `GetFunction` 无关）：

```csharp
public static class LuaIl2CppAppDomain
{
    [MethodImpl(MethodImplOptions.InternalCall)]
    private static extern void InitializeInternal(Func<string, object> moduleLoader);

    public static void Initialize(Func<string, object> moduleLoader)
        => InitializeInternal(moduleLoader);
}
```

---

## 3. `[LuaMarshalAs]` — Marshal 标注

### 3.1 作用范围

| 可标注位置 | 说明 |
|------------|------|
| **参数** | 控制 Lua↔C# 该形参的 Push/Pop |
| **返回值** | 控制 C#→Lua 返回 Push |
| **字段 / 属性** | 控制成员读写时的 marshal（codegen 消费） |

**禁止**标注在 **方法** 上（绑定期 `LuaMarshalAsConfigurationException`）。

完整选项见 [marshal/02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/)。

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

非法组合在 **Bind 期** 失败（`LuaMarshalAsConfigurationException`），不延迟到首次 Lua 调用。

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
- **允许**与其它别名或已有方法名重复；重复时该最终名下多候选，调用走 **重载分派**（见 [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §5）
- 若某最终名下仅此一候选（例如独立的 `run_i32`），则为 **direct closure**

完整规则见 [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §3、§5。

---

## 5. Lua→C#：无需 `[MonoLuaCallback]`

Lua 调用 C# 成员时，native 在 **EnsureBinding** 阶段为每个 public 成员生成桥接 closure 并写入三表。**不需要**也 **不提供** 业务侧 `[MonoLuaCallback]` 标记。

每种 **ReducedType（Il2Cpp）** 或 **完整签名（Mono Emit）** 对应唯一桥接入口。

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

Opaque handle **仅在** 产生它的那次 C#→Lua 调用返回前有效；跨 `pcall` 保存后再用 → error。见 [marshal/04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/)、[10-LIFETIME.md](/docs/spec/10-LIFETIME/)。

---

## 7. Codegen 约束（摘要）

| 项 | 约束 |
|----|------|
| `[LuaAlias]` | 允许与默认名 / 其它别名重复；按最终名分组（见 overload §5） |
| `[LuaMarshalAs]` | 禁止 method 级；非法 FieldOrPropertyNames → bind 失败 |
| Mono Emit | 无法 Emit 的签名 **必须显式失败**，禁止 silent `Method.Invoke` 热路径 |
| Il2Cpp stub | 未覆盖签名 → 构建期或首次绑定失败（MethodBridge 等，见 `impl/codegen/`） |

C#→Lua **不**依赖 IL weave / 专用 stub：经 `GetFunction` → Delegate 桥完成。

---

## 8. 相关文档

| 文档 | 内容 |
|------|------|
| [00-OVERVIEW.md](/docs/spec/00-OVERVIEW/) | 双运行时、初始化 |
| [04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) | dispatch、`register_method` |
| [marshal/01-OVERVIEW.md](/docs/spec/marshal/01-OVERVIEW/) | Marshal 总览 |
| [marshal/09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/) | Delegate ↔ Lua function |
| [10-LIFETIME.md](/docs/spec/10-LIFETIME/) | GC、单 lua_State |
| [reference/csharp/lua-app-domain.md](/docs/reference/csharp/lua-app-domain/) | 程序员 API 页 |
