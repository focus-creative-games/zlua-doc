---
sidebar_position: 7
title: "多版本管理"
---

# 11 — 多版本管理（Unity / Lua / 安装）

> 包内 **不** 携带完整 `libil2cpp` 树；安装时在当前 Unity 自带源码上叠加 **patch + zlua-runtime + 选定 Lua**。  
> 本文是 UPM 包布局、`LocalInstaller`、Lua 版本切换、原生 DLL 命名，以及 Il2Cpp **`ZLuaConf.inc` / Compatible 头**（§12）的实现规范。  
> Lua 可见语义仍以本目录其它 spec 为准；本文不改变互操作语义。

---

## 1. 目标与非目标

### 1.1 目标

| 目标 | 说明 |
|------|------|
| **可升级 Unity** | 不随每个 Unity 版本整包携带 `libil2cpp` |
| **可切换 Lua 源码** | Settings 指定版本；PUC-Rio 从 lua.org 下载到本地缓存，LuaJIT 手动 clone |
| **Editor DLL 按系列** | 逻辑名 `lua5{minor}`（如 `lua53`）；二进制由开发者自行替换 |
| **改动可审计** | 对上游（Unity `libil2cpp`、PUC-Rio / LuaJIT）的修改以 **patch 文件** 形式存在 |
| **失败可见** | patch 上下文不匹配或缺少源码时 Install **失败并报错**，禁止静默跳过 |

### 1.2 非目标（本阶段）

| 项 | 说明 |
|----|------|
| 同 Editor 进程内热切换已加载的原生 DLL | Windows 下已加载 DLL 无法可靠覆盖；换系列 DLL 后须 **重启 Editor** |
| 随包携带每个源码小版本的 Editor DLL | Editor 开发对 patch 号无实质要求；需要时可自行替换 `luaXX.dll` |
| 在只读 Package 内生成并引用 C# 源文件 | UPM 缓存只读；`LUA_DLL` 仅按 **API 族宏** 映射（§8） |
| 一次交付全部历史 Lua / Unity 组合 | 先打通主推组合（见 §10），再按需加 patch / 源码目录 |

---

## 2. 包内目录布局（`ZLua~`）

权威包数据根：`Packages/com.code-philosophy.zlua/ZLua~`。

```
ZLua~/
├── zlua-runtime/              # ZLua native，安装时复制到 libil2cpp/zlua
│   ├── ZLuaCommon.h           # 组装 Compatible + 定义 ZLUA_LUA_VERSION
│   ├── LuaCompatible.h        # 多 Lua / LuaJIT API shim（手写）
│   ├── Il2CppCompatible.h     # 多 Unity / 团结 il2cpp API shim（手写）
│   └── generated/
│       └── ZLuaConf.inc       # Install/Generate 写入（仅宏，见 §12）
├── patches/
│   ├── libil2cpp/
│   │   ├── 2021.3/
│   │   │   └── 2021.3.0.patch     # 覆盖 2021.3.x（共用区间最小版本）
│   │   ├── 2022.3/
│   │   │   └── 2022.3.0.patch     # 覆盖 2022.3.x；若某小版本断点再增 2022.3.N.patch
│   │   └── 6000/                  # Unity 6：先试 6000.{minor}/，再回退本目录
│   │       └── 6000.0.0.patch
│   └── lua/
│       └── lua-5.4/
│           ├── 5.4.0.patch        # 覆盖 5.4.0…直至下一 floor 文件之前
│           ├── 5.4.4.patch        # 共用区间只保留最小版本号文件名
│           └── 5.4.7.patch
├── lualib/
└── link.xml
```

**不随包携带** Lua / LuaJIT 上游源码。Install 时写入工程本地缓存：

```
Library/ZLua/LuaSrcCache/
├── downloads/                 # 可选：保存 .tar.gz
├── lua-5.5.0/                 # 从 lua.org 下载并解压
├── lua-5.4.8/
└── luajit-2-1/                # 开发者自行 clone（不自动下载）
```

