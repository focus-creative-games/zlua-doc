---
sidebar_position: 4
title: "EmmyLua 调试器"
---

# 构建 — Editor Mono：EmmyLua 调试器

> 约定 ZLua **Editor（`ZLua.Mono`）** 如何接入 **EmmyLua `emmy_core`**，使 VS Code / JetBrains 等 IDE 可对运行中的 Lua 断点调试。  
> **上游仓库：** [EmmyLua/EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger)（构建选项、用法以该仓库 README / docs 为准）。  
> **不**改变 Lua 可见互操作语义；**不**覆盖 Il2Cpp Player。  
> 异常边界见 [03-MONO-LUAJIT-CALLBACK-GATE.md](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/)；宿主入口见 [01-HOST-API.md](/docs/spec/01-HOST-API/)；多版本见 [11-MULTI-VERSION.md](/docs/spec/11-MULTI-VERSION/)。

---

## 1. 目标与非目标

### 1.1 目标

| 项 | 约定 |
|----|------|
| 宿主 | Unity **Editor** + `ZLua.Mono`，单一 `lua_State` |
| 调试库 | **EmmyLua `emmy_core`**（[EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger)）；按 **Lua 系列 + OS/Arch** 分目录 |
| IDE | EmmyLua 协议客户端（VS Code EmmyLua 扩展、Rider 等） |
| 连接 | Lua 侧 **`tcpListen`**；IDE **Attach** 到约定端口 |
| 开关 | Project Settings（`ZLua.Settings`）显式开启；**默认关闭** |
| 随附范围 | **Windows** / **macOS**：`lua51`–`lua55` 与 **`luajit`**；**Linux**：目前仅 **`lua55`**（`linux-x64`） |

### 1.2 非目标

| 项 | 态度 |
|----|------|
| Il2Cpp Player / 真机调试 | **本规范不覆盖**（后续若做须另文） |
| WebGL | **不支持**（无可用 TCP attach 模型） |
| 自研 DAP Adapter | **不做**；协议与 UI 由 EmmyLua IDE 扩展承担 |
| C#↔Lua 混合调用栈美化 | **不做**（仅 Lua 栈由 Emmy 呈现） |
| 业务脚本手写 `require('emmy_core')` | **非必需**；由宿主统一注入（仍允许高级用户手动调用） |
| 为 Linux 预编译全部系列 | **不做**（除 `lua55`）；其它系列须按上游文档自建（见 §3.2） |

---

## 2. 架构

```text
IDE (EmmyLua)
    ↕ Emmy 调试协议 / TCP
emmy_core（Lua C 模块，由 require 加载）
    ↕ debug.sethook / 调试 API
ZLua 唯一 lua_State（Editor Mono）
```

| 层 | 职责 |
|----|------|
| **Settings** | `enableDebugger`、端口、是否 `waitIDE` |
| **`LuaMonoAppDomain.Initialize`** | 初始化完成后若开启则调用 `LuaEnv.StartDebugger` |
| **`LuaEnv.StartDebugger`** | 拼接 `package.cpath` → `require('emmy_core')` → `tcpListen` → 可选 `waitIDE` |
| **`Plugins/emmylua/**`** | 仅作为 **磁盘上的原生模块文件**；**禁止**由 Unity PluginImporter 自动加载 |

---

## 3. 包内布局、自建与 PluginImporter

### 3.1 系列目录命名（强制）

一级目录名与 Editor 原生库逻辑名一致（见 [11-MULTI-VERSION.md](/docs/spec/11-MULTI-VERSION/)）：

| 引擎 | 目录名规则 | 示例 |
|------|------------|------|
| **PUC-Rio（官方 Lua）** | `lua{major}{minor}` | Lua 5.5.x → **`lua55`**；5.4.x → **`lua54`**；5.3.x → **`lua53`** |
| **LuaJIT** | **`luajit`**（不区分 2.0 / 2.1） | 任意 `luajit-2.x` → **`luajit/`** |

同一 **大版本系列** 共用一份 `emmy_core`（例如所有 `lua-5.3.*` 共用 `lua53/`；**所有 LuaJIT 2.x 共用 `luajit/`**），**不必**按 patch / JIT 小版本分别构建。

平台子目录（二级）：

