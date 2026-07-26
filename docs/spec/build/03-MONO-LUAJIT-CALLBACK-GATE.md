---
sidebar_position: 3
title: "Mono 回调 Gate"
---

# 构建 — Editor Mono：`lua_error` 与 Native Callback Gate

> 解决 **Unity Editor（`ZLua.Mono`）** 下，Lua→C# 回调帧上执行 `lua_error` / 不安全堆栈抓取导致的崩溃。  
> **适用于所有 Editor Lua 系列**（PUC-Rio 5.1–5.5 与 LuaJIT）。Il2Cpp Player **不**使用本 gate。  
> 引擎构建见 [01-OFFICIAL-LUA.md](01-OFFICIAL-LUA.md)、[02-LUAJIT.md](02-LUAJIT.md)；异常语义见 [10-LIFETIME.md](../10-LIFETIME.md) §8。  
> **不**修改 Lua / LuaJIT 上游；**不**改变 `pcall` 可见语义。

---

## 1. 问题

### 1.1 已观察到的现象

| 现象 | 说明 |
|------|------|
| LuaJIT Win64 + `lua_error` | SEH 穿过 Mono reverse-P/Invoke → SIGSEGV |
| PUC-Rio + 回调内 `Debug.Log`（带堆栈） | 活跃 `lua_pcall` 时抓堆栈可能 SIGSEGV；故有 `LuaPrintBuffer` 延迟刷出 |
| 团结等：回调内 `throw` | 外层 `lua_pcall` 仍活跃时托管异常 first-pass 可能 SIGSEGV |

统一协议：**托管从不 `lua_error`，由 native gate 抛出**（与延迟打印互补，不互相替代）。

### 1.2 根因摘要

| 引擎 | `lua_error` | 与 Mono reverse P/Invoke |
|------|-------------|---------------------------|
| **LuaJIT Win64** | **SEH** | 穿过托管帧 → 崩溃 |
| PUC-Rio | `longjmp` | 相对可容忍，但与堆栈抓取 / 部分 Mono 仍有风险 |

约束：**`lua_error` 不得在仍位于 Mono 托管 reverse-P/Invoke 的栈帧上执行。**

### 1.3 非目标方案

| 方案 | 为何不用作默认 |
|------|----------------|
| 改 LuaJIT 源码换展开方式 | 分叉成本高，升级困难 |
| 每回调包一层 Lua `__zlua_wrap_cs` + `error()` | 正确但热路径建表 / 多一帧 Lua，开销大 |
| Il2Cpp 同步改协议 | Il2Cpp 已在纯 C++ 顶层调 `lua_error`，且无 Mono 帧；**保持现状** |

---

## 2. 解决方案：Native Callback Gate

### 2.1 思路

把「真正执行 `lua_error`」挪到 **薄 native C 帧**，且该帧在 **托管回调已经 return 之后**：

```text
lua_pcall / Lua
  → zlua_callback_gate          ← native；仅此处可 lua_error
       → managed LuaCSFunction  ← 失败：push 错误对象 + return SENTINEL；禁止 lua_error
       ← return
  ← gate: 若 SENTINEL 则 lua_error(L)；否则原样返回 nrets
```

语义仍属「方案 A」：**托管不调用 `lua_error`**；与「Lua wrap 里 `error()`」等价，但成功路径几乎只有一次 C 间接调用。

### 2.2 Sentinel 协议

| | 约定 |
|--|------|
| 成功 | managed 返回正常 `nrets`（≥ 0，且 **≠** sentinel） |
| 失败 | managed `lua_push*` 错误对象到栈顶，然后 `return ZLUA_CALLBACK_ERROR_SENTINEL` |
| Sentinel 值 | `0xFFFF5A11`（实现常量；C 与 C# 必须一致） |
| Gate | `n == SENTINEL` → `lua_error(L)`；否则 `return n` |

### 2.3 Upvalue 布局

Gate 以 **CClosure** 形式注册；Lua 看到的可调用对象是 gate，不是裸 managed 函数指针。

| Upvalue | 含义 |
|---------|------|
| **1** | managed `lua_CFunction` 的 **lightuserdata**（函数指针） |
| **2..** | 原逻辑 upvalue（tag、类型句柄、程序集名等） |

Managed 通过 **直接 C 调用** 进入时，当前 CallInfo 仍是 **gate 的 CClosure**，故 `lua_upvalueindex(i)` 看到的是 gate 的 upvalue。因此：