缓存目录名 `LuaSrcCache` 可用；若更偏好层级化，等价可采用 `Library/ZLua/cache/lua`（实现以代码 `CommonDirs.LuaSrcCacheDir` 为准）。

### 2.1 目录 / 版本 id 命名

| 种类 | 规则 | 示例 |
|------|------|------|
| Settings / PUC-Rio id | `lua-{major}.{minor}.{patch}` | `lua-5.5.0` |
| PUC-Rio 下载 URL | `https://lua.org/ftp/lua-{ver}.tar.gz` | `https://lua.org/ftp/lua-5.5.0.tar.gz` |
| PUC-Rio 缓存目录 | 与 id 相同 | `LuaSrcCache/lua-5.5.0/` |
| Settings / LuaJIT id | `luajit-{major}.{minor}` | `luajit-2.1` |
| LuaJIT 缓存目录 | `luajit-{major}-{minor}`（开发者 clone） | `LuaSrcCache/luajit-2-1/` |
| Lua patch 目录 | `patches/lua/lua-{major}.{minor}/` | `patches/lua/lua-5.4/` |
| Lua patch 文件 | 仅 `{major}.{minor}.{patch}.patch`（**无** `default.patch`）；共用区间只保留区间最小版本文件名 | `5.4.0.patch` / `5.4.4.patch` / `5.4.7.patch` |
| Unity patch 目录 | `patches/libil2cpp/{major}.{minor}/`，Unity 6 另可回退到 `patches/libil2cpp/{major}/` | `2022.3/`、`6000/` |
| Unity patch 文件 | 仅 `{major}.{minor}.{patch}.patch`（**无** `default.patch`）；共用区间只保留区间最小版本文件名 | `2022.3.0.patch` / `6000.0.0.patch` |

**Lua / Unity patch 选择（floor，相同规则）：** 在选定系列目录内取版本号 **≤** 当前产品版本的 **最大** `{X.Y.Z}.patch`；若存在与当前版本同名（或去字母后缀后同名）的文件，即为该规则的快速命中。apply 失败 → Install 失败（不静默换其它文件）。  
**生成 / 维护：** 若多个小版本可共用同一份 patch 内容，**只保留该共用区间的最小版本号文件**。**禁止** `default.patch`（Lua 与 libil2cpp 皆然）。  
**Unity 系列目录：** 先尝试 `{major}.{minor}/`（如 `2022.3/`、`6000.3/`），再对 Unity 6（`major >= 6000`）回退 `{major}/`（如 `6000/`）；**目录选定后**再在该目录内做 floor 选文件。

**禁止** 在 `ZLua~` 下放置完整 `libil2cpp-{unity}` 树或整棵上游 Lua 源码树作为安装源。

### 2.2 开发期源码权威

| 内容 | 开发编辑位置 | 合入包内 |
|------|--------------|----------|
| `zlua` C++ | `build-win64/.../libil2cpp/zlua` | 同步到 `ZLua~/zlua-runtime` |
| Lua 上游 | Install 下载到 `Library/ZLua/LuaSrcCache`（不进包） | 仅 `patches/lua` |
| 对 Unity `libil2cpp` 的改动 | `patches/libil2cpp` | **不** 提交整棵 libil2cpp |

---

## 3. 安装流水线（`LocalInstaller`）

安装输出根：`Library/ZLua/LocalIl2CppData-{platform}/`（路径以 `CommonDirs` 为准）。

### 3.1 顺序（必须）