| Editor | 子目录 | 文件 |
|--------|--------|------|
| Windows x64 | `win32-x64` | `emmy_core.dll` |
| macOS arm64 | `darwin-arm64` | `emmy_core.dylib` |
| macOS x64 | `darwin-x64` | `emmy_core.dylib` |
| Linux x64 | `linux-x64` | `emmy_core.so` |

完整路径示例（本包当前随附情况）：

```text
Packages/com.code-philosophy.zlua/Plugins/emmylua/
├── lua51/{win32-x64,darwin-arm64,darwin-x64}/…
├── lua52/{win32-x64,darwin-arm64,darwin-x64}/…
├── lua53/{win32-x64,darwin-arm64,darwin-x64}/…
├── lua54/{win32-x64,darwin-arm64,darwin-x64}/…
├── lua55/{win32-x64,darwin-arm64,darwin-x64,linux-x64}/…
└── luajit/{win32-x64,darwin-arm64,darwin-x64}/…   # Emmy -DEMMY_LUA_VERSION=jit；2.0/2.1 共用
```

运行时按 **当前 Editor 编译 define** 选择目录：PUC → `lua{major}{minor}`；任意 LuaJIT → **`luajit`**。**不是**探测 DLL 内嵌 ABI。Editor 宿主 DLL 仍可为 `luajit20.dll` / `luajit21.dll`（与 emmy 目录名无关）。

### 3.2 本包随附范围与自建

| 系列 | Windows `win32-x64` | macOS `darwin-arm64` / `darwin-x64` | Linux `linux-x64` |
|------|---------------------|-------------------------------------|-------------------|
| `lua51` … `lua55` | **随附** | **随附** | 仅 **`lua55` 随附**；其余自建 |
| `luajit`（2.0/2.1 共用） | **随附** | **随附** | **不随附**；自建 |

上游仓库：[EmmyLua/EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger)（本地亦可对照 `3rd/EmmyLuaDebugger`）。

**Windows 本包构建约定（维护者）：**

```bat
cmake -G "Visual Studio 17 2022" -A x64 ^
  -DCMAKE_USER_MAKE_RULES_OVERRIDE=<repo>/cmake/flags_override.cmake ^
  -DEMMY_LUA_VERSION=<51|52|53|54|55|jit> ^
  -DEMMY_CORE_VERSION=zlua ..
cmake --build . --config Release --target emmy_core
```

将 `emmy_core/Release/emmy_core.dll` 拷到 `Plugins/emmylua/<series>/win32-x64/`，并为 DLL / 目录编写 Unity `.meta`：`PluginImporter` **全平台 `enabled: 0`**（含 Editor）。  
`jit` 产物放入唯一目录 **`luajit/win32-x64/`**（Emmy **不**区分 JIT 2.0 / 2.1；**不要**再编一份「luajit21」专用 `emmy_core`）。

**macOS 本包构建约定（维护者）：** 在 Mac 上按上游文档对 `EMMY_LUA_VERSION=51…55|jit` 分别编 `arm64` / `x86_64`，产物放入 `darwin-arm64` / `darwin-x64`；PluginImporter 同样全禁用。源码模式可用 `-DEMMY_USE_LUA_SOURCE=ON`。Lua 5.1 源码模式下若缺 `LUA_NUMTAGS`，须在 Emmy 侧兼容（本包已随附的 `lua51` darwin 二进制已处理）。

**Linux、或需更换 Emmy 版本时：** 阅读上游 README「Build Options」，对目标 OS/Arch 自建后放入 §3.1 对应目录；PluginImporter 同样全禁用。本包 Windows 随附二进制可与官方 CI 一致（默认 **不**开 `EMMY_USE_LUA_SOURCE`，运行时动态解析宿主 Lua API）；macOS 随附多为源码模式构建。

ZLua Install **不**自动编译 EmmyLuaDebugger。

### 3.3 缺失目录

`StartDebugger` 在注入脚本 **之前** 检查 `Plugins/emmylua/<series>/` 及当前 OS/Arch 子目录是否存在：

- **不存在** → `Debug.LogError` 说明期望路径（可提示 Linux 非 `lua55` 等需自建），**跳过调试器，不抛异常**（不中断 `Initialize`）  
- **存在** → 再 `require('emmy_core')`；`require`/listen 失败同样只打日志，不抛到宿主  

### 3.4 PluginImporter（强制）

| 平台 | `enabled` |
|------|-----------|
| Editor | **0** |
| Win / Win64 / OSX / Linux / WebGL / 其它 | **0** |