- 逻辑 upvalue `k` 在 gated 模式下须读 **`lua_upvalueindex(k + 1)`**  
- 从 Lua 函数值上 `lua_getupvalue` 取第一个逻辑 upvalue 时，槽位为 **2**（而非 1）

`zlua_gate_init` 第三参为 **upvalue 伪索引基址**：5.1 / LuaJIT → `LUA_GLOBALSINDEX`；5.2+ → `LUA_REGISTRYINDEX`。

### 2.4 独立 DLL

Gate 编译为独立原生库，**不**链死某一版 Lua：

1. 已加载当前 `LUA_DLL` 之后  
2. `zlua_gate_init(lua_touserdata, lua_error, upvalue_pseudo_base)`  
3. `zlua_get_callback_gate()` → `lua_pushcclosure`

源码：`ZLua~/mono-native/`。Plugins 在 **Editor** 启用（**无** `ZLUA_USE_LUAJIT` 限定）。`ZLua.Mono` asmdef 仅 Editor，故自然仅 Editor。

构建步骤见 **§5**。

---

## 3. 托管侧义务（Editor 全系列）

### 3.1 注册入口

凡 Lua→C# 的 `pushcfunction` / `pushcclosure(managed, …)` **必须** 经 gate：

- `LuaCallbackGate.PushCFunction` / `PushCClosure`  
- 或等价封装（`ClosurePin`、`ZLuaLib.Register`、`LuaDllExtension.RegisterCallback`、元表 / 程序集索引等）

**禁止** 把裸 `Marshal.GetFunctionPointerForDelegate` 直接 `lua_pushcfunction` 到 Lua（`__gc` 等亦建议统一走 gate，避免遗漏错误路径）。

### 3.2 错误出口

| API | 行为 |
|-----|------|
| `LuaDllExtension.error` | `pushstring` + `return ErrorSentinel`（**不**调 `lua_error`） |
| `LuaCallbackBoundary.ToLuaError` | 同上（经 `error`） |
| `LuaCallbackBoundary.Throw` | **抛** `LuaScriptException`（由入口 `try/catch` 转为 sentinel） |

### 3.3 嵌套 C#→Lua 失败

外层已在 Lua→C# 回调中时，内层 `pcall` 失败若不能安全 `throw`，可经 `NestedLuaCallPendingError` 暂存；入口在 return 前 `TryTake` → `error` → sentinel，由 gate 抛出。与 gate 协议兼容。

### 3.4 初始化时机

在加载 Lua DLL 并创建 `lua_State` 之后、注册任何 gated 回调之前调用 `LuaCallbackGate.EnsureInitialized()`（例如 `LuaEnv` 构造早期）。

---

## 4. 作用范围

| 配置 | 是否启用 Gate |
|------|----------------|
| Editor + 任意 PUC / LuaJIT（`ZLua.Mono`） | **是** |
| Il2Cpp Player | **否** |

### 4.1 与 Il2Cpp 的对比

Il2Cpp 的 `zlua-runtime` 在调用 `lua_error` 时要求：**已处于可 longjmp 的 native 顶层，栈上无依赖 C++ 析构的对象**。该约束与 Mono×JIT 的 SEH 问题不同；**Il2Cpp 不引入本 gate。**

---

## 5. 如何构建 `zlua_mono_gate` 原生插件

Gate **不链接** Lua / LuaJIT；`lua_touserdata` / `lua_error` 在运行时由 C# `zlua_gate_init` 注入。改 `zlua_mono_gate.c` 或升级工具链后须重编并覆盖 Plugins 产物。

### 5.1 源码与脚本位置

包内相对路径：`Packages/com.code-philosophy.zlua/ZLua~/mono-native/`

| 文件 | 作用 |
|------|------|
| `zlua_mono_gate.c` | Gate 实现 |
| `build_zlua_mono_gate.ps1` | Windows x64 → `Plugins/x64/zlua_mono_gate.dll` |
| `build_zlua_mono_gate_unix.sh` | macOS / Linux → `Plugins/macOS/libzlua_mono_gate.dylib` 或 `Plugins/Linux/libzlua_mono_gate.so` |

`DllImport("zlua_mono_gate")` 由 Unity 映射到上述文件名（Windows 无 `lib` 前缀；Unix 为 `libzlua_mono_gate.*`）。

### 5.2 Windows Editor（x64）

**依赖：** Visual Studio（含 MSVC x64 工具集）、`vswhere` 可发现的 `vcvars64.bat`。