1. 解析 Settings `luaVersionId`（空则默认 `lua-5.3.6`，见 §6.2）  
2. **确保 Lua 源码在 `Library/ZLua/LuaSrcCache`**：已缓存则复用；PUC-Rio 缺失则从 lua.org 下载；LuaJIT 缺失则失败并提示手动 clone  
3. 从当前 Editor 复制官方 `il2cpp`（含 **stock** `libil2cpp`）到 Local 目录  
4. 解析并应用 **libil2cpp patches**（§4）  
5. 将 `ZLua~/zlua-runtime` **复制/覆盖** 到 `Local.../libil2cpp/zlua`  
6. 将缓存中的选定 Lua 复制到 `Local.../libil2cpp/lua`，再应用 **lua patches**（§5）  
7. 写入工程 **Scripting Define Symbols**（§7）  
8. 写入 **`ZLuaConf.inc`**（§12；权威输出在 Local `libil2cpp/zlua/generated/`）  
9. 若包内缺少对应系列 Editor 插件 DLL，**警告**（不阻断 Install）；DLL 由开发者自行替换（§8）  
10. 写入 **install fingerprint**（§9）  
11. 清理 Il2Cpp / Bee 缓存；系列 / Define 变更时提示 **重启 Editor**

### 3.2 与旧行为的差异

| 旧 | 新 |
|----|----|
| 用包内完整 `libil2cpp-*` **整目录替换** | stock + patch + `zlua-runtime` |
| 包内携带 Lua 源码 | **不携带**；`LuaSrcCache` + 网络下载 / 手动 clone |
| 包内嵌完整 Unity 树 | 仅 `zlua-runtime` + `patches` |

---

## 4. libil2cpp patch 选择

对 Unity stock `libil2cpp` 的修改应尽量少（量级：数十行 hook），一律以 patch 文件维护。

### 4.1 选择算法

设当前 Unity 为 `2022.3.62f1`（比较时忽略 `f1` / `t11` 等字母后缀，按 `2022.3.62` 三元组）：

1. 按序尝试系列目录：`{major}.{minor}/`，若 `major >= 6000` 再回退 `{major}/`（例：`6000.3/` → `6000/`）  
2. 在**第一个存在的**系列目录内：  
   - 若存在精确文件（完整版本字符串 / 去后缀 `2022.3.62` 等）→ **选用**（floor 快速路径）  
   - 否则在目录内所有 `{major}.{minor}.{patch}.patch` 中，取版本号 **≤** `2022.3.62` 的 **最大** 者（例：仅有 `2022.3.0.patch` → 选用它）  
3. 所有候选目录均无可用 patch → **Install 失败**  
4. **不**再使用 `default.patch`

选定文件后 apply 失败 → Install 失败（不得再静默换另一个文件）。

**维护约定（与 Lua §5.2 相同）：** 能共用同一内容的连续 Editor 小版本，只提交区间 **最小** 版本号文件；上游上下文变化导致旧 floor 无法 apply 时，再新增该断点版本的 patch。

### 4.1.1 已维护系列与差异要点

| 目录 | 基线 Editor（制作参考） | 适用范围 | 包内 floor 文件 |
|------|-------------------------|----------|-----------------|
| `2021.3/` | 2021.3.45f2 | 2021.3.x | `2021.3.0.patch`（无 `AnUnresolvedCallStubWasNotFound*`；提供 **no-op** `return false`） |
| `2022.3/` | 2022.3.62f3 | 2022.3.x | `2022.3.0.patch`（真实 unresolved stub 检测 + `LuaAppDomain::Initialize`） |
| `6000/` | 6000.0.71f1 | **6000.0.x / 6000.3.x / 6000.5.x**（及同系列回退） | `6000.0.0.patch`（floor 命中；若有 `6000.{minor}/` 精确目录则优先） |

### 4.2 应用与校验

- 推荐 unified diff；Install 前可 `--check` / 干跑  
- 应用后应做最小校验（例如约定 hook 符号或锚点文件内容出现）  
- 上下文漂移（Unity 小版本改动周围代码）→ 失败，需新增该断点版本的 floor patch（`{major}.{minor}.{patch}.patch`）或更新既有共用文件  

### 4.3 与 `zlua-runtime` 的边界

| 归属 | 内容 |
|------|------|
| `patches/libil2cpp` | 对 Unity 原有 `.cpp/.h` 的插入/小改（初始化、编译列表等） |
| `zlua-runtime` | ZLua 自有源码树；**不** 通过改 Unity 文件「塞进」大段实现 |

`zlua-runtime` 若依赖随 Unity / Lua 变化的内部 API，在 runtime 内用 **§12 Compatible + conf** 条件编译解决，**不要** 因此重新携带整棵 libil2cpp。