**理由：** `emmy_core` 是 **Lua C 模块**（经 `package.cpath` + `require` / `luaopen_*` 加载），不是 Unity 原生插件。若 Editor 勾选启用，Unity 会先 `LoadLibrary`，再与 Lua `require` 二次加载，易冲突或行为未定义。

可选更严布局：移出 `Plugins/`（例如 `Editor/EmmyLua/`），避免被当作插件扫描；若保留在 `Plugins/emmylua`，**必须以 meta 全平台禁用** 满足本条。

---

## 4. Settings

在 `ZLua.Settings`（`ProjectSettings/ZLua.asset`）新增（字段名以实现为准，语义如下）：

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `enableDebugger` | `bool` | **`false`** | 为 true 时，`Initialize` 末尾调用 `StartDebugger` |
| `debuggerPort` | `int` | **`9966`** | `tcpListen` 端口 |
| `debuggerWaitIDE` | `bool` | **`false`** | 为 true 时调用 `dbg.waitIDE()`（见 §7） |

UI（SettingsProvider）须标明：

- 仅 **Editor Mono** 生效  
- `waitIDE == true` 时会在 **Unity 主线程阻塞**且 **无超时**（见 §7）  
- 须与当前系列对应的 `emmy_core` 目录匹配（见 §6）；IDE 侧须配置 `sourcePaths`（见 §10）

---

## 5. 启动流程

### 5.1 时机

在 `LuaMonoAppDomain.Initialize` 中，于下列步骤 **全部完成之后** 再启动调试器：

1. 创建 / 复用 `LuaEnv`（含 `luaL_openlibs`）  
2. `SetModuleLoader`  
3. `LoadBuiltinGlobals`、MarshalAs XML（若有）、`AssemblyRegistry`、`ZLuaLib`、`EnsureBuiltinZLuaLib`、`DelegateBridges.Warmup` 等现有初始化  

这样断点可覆盖 `CSharp`、`zlua` 与业务 `require` 模块。

**早退路径**（`_luaEnv != null` 仅刷新 loader）：**不得**再次 `waitIDE`；`StartDebugger` 须 **幂等**（已 listen 则跳过或仅确保监听，见实现）。

### 5.2 `LuaEnv.StartDebugger`（规范行为）

伪代码（Lua 片段由 C# `DoString` 注入；路径 / 端口 / 是否 wait 由 C# 代入）：

```lua
package.cpath = package.cpath .. ";<absDir>/?.<ext>"
local dbg = require('emmy_core')
dbg.tcpListen('127.0.0.1', <port>)
-- 仅当 debuggerWaitIDE == true：
dbg.waitIDE()
```

| 项 | 约定 |
|----|------|
| Host | 使用 **`127.0.0.1`**（避免部分环境下 `localhost` → IPv6 导致连不上） |
| 路径 | **绝对路径**；Lua 字符串中目录分隔优先 `/` |
| 失败 | `require` / listen 失败须在 Editor 打出明确错误（含 Lua 错误对象），**不得**静默吞掉 |
| 重复 append | 多次调用不得无限拉长 `cpath`；实现应检测已注入标记或已存在该目录项 |

### 5.3 平台宏与 `cpath` 映射

| 条件 | 目录（相对包根 `Plugins/emmylua/`） | `<ext>` |
|------|-------------------------------------|---------|
| `UNITY_EDITOR_WIN` | `win32-x64` | `dll` |
| `UNITY_EDITOR_OSX` + ARM64 | `darwin-arm64` | `dylib` |
| `UNITY_EDITOR_OSX` + x64 | `darwin-x64` | `dylib` |
| `UNITY_EDITOR_LINUX` | `linux-x64` | `so` |

包根解析：使用包内已知相对路径经 `Path.GetFullPath`（或与 `CommonDirs` 同类工具）得到绝对目录；**禁止**写死机器相关盘符。

Arch 判断以实现为准（如 `RuntimeInformation` / Unity 已有 Editor arch API），须覆盖 Apple Silicon。

---

## 6. ABI / Lua 版本匹配

### 6.1 事实：二进制不会自报 Lua 版本

官方/社区随附的 `emmy_core` **没有**可靠的「读文件头即可知道面向 5.3 还是 JIT」的契约。EmmyLuaDebugger 在 **编译期** 用 CMake 选项选定 ABI，例如：