在仓库中执行（PowerShell）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File `
  Packages/com.code-philosophy.zlua/ZLua~/mono-native/build_zlua_mono_gate.ps1
```

脚本行为：

1. 调用 `vcvars64.bat`  
2. `cl /O2 /LD /MD` 先产出到 `mono-native/zlua_mono_gate_build.dll`（避免 `/Fe` 直写 `Plugins` 时偶发不更新）  
3. `Copy-Item -Force` 覆盖 `Plugins/x64/zlua_mono_gate.dll`  
4. 清理 `.obj` / `.exp` / `.lib` 中间文件  
5. 打印最终路径、大小与时间戳 — **请核对时间戳已变化**

成功后确认：

- 导出：`zlua_gate_init`、`zlua_get_callback_gate`、`zlua_callback_error_sentinel`  
- `zlua_gate_init` 为三参数：`(touserdata, lua_error, upvalue_pseudo_base)`  
- Unity Inspector 中该 DLL 启用 **Editor**、CPU **x86_64**（可无 `ZLUA_USE_LUAJIT` define 约束）

### 5.3 macOS Editor

在 **Mac** 上执行：

```bash
bash Packages/com.code-philosophy.zlua/ZLua~/mono-native/build_zlua_mono_gate_unix.sh
```

产出：`Plugins/macOS/libzlua_mono_gate.dylib`（`clang -shared -fPIC -O2 -dynamiclib`）。  
为 Apple Silicon / Intel 准备对应 `.meta` 的 CPU / 目录布局（可参考包内其它 OSX 插件）。

### 5.4 Linux Editor

在 **Linux** 上执行同一脚本：

```bash
bash Packages/com.code-philosophy.zlua/ZLua~/mono-native/build_zlua_mono_gate_unix.sh
```

产出：`Plugins/Linux/libzlua_mono_gate.so`（`gcc -shared -fPIC -O2`）。

### 5.5 维护注意

| 项 | 说明 |
|----|------|
| ABI | 改 `zlua_gate_init` 形参或 sentinel 后，须同步改 C# `LuaCallbackGate` 并重编本插件 |
| 不链 Lua | 切 `lua53` / `luajit21` 等 **不必** 为每套 Lua 各编一份 gate |
| 验证覆盖 | Windows 上若脚本报 Built 但 `Plugins` 文件时间戳未变，视为失败；以 §5.2 的 stage+copy 脚本为准 |
| 提交 | 将更新后的二进制与 `.meta` 一并纳入版本库（或文档约定由 CI 产出） |

---

## 6. 实现索引（包内）

| 组件 | 路径（包内相对） |
|------|------------------|
| Gate C 源 | `ZLua~/mono-native/zlua_mono_gate.c` |
| 编译脚本 | `ZLua~/mono-native/build_zlua_mono_gate.ps1` / `build_zlua_mono_gate_unix.sh` |
| 原生插件 | `Plugins/**/zlua_mono_gate*`（`DllImport("zlua_mono_gate")`） |
| C# 门面 | `Runtime/Mono/Utils/LuaCallbackGate.cs` |
| 错误边界 | `Runtime/Mono/Utils/LuaCallbackBoundary.cs`、`LuaDllExtension.error` |
| 注册汇聚 | `ClosurePin`、`ZLuaLib`、`AssemblyRegistry`、`TypeRegistry*` 等 |

---

## 7. 验收要点

- [ ] 已按 §5 重编并覆盖 Plugins 产物（时间戳 / 哈希已更新）  
- [ ] PUC 与 LuaJIT 下，回调错误路径 `pcall` 可捕获且 Editor 不崩  
- [ ] 成功热路径（字段 get、方法调用）行为正常  
- [ ] 带逻辑 upvalue 的闭包在 5.1 / JIT 与 5.2+ 下均正确  
- [ ] 未加载 Lua DLL / 未 `gate_init` 时，首次 Push 抛明确异常，而非静默崩溃  

---

## 8. 相关文档

| 文档 | 关系 |
|------|------|
| [01-OFFICIAL-LUA.md](01-OFFICIAL-LUA.md) / [02-LUAJIT.md](02-LUAJIT.md) | 引擎构建 |
| [10-LIFETIME.md](../10-LIFETIME.md) §8 | C#↔Lua 异常对外语义 |
| 实现 `LuaPrintBuffer` | 延迟 `Debug.Log`（与 gate 互补） |
| 包内 `Plugins/README.md` | 插件文件名速查 |