---

## 5. Lua 源码与 patch

### 5.1 获取源码（不进 UPM 包）

| 引擎 | 行为 |
|------|------|
| **PUC-Rio** | 若 `LuaSrcCache/{id}` 已含完整 `src/` 则复用；否则下载 `https://www.lua.org/ftp/{id}.tar.gz` 并解压到该目录 |
| **LuaJIT** | **不**自动下载；开发者将源码 clone 到 `LuaSrcCache/luajit-{major}-{minor}/`（如 `luajit-2-1`） |

ZLua 对 VM 的修改以包内 **`patches/lua`** 表达；Install 时对缓存中的干净树 apply。

### 5.2 patch 选择算法

设 Settings 为 `lua-5.4.8`，系列目录为 `patches/lua/lua-5.4/`：

1. 确保缓存源码可用（§5.1）  
2. 在系列目录列出所有 `{major}.{minor}.{patch}.patch`（忽略其它文件名，含历史 `default.patch` 若误留则不得选用）  
3. 选择版本号 **≤** `5.4.8` 的文件中 **最大** 者（例：有 `5.4.0` / `5.4.4` / `5.4.7` → 选用 `5.4.7.patch`；若存在 `5.4.8.patch` 则直接命中）  
4. 无满足条件的文件，或 apply 失败 → **Install 失败**（不自动降级到其它系列，也不回退到「更大」版本的 patch）  
5. 将 patch 后的 `src/` 拷入 `Local.../libil2cpp/lua`  

**维护约定：** 能共用同一内容的连续小版本，只提交区间 **最小** 版本号的那一个文件；上游上下文变化导致旧 floor 无法 apply 时，再新增该断点版本的 patch（仍以最小号命名该新区间）。

不要把 IDE 辅助文件（如 `.clangd`）打进 patch。

### 5.3 Editor DLL 与 Player 内嵌源码的关系

| 路径 | 使用什么 |
|------|----------|
| **Il2Cpp Player** | 下载/缓存的精确小版本源码 + `patches/lua` |
| **Editor（Mono）** | `Plugins` 下系列 DLL（`lua53` / `lua54` / …），**由开发者自行替换** |

二者 patch 号不必一致。缺 DLL 时 Install **仅警告**，不阻断。切换系列后须重启 Editor。

---

## 6. Settings：选定 Lua 版本

| 字段 | 含义 |
|------|------|
| `luaVersionId` | 如 `lua-5.4.8` / `luajit-2.1`；空见 §6.2 |

### 6.1 变更后义务

切换后须重新 Install；Define / 系列 DLL 变更后提示重启 Editor。未 Install 或 fingerprint 不匹配时，Il2Cpp 打包应阻断。

### 6.2 默认版本

- 字段默认值 / 空值：固定为 **`lua-5.3.6`**  
- Install 时若为空则写回该默认值  
- 下载失败（例如官方 FTP 无此版本）→ Install 失败并提示检查版本号；**不得**静默改用其它大版本

---

## 7. 编译符号（Scripting Define Symbols）

由 Installer（或 Settings 保存并触发的同一逻辑）写入 **工程** Define，**不** 在只读 Package 内生成 C# 文件。

### 7.1 宏命名（须带 `ZLUA_` 前缀）

| 宏 | 何时定义 | 用途 |
|----|----------|------|
| `ZLUA_USE_LUAJIT` | 选定 LuaJIT | 引擎差异；DLL 名与 API 裁剪 |
| `ZLUA_LUA_5_4` | PUC-Rio 5.4.x（任意小版本） | **API 族** + Editor DLL 逻辑名 `lua54` |
| `ZLUA_LUA_5_3` | PUC-Rio 5.3.x（任意小版本） | **API 族** + Editor DLL 逻辑名 `lua53` |
| `ZLUA_LUA_5_1` | PUC-Rio 5.1.x（非 JIT） | **API 族** + Editor DLL 逻辑名 `lua51`（若随包提供） |