```bash
cmake .. -DEMMY_LUA_VERSION=53   # 或 51/52/54/55/jit
```

（见 [EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger)；`EMMY_LUA_VERSION` 决定宏与头文件。）  
因此 ZLua **不能**、也 **不必** 对裸 `emmy_core.dll` 做启发式 ABI 探测。

### 6.2 ZLua 怎么做「校验」（按系列目录，非探测式）

**原则：用目录布局声明目标系列；运行时只检查对应目录是否存在。**

| 做法 | 说明 | 推荐 |
|------|------|------|
| **B. 按系列分目录（本包采用）** | `Plugins/emmylua/{lua55\|…\|luajit}/<platform>/emmy_core.*`；PUC 系列名 = Editor DLL 逻辑名；JIT 统一 **`luajit`** | **是** |
| **A. 单系列 + 常量/清单** | 仅当不分目录时的退化方案 | 否（已被 B 取代） |
| **C. 仅 try `require`** | ABI/路径错误时常 **native 崩溃**，Lua `pcall` 拦不住 | **禁止**当作唯一校验 |

流程：

```text
series = 当前编译 define → lua55 / luajit / …
dir = Plugins/emmylua/<series>/<platform>/
若 dir 不存在
  → LogError（写明 series 与期望路径）并 return；不抛异常、不 require
否则
  → 拼接 cpath 并 require('emmy_core')
```

Windows / macOS 已随附 `lua51`–`lua55` 与 `luajit`（见 §3.2）；Linux 目前仅随附 **`lua55/`**，其它系列需自建。

### 6.3 与 ZLua 多版本的关系

| `luaVersionId` → 系列目录 | 自建时 `EMMY_LUA_VERSION` |
|---------------------------|---------------------------|
| `lua-5.1.*` → **`lua51`** | `51` |
| `lua-5.2.*` → **`lua52`** | `52` |
| `lua-5.3.*` → **`lua53`** | `53` |
| `lua-5.4.*` → **`lua54`** | `54` |
| `lua-5.5.*` → **`lua55`** | `55`（上游默认） |
| `luajit-2.0` / `luajit-2.1` → **`luajit`** | `jit` |

目录名规则再次强调：**官方 Lua → `lua{major}{minor}`；LuaJIT → 统一 `luajit`**（**不要**按 `luajit20` / `luajit21` 拆 emmy 目录）。

Windows / macOS 上各系列应使用对应目录下的随附 `emmy_core`；Linux 或缺目录时按 [EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger) 自建并放入上表路径。**不得**把错误系列目录的二进制挪到另一系列目录凑合使用。

LuaJIT 2.0 / 2.1 均用上游 `jit` 构建**同一** `emmy_core`，只放在 **`luajit/`**。

ZLua Install **不**自动编译 Emmy。

### 6.4 LuaJIT 与 gate

调试期 hook 会抑制 JIT，性能下降可接受。`emmy_core` 为 native 模块，仍须遵守 [03-MONO-LUAJIT-CALLBACK-GATE.md](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/)（**不得**在托管 reverse-P/Invoke 帧内直接 `lua_error`）。

---

## 7. `waitIDE` 与主线程

| `debuggerWaitIDE` | 行为 |
|-------------------|------|
| `false`（默认） | 仅 `tcpListen`；IDE 稍后连接；**不**阻塞 Editor |
| `true` | `waitIDE()` 在 **Unity 主线程**同步等待 IDE 连接 |

**上游无超时：** [EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger) 文档中的 `dbg.waitIDE()` **不接受超时参数**；未连上会一直阻塞。因此 Settings **默认关闭** wait。

推荐工作流：保持 `debuggerWaitIDE = false` → Unity Play（已 listen）→ IDE F5 连接 → 再触发业务 Lua。仅当必须「断在第一行业务前」且已先开好 IDE 时再开 wait。

---

## 8. 源码路径映射（chunk ↔ 磁盘）

ZLua 经 `moduleLoader` 加载的模块，chunk 名为：

```text
@<module/path>.lua
```

（模块名中的 `.` → `/`。）物理文件由宿主 loader 决定，例如本仓库测试工程：

| `require` | chunk（调试器可见） | 磁盘文件 |
|-----------|---------------------|----------|
| `luatest/init` 或 `luatest.init` | `@luatest/init.lua` | `{project}/Tests/Lua/luatest/init.lua` |
| `cases.foo.bar` | `@cases/foo/bar.lua` | `{project}/Tests/Lua/cases/foo/bar.lua` |