说明：

- **不需要** `ZLUA_LUA_5_4_7` 这类精确小版本宏：源码小版本只影响 Install 拷贝的树与 fingerprint，不进入 `LUA_DLL` 映射。  
- API 族宏对应原讨论中的「`LUA_FEAT_5_4_X`」语义，命名用 `ZLUA_LUA_5_4`，**不要** 使用易误解的 `_X` 后缀。  
- LuaJIT：定义 `ZLUA_USE_LUAJIT`；API 裁剪按 JIT 分支（实现时与 `ZLUA_LUA_5_1` 是否并存写死一种）。

### 7.2 互斥

同一时刻仅允许一套「引擎 + API 族」组合。Installer 在写入前移除旧的 `ZLUA_LUA_*` / `ZLUA_USE_LUAJIT`，再按当前 `luaVersionId` 的系列写入新集。

---

## 8. 原生 DLL 命名与 `LuaDllName`（按系列）

### 8.1 随包策略

| 项 | 规则 |
|----|------|
| **携带粒度** | 可选随包带某系列 DLL；**开发者按所用系列自行替换** |
| **逻辑名** | `lua` + `major` + `minor` → `lua53`、`lua54`、`lua55`（无 patch 位） |
| **LuaJIT** | `luajit` |
| **Install** | 缺失时 **警告**，不失败 |

| Settings 源码 id（示例） | API 族宏 | Editor 逻辑名 | Windows 示例 |
|--------------------------|----------|---------------|--------------|
| `lua-5.3.6` / `lua-5.3.0` | `ZLUA_LUA_5_3` | `lua53` | `lua53.dll` |
| `lua-5.4.7` / `lua-5.4.1` | `ZLUA_LUA_5_4` | `lua54` | `lua54.dll` |
| `luajit-…` | `ZLUA_USE_LUAJIT` | `luajit`（约定） | `luajit.dll` |

同一系列下切换源码小版本（如 `5.4.1`→`5.4.7`）**不改变** `LUA_DLL` 与 Plugins 文件名，只改变 Il2Cpp 内嵌源码树。  
用户若要在 Editor 使用其它构建，自行替换包内或工程侧对应 `luaXX.dll` 即可（注意 Windows 已加载锁定，须重启 Editor）。

### 8.2 `LuaDllName.cs`

单独文件（建议路径）：

`Packages/com.code-philosophy.zlua/Runtime/Mono/Lvm/LuaDllName.cs`

职责：仅按 **API 族 / JIT** 定义 `LUA_DLL`。`LuaDll.cs` 只引用该常量。

```csharp
namespace ZLua
{
    public static class LuaDllName
    {
#if UNITY_IPHONE && !UNITY_EDITOR
        public const string LUA_DLL = "__Internal";
#elif ZLUA_USE_LUAJIT
        public const string LUA_DLL = "luajit";
#elif ZLUA_LUA_5_4
        public const string LUA_DLL = "lua54";
#elif ZLUA_LUA_5_3
        public const string LUA_DLL = "lua53";
#elif ZLUA_LUA_5_1
        public const string LUA_DLL = "lua51";
#else
        public const string LUA_DLL = "lua53"; // 与 §6.2 默认系列一致
#endif
    }
}
```

新增 **系列** 时：增加系列 DLL、`LuaDllName` 分支、API 族宏与 Installer 映射。  
新增同系列 **源码小版本** 时：只需增加 `lua-versions`（及必要 patch），**不必** 改 `LuaDllName` 或新增 Plugins 文件名。

### 8.3 `LuaDll.cs` 的 API 裁剪

按 **API 族 / JIT** 宏启用或禁用声明（可分文件）。源码小版本差异不进入 `#if`。

### 8.4 Windows 加载锁定

- 换系列（`lua53`↔`lua54`）或替换正在使用的同名 DLL 后，须 **重启 Editor**。  
- Install 在系列或 Define 变更时须提示重启。

---

## 9. Fingerprint 与重新安装

Fingerprint（建议 JSON 或等价键值）至少包含：

| 字段 | 说明 |
|------|------|
| `unityVersion` | 安装时的 `Application.unityVersion` |
| `luaVersionId` | 实际使用的源码 id（含 §6.2 默认解析结果） |
| `luaSeries` | 如 `lua-5.3` / `lua-5.4` / `luajit`（便于对照 DLL） |
| `libil2cppPatchKey` | 实际选用的 patch 目录键（精确或大版本） |
| `luaPatchKey` | 实际选用的 lua patch 目录键，或 `none` |
| `packageContentStamp` | 包内容变更戳（可为现有 max mtime 策略的演进） |
| `defines` | 写入的 `ZLUA_*` 集合（便于诊断） |

以下任一变化 → `NeedReinstall` 为真：

- 包内容戳变化  
- Settings `luaVersionId`（或默认解析结果）与 fingerprint 不一致  
- 当前 Unity 版本与 fingerprint 不一致  
- Local 树缺失  

---

## 10. 分阶段支持范围

| 阶段 | 范围 |
|------|------|
| **P0** | 默认 `lua-5.3.6` + 下载缓存 + `lua-5.3` patch + Unity `2022.3` patch + `zlua-runtime` |
| **P1** | `lua-5.4.x` / `lua-5.5.x` 与对应系列 patch / DLL |
| **P2** | LuaJIT（手动 clone 缓存）及其它系列 |

---

## 11. 实现检查清单

- [ ] `ZLua~` 无完整 libil2cpp、无随包 Lua 上游源码  
- [ ] PUC-Rio：缓存未命中则从 `lua.org/ftp` 下载  
- [ ] LuaJIT：仅接受 `LuaSrcCache/luajit-{major}-{minor}` 手动源码  
- [ ] 默认 `luaVersionId` = `lua-5.3.6`  
- [ ] Plugins DLL 缺失仅警告  
- [ ] libil2cpp / lua patch：同一套 floor（≤ 当前的最大 `{X.Y.Z}.patch`），无 `default.patch`；共用区间只保留最小版本文件；失败不降级  
- [ ] Define / `LuaDllName` / fingerprint / 重启提示齐全  
- [ ] `LuaCompatible.h` / `Il2CppCompatible.h` / `ZLuaConf.inc` 符合 §12  
- [ ] Install 写 Local `ZLuaConf.inc`；Generate/All 校验或复写，禁止过期静默使用  

---

## 12. Il2Cpp 运行时兼容层（`ZLuaConf` / Compatible）

> 本节只约束 **Il2Cpp Player** 原生树（`zlua-runtime`）。  
> **Editor Mono** 继续使用 §7 Scripting Define + §8 `LuaDllName`，**不** 消费 `ZLuaConf.inc`。

### 12.1 设计目标

用三套互不覆盖的真相源表达版本事实：

| 真相源 | 表达内容 |
|--------|----------|
| **生成的 `ZLuaConf.inc`** | 引擎族（是否 JIT）、Lua API 族、Unity / 团结版本、对账字符串 |
| **Lua 头文件**（`LUA_VERSION_NUM` 等） | 官方 Lua 数值版本；经 `ZLuaCommon.h` 映射为 `ZLUA_LUA_VERSION` |
| **`luaconf.h`（Install + patch 后）** | **唯一** 决定 `ZLUA_FAST_METATABLE`（conf / Compatible **不得** 再定义） |

### 12.2 文件职责

| 文件 | 性质 | 职责 |
|------|------|------|
| `zlua-runtime/generated/ZLuaConf.inc` | **生成** | 仅宏；无 `#include`、无逻辑、勿手改 |
| `zlua-runtime/LuaCompatible.h` | 手写 | 先可用 conf → 再选 Lua 头（官方 `lua.hpp` / JIT `extern "C"`）→ API shim（如 AbsIndex、IsInteger、NewUserData、PCall） |
| `zlua-runtime/Il2CppCompatible.h` | 手写 | 团结 vs Unity 的 il2cpp API 差（如 `Calloc`）；依赖 conf 中引擎宏 |
| `zlua-runtime/ZLuaCommon.h` | 手写 | 组装上述头；`#define ZLUA_LUA_VERSION LUA_VERSION_NUM`；断言 / 架构宏；**不再** 堆散落兼容细节 |
| `libil2cpp/lua/luaconf.h` | 上游 + patch | 定义 `ZLUA_FAST_METATABLE` |