IDE 必须把 **Lua 源码根**（上例为 `Tests/Lua`）配进 Emmy 的 `sourcePaths`，否则会出现「能连上但 Could not load source / 断点不生效」。

| 项 | 约定 |
|----|------|
| 映射规则 | `sourcePaths` = `moduleLoader` 使用的源码根目录（可多个） |
| 工作区 | 用 IDE **打开工程根**（含 `Packages` / `Tests` 的那一层），不要只打开 `Tests/Lua` |
| 内置 chunk | `globals.lua` / `zlualib.lua` 等无稳定工程路径；**不保证**可断点 |
| 运行时改写 `source` | 本规范**不强制**；若实现改写，不得破坏现有 `traceback` 可读性 |

---

## 9. 与现有 Editor 约束的关系

| 机制 | 调试器侧要求 |
|------|----------------|
| [Callback gate](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/) | 调试逻辑在 `emmy_core` / Lua 内完成；**禁止**为调试在托管回调里直接 `lua_error` |
| `LuaPrintBuffer` | 调试输出走 Emmy 通道；勿依赖回调帧内带堆栈的 `Debug.Log` |
| 单 `lua_State` | 一个 listen 会话即可；不引入第二 state |
| `LuaFramePump` | 本阶段 **不要求** 为 Emmy 增加泵（默认不 `waitIDE`）；若日后改为非阻塞协议，再与帧泵协作 |

---

## 10. IDE / EmmyLua 插件配置（VS Code · Cursor）

上游协议与扩展以 [EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger)、VS Code / Cursor 的 **EmmyLua** 扩展为准。ZLua 侧为 `tcpListen`：**游戏先听，IDE 再连**。

### 10.1 前置条件

1. Install / Settings 使 Editor 运行 **与 `emmy_core` 同系列** 的 Lua（默认 `lua-5.5.0` → `lua55`；其它系列见 §3.2 随附矩阵）。  
2. Project Settings → ZLua：`enableDebugger = true`，`debuggerPort` 与 IDE 一致（默认 **9966**），**`debuggerWaitIDE = false`**（推荐）。  
3. 安装 EmmyLua 扩展；用 IDE **打开 Unity 工程根目录**。  
4. Play / 触发 `LuaAppDomain.Initialize`；Console 出现 `EmmyLua debugger listening on 127.0.0.1:…`。  
5. IDE 启动下方调试配置，再在源码根下的 `.lua` 文件打断点并触发对应 `require`。

### 10.2 `.vscode/launch.json`（推荐模板）

`type` 使用扩展提供的 **EmmyLua New Debug**（常见值为 `emmylua_new`；若列表名不同以扩展为准）。

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "emmylua_new",
      "request": "launch",
      "name": "ZLua EmmyLua (Unity Editor)",
      "host": "127.0.0.1",
      "port": 9966,
      "sourcePaths": [
        "${workspaceFolder}/Tests/Lua"
      ],
      "ext": [".lua"],
      "ideConnectDebugger": true
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `host` | 与 ZLua 注入一致，用 **`127.0.0.1`**（避免 `localhost` → IPv6） |
| `port` | 与 Settings `debuggerPort` 相同 |
| `sourcePaths` | **必填且对准 Lua 根目录**；上例为仓库 `Tests/Lua`。业务工程改为自己的 `LuaScripts` 等 |
| `ext` | 源文件后缀；仅 `.lua` 时写 `[".lua"]`；若还有 `.lua.txt` 一并列出 |
| `ideConnectDebugger` | `true`：IDE 主动连已 `tcpListen` 的进程（匹配 ZLua 注入方式） |
| `request` | 扩展常见为 `launch`（New Debug）；语义仍是「连到已 listen 的宿主」，勿与「IDE 替你启动 lua.exe」混淆 |

**多源码根：** 在 `sourcePaths` 中追加多项，例如 `"${workspaceFolder}/LuaScripts"`、`"${workspaceFolder}/Packages/xxx/Lua"`。

### 10.3 `.emmyrc.json`（语言服务，可选）

用于补全 / 诊断，**不替代** `launch.json` 的 `sourcePaths`。工程根示例：

```json
{
  "workspace": {
    "library": []
  },
  "diagnostics": {
    "disable": ["undefined-global"]
  }
}
```