**`ZLuaCommon.h` include 顺序（约定）：**

1. `generated/ZLuaConf.inc`  
2. `LuaCompatible.h`（内部再 include Lua 头并提供 shim）  
3. `Il2CppCompatible.h`（il2cpp 头 + 引擎 shim）  
4. 然后：

```c
#ifndef ZLUA_LUA_VERSION
#define ZLUA_LUA_VERSION LUA_VERSION_NUM
#endif

/* ZLUA_FAST_METATABLE 必须已由 luaconf.h 定义 */
#ifndef ZLUA_FAST_METATABLE
#error "ZLUA_FAST_METATABLE must be defined by lua/luaconf.h"
#endif
```

### 12.3 `ZLuaConf.inc` 生成宏

| 宏 | 取值 | 说明 |
|----|------|------|
| `ZLUA_USE_LUAJIT` | `0` \| `1` | 与 C# Scripting Define `ZLUA_USE_LUAJIT` 对齐；**不要** 使用旧名 `ZLUA_LUAJIT` |
| `ZLUA_LUA_API_FAMILY` | `501` / `503` / `504` / `505` … | API 族：官方取自选定系列（5.3→503）；**LuaJIT 约定 `501`**（能力判断仍优先看 `ZLUA_USE_LUAJIT`） |
| `ZLUA_TUANJIE_ENGINE` | `0` \| `1` | `1` = 团结引擎，`0` = Unity |
| `ZLUA_UNITY_VERSION` | 十进制整数 | 见 §12.4；Unity 与团结上均填写「Unity 版本线」编码 |
| `ZLUA_TUANJIE_VERSION` | `0` 或十进制 | **Unity 上固定 `0`**；团结上为团结引擎版本编码（与 Unity 版本不同） |
| `ZLUA_CONF_ID` | 字符串字面量 | 日志 / 对账，例：`"lua-5.3.8|unity-2021.3.45|tuanjie-0"` |

**明确不生成：**

| 宏 | 原因 |
|----|------|
| `ZLUA_LUA_VERSION` | 在 `ZLuaCommon.h` 中映射自 `LUA_VERSION_NUM`，不写进 conf |
| `ZLUA_FAST_METATABLE` | 仅由 `luaconf.h` 决定，保持 Table ABI 与 VM 一致 |

### 12.4 数值编码规则

**禁止前导 `0`**（C 预处理器会按八进制解析，且含 `8`/`9` 时非法）。

| 宏 | 编码 | 示例 |
|----|------|------|
| `ZLUA_UNITY_VERSION` | `YYYY * 10000 + minor * 100 + patch`（minor/patch 各两位，通常 &lt; 100） | `2021.3.45` → `20210345` |
| `ZLUA_TUANJIE_VERSION` | `major * 10000 + minor * 100 + patch`（同上；Unity 上为 `0`） | `1.9.3` → `10903` |
| `ZLUA_LUA_API_FAMILY` | `major * 100 + minor`（无 patch） | `5.4` → `504`；JIT → `501` |

比较示例：`#if ZLUA_UNITY_VERSION >= 20220300`。

精确小版本字符串对账用 `ZLUA_CONF_ID` 与 Install fingerprint（§9），**不要** 用数值宏冒充 patch 级身份。

### 12.5 能力判断优先级

| 场景 | 写法 |
|------|------|
| 是否 LuaJIT | `#if ZLUA_USE_LUAJIT` |
| 官方 API 族（5.3 vs 5.4…） | `#if !ZLUA_USE_LUAJIT && (LUA_VERSION_NUM >= 504)`，或 `ZLUA_LUA_API_FAMILY >= 504` |
| 精确 id 对账 | `ZLUA_CONF_ID` / fingerprint |
| 团结 vs Unity API | `#if ZLUA_TUANJIE_ENGINE`，必要时叠加 `ZLUA_UNITY_VERSION` / `ZLUA_TUANJIE_VERSION` |
| FastMT | `#if ZLUA_FAST_METATABLE`（仅 `luaconf.h`） |