ZLua 大量使用 `CSharp` 等全局时，可按需关闭 `undefined-global`，减少噪音。

### 10.4 推荐操作顺序

```text
Unity：enableDebugger +（可选）确认系列为 lua55
    → Play / Initialize → 日志 listening
Cursor / VS Code：打开工程根 → F5（上述配置）
    → 在 sourcePaths 下的 .lua 下断点
    → 触发 require / GetFunction 跑到该模块
```

### 10.5 常见问题

| 现象 | 排查 |
|------|------|
| Console：`EmmyLua debugger skipped` / 缺目录 | 当前系列无 `Plugins/emmylua/<series>/<platform>/`；Win/macOS 各系列应已随附，Linux 非 `lua55` 按 §3.2 自建 |
| `DllNotFoundException: lua55`（或其它系列） | Settings / define 已切对应系列，但 Editor 原生库未就绪：确认 `Plugins/lua/<series>/` 下存在对应 `luaXX.dll` / `.dylib`，PluginImporter **Editor 启用**，改版本后已 **Install / 域重载** |
| IDE 连不上 / 超时 | Unity 是否已 listen；端口是否一致；host 是否 `127.0.0.1`；防火墙 |
| 能连接，断点灰色 / Could not load source | **`sourcePaths` 未指向真实 Lua 根**（少写了 `Tests/Lua`）；或工作区不是工程根 |
| 一开 Play Editor 假死 | 误开了 `debuggerWaitIDE`；关掉，或先 F5 再 Play |
| `waitIDE` 想设超时 | **上游不支持**；保持默认关 wait |
| 扩展里没有 `emmylua_new` | 安装/启用 EmmyLua 扩展后重载窗口；以扩展实际提供的 Debug type 为准 |
| 仅 Cursor、无 VS Code | 同一套 `.vscode/launch.json` 与 EmmyLua 扩展即可 |

---

## 11. 验收清单

- [ ] `emmylua/**` 下所有 `emmy_core` 的 PluginImporter **全平台 disabled**  
- [ ] Windows / macOS 随附 `lua51`–`lua55`、`luajit`（各平台子目录）；Linux 随附 `lua55/linux-x64`；其余按 [EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger) 自建  
- [ ] 系列目录命名：`lua{major}{minor}` / 统一 **`luajit`**（不按 2.0/2.1 拆分）  
- [ ] `enableDebugger == false` 时无 listen、无 `cpath` 注入、无阻塞  
- [ ] 当前系列目录缺失时：`LogError` 后 Initialize **成功完成**（不抛）  
- [ ] Win / macOS (arm64+x64) / Linux Editor + 匹配系列：开启后 `require('emmy_core')` 成功且 IDE 可连接  
- [ ] `debuggerWaitIDE == false` 时 Initialize 立即返回；文档已说明 `waitIDE` **无超时**  
- [ ] `Initialize` 早退路径不重复 `waitIDE`  
- [ ] `launch.json` 的 `sourcePaths` 对准业务/测试 Lua 根；业务模块断点可命中  
- [ ] 开启调试时，现有 Mono gate / `pcall` 错误路径仍不崩溃  

---

## 12. 相关文档

| 文档 | 关系 |
|------|------|
| [EmmyLua/EmmyLuaDebugger](https://github.com/EmmyLua/EmmyLuaDebugger) | 上游构建、`EMMY_LUA_VERSION`、用法（权威） |
| [01-HOST-API.md](/docs/spec/01-HOST-API/) | `Initialize` 门面；调试在其后插入 |
| [10-LIFETIME.md](/docs/spec/10-LIFETIME/) | 单 state、异常边界 |
| [11-MULTI-VERSION.md](/docs/spec/11-MULTI-VERSION/) | `luaVersionId` 与 Editor DLL 逻辑名 |
| [03-MONO-LUAJIT-CALLBACK-GATE.md](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/) | Editor 回调与 `lua_error` |
| [02-LUAJIT.md](/docs/spec/build/02-LUAJIT/) | JIT 下 hook 性能预期 |
| 包内 `Plugins/README.md` | 目录与自建速查 |
| [05-NATIVE-MODULES.md](/docs/spec/build/05-NATIVE-MODULES/) | 第三方 C 模块（socket/cjson）通用约定；同用 cpath / 禁用 PluginImporter |