LuaJIT 上 FastMT 不可用现有 PUC-Rio patch：Install 的 luaconf 应使 `ZLUA_FAST_METATABLE` 为 `0`；`LuaCompatible.h` 可对 `ZLUA_USE_LUAJIT && ZLUA_FAST_METATABLE` 做 `#error` 防护。

### 12.6 生成时机与权威路径

| 步骤 | 职责 |
|------|------|
| **`LocalInstaller`（权威）** | 每次 Install **成功后必须** 写入 Local `libil2cpp/zlua/generated/ZLuaConf.inc`；内容来自 Settings `luaVersionId`、`Application.unityVersion`、团结检测 |
| **`ZLua/Generate/All`（校验）** | 复写或校验同一语义；与 Settings / fingerprint 不一致则 **失败或强制刷新**，禁止静默使用过期 conf |
| **Player 编译** | **只认** Local 树中的 conf；包内 `ZLua~/zlua-runtime/generated` 与现有 stub 策略一致，**不是** 唯一真相源（UPM 只读时可能无法写入） |

Editor 侧须集中版本编码（建议 `EngineVersionUtil`，与 `LuaVersionUtil` 并列）：团结判定、`ZLUA_UNITY_VERSION` / `ZLUA_TUANJIE_VERSION` / `ZLUA_CONF_ID` 生成，避免散落解析。

### 12.7 示例

**官方 Lua 5.3.8 + Unity 2021.3.45：**

```c
/* Generated by ZLua Install/Generate. Do not edit. */
#define ZLUA_USE_LUAJIT         0
#define ZLUA_LUA_API_FAMILY     503
#define ZLUA_TUANJIE_ENGINE     0
#define ZLUA_UNITY_VERSION      20210345
#define ZLUA_TUANJIE_VERSION    0
#define ZLUA_CONF_ID            "lua-5.3.8|unity-2021.3.45|tuanjie-0"
```

**LuaJIT 2.1 + 团结（示意）：**

```c
/* Generated by ZLua Install/Generate. Do not edit. */
#define ZLUA_USE_LUAJIT         1
#define ZLUA_LUA_API_FAMILY     501
#define ZLUA_TUANJIE_ENGINE     1
#define ZLUA_UNITY_VERSION      20220362
#define ZLUA_TUANJIE_VERSION    10903
#define ZLUA_CONF_ID            "luajit-2.1|unity-2022.3.62|tuanjie-1.9.3"
```

### 12.8 与 Mono / C# Define 对照

| Il2Cpp（conf / 头） | Editor Mono |
|---------------------|-------------|
| `ZLUA_USE_LUAJIT`（0/1） | `#define ZLUA_USE_LUAJIT`（有则启用） |
| `ZLUA_LUA_API_FAMILY` | `ZLUA_LUA_5_1` / `ZLUA_LUA_5_3` / …（互斥一套） |
| `ZLUA_UNITY_*` / `ZLUA_TUANJIE_*` | 无对等 conf；Mono 不依赖 |
| `ZLUA_LUA_VERSION` ← `LUA_VERSION_NUM` | 无；P/Invoke 按 §8.3 API 族裁剪 |
| `ZLUA_FAST_METATABLE`（luaconf） | 不适用（无嵌入 Lua VM 源码） |

---

## 13. 文档地图更新说明

本文件纳入 `spec/**` 后：

- 包布局、Install、多版本与 **Il2Cpp conf/Compatible** 以 **本文** 为准  
- `00-OVERVIEW` 中「包内 `libil2cpp-2022` 整树」等过时表述应随实现同步修订  
- `impl/IL2CPP.md` 等实现笔记不得覆盖本文；冲突时先修订本文或征求确认
