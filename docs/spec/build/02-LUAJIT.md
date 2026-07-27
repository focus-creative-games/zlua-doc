---
sidebar_position: 2
title: "LuaJIT 构建"
---

# 构建 — LuaJIT

> 本文约定 ZLua 在 **Editor（Mono）** 与 **Il2Cpp Player** 上如何接入 **LuaJIT**。  
> 官方 Lua（PUC-Rio）见 [01-OFFICIAL-LUA.md](/docs/spec/build/01-OFFICIAL-LUA/)。  
> Mono × JIT 的 `lua_error` gate 见 [03-MONO-LUAJIT-CALLBACK-GATE.md](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/)。  
> 包布局、Install、Define 总规范见 [11-MULTI-VERSION.md](/docs/spec/11-MULTI-VERSION/)。  
> 本文不改变 Lua 可见互操作语义。若与旧述「将完整 LuaJIT `src/` 拷入 `libil2cpp/lua`」冲突，**以本文为准**。

---

## 1. 与 PUC-Rio 的对比（摘要）

| | **LuaJIT（本文）** | **PUC-Rio**（[01-OFFICIAL-LUA.md](/docs/spec/build/01-OFFICIAL-LUA/)） |
|--|--------------------|----------------------------------------------------------|
| Settings id | `luajit-{major}.{minor}`（如 `luajit-2.1`） | `lua-X.Y.Z` |
| 源码缓存 | `LuaSrcCache/` 下 **手动 clone**（不自动下载；目录名以实现为准，常见 `luajit-2.1`） | 可自动下载 |
| Editor | 动态库（如 `luajit21.dll`）+ **callback gate** | 系列 `lua5x.dll`，无 gate |
| Il2Cpp | **仅公共头文件**；**静态 `.a` 由开发者放入 Plugins** | 完整可编译 `src/` |
| FastMT | **强制 `0`** | ≥5.3.2 可启用 |
| WebGL | ❌ **不支持** | ✅ |
| Il2Cpp 其它桌面平台 | ❌ **不支持**（仅 Android / iOS） | ✅ |

**原则：**

- **Editor** 通过 `DllImport` 加载 Plugins 动态库。  
- **Il2Cpp** 中 `zlua-runtime` 直接调用 `lua_*`；JIT 路径靠 **静态库链接** 提供符号。  
- Unity **不保证** 将 Windows import `.lib` 可靠链进 `GameAssembly`；故 Il2Cpp 交付面收敛为 **iOS / Android 静态 `.a`**。

---

## 2. 为何不能照搬「整树拷进 libil2cpp」

LuaJIT 构建是 **两阶段**：

```text
宿主：minilua → DynASM(vm_*.dasc) → buildvm
      → 生成 lj_*def.h、lj_vm.obj|lj_vm.S、luajit.h 等
目标：编译 lj_*.c / lib_*.c（或 ljamalg.c）并与 lj_vm 链接
```

| 障碍 | 说明 |
|------|------|
| 生成物 | 干净 clone / 官方 `msvcbuild` 收尾常 **删掉** 生成头；Il2Cpp 无法只靠上游 `.c` 编译 |
| `lj_vm` | 按 OS/CPU 生成的 obj/汇编，不是可移植 `.c` |
| `dynasm/`、`host/` | 宿主工具；不应作为 Player 编译单元 |
| 天真 glob | 会编进 `host/*.c`、`luajit.c`（`main`），或同时编 amalg 与分散源 → 失败 |
| WebGL | **无** WASM 后端，不可用 |

因此：**禁止** 把「未预生成的完整 LuaJIT `src/`」当作与 PUC 相同的 Il2Cpp 输入。  
「宿主预生成后再拷可编译子集」技术上可行，但维护矩阵大；**当前产品约定**为下文：头文件 + 静态库。

---

## 3. Editor（Mono）

| 项 | 约定 |
|----|------|
| Define | `ZLUA_USE_LUAJIT`（及实现所用的 `ZLUA_LUAJIT_2_0` / `ZLUA_LUAJIT_2_1` 等） |
| 动态库 | 开发者自备，逻辑名以实现为准（如 `luajit21` → `Plugins/x64/luajit21.dll`） |
| 源码 | 不强制编进 Editor；与 Il2Cpp 头文件 / `.a` 使用 **同一上游版本与关键宏** |
| `lua_error` | **不得**在托管 reverse-P/Invoke 帧内直接调用。须经 **native callback gate**（与 PUC Editor 相同）→ [03-MONO-LUAJIT-CALLBACK-GATE.md](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/) |

---

## 4. Il2Cpp Install：仅头文件

选定 LuaJIT 时，Install 向 `Local.../libil2cpp/lua` **只安装公共头**（至少包含实现编译所需者），例如：

- `lua.h`、`lauxlib.h`、`lualib.h`、`luaconf.h`、`luajit.h`

**不得**安装：`lj_*.c`、`lib_*.c`、`ljamalg.c`、`host/**`、`luajit.c`、未生成的中间产物等。

并强制 `ZLUA_FAST_METATABLE 0`（可在已安装的 `luaconf.h` 中写入）。

`zlua-runtime` 经 `LuaCompatible.h`（`ZLUA_USE_LUAJIT` 分支）包含上述头；链接符号由 §5 静态库提供。

---

## 5. Il2Cpp Player：开发者提供静态库

**支持的发布面（LuaJIT + Il2Cpp）：Android、iOS。**

| 平台 | 开发者义务 |
|------|------------|
| **iOS** | 自行交叉编译静态库，放入 Plugins（如 `Plugins/iOS/libluajit.a`），并在 PluginImporter 中启用 iOS |
| **Android** | 按 ABI 编译静态库（如 `arm64-v8a`、`armeabi-v7a`），放入约定目录（如 `Plugins/Android/libs/<abi>/libluajit.a`），启用对应 CPU |

说明：

- Unity 对 **iOS / Android 预编译静态库（`.a`）** 有文档化支持，可将符号链进最终 native 产物。  
- **不要**依赖「仅放置动态 `.so` + 修改 `build.gradle`」来解析 `libil2cpp` 内 C++ 对 `lua_*` 的引用：Android 上 `libil2cpp.so` 多在 **Bee/NDK 阶段**链接，Gradle 通常 **不能**补上该链接。  
- 头文件与 `.a` 必须来自 **同一 LuaJIT 版本**，且关键宏一致（例如 iOS 上常见 `LUAJIT_DISABLE_JIT`）。  
- 推荐文件名在包 README / Plugins 说明中写死（如 `libluajit.a`）。

---

## 6. 明确不支持 / 不保证

| 项 | 态度 |
|----|------|
| **WebGL / Win / macOS / Linux Il2Cpp + LuaJIT** | **不支持**；Il2Cpp + LuaJIT **仅 Android / iOS**。其它平台请改用 PUC-Rio（[01-OFFICIAL-LUA.md](/docs/spec/build/01-OFFICIAL-LUA/)）。Settings 为 JIT 时构建不支持的目标应 **失败并明确提示** |
| **Win / macOS / Linux Il2Cpp Player + 仅动态库** | **不支持**（与上同；不以动态库作为 Il2Cpp 交付路径） |
| **Il2Cpp 内现场跑 DynASM/buildvm** | **不做** |

---

## 7. 推荐的开发者编译提示（非唯一命令）

1. 使用与缓存中一致的 LuaJIT 源码树（如 `LuaSrcCache/luajit-2.1`）。  
2. 按目标 OS/ABI 完成官方宿主生成 + 静态库链接（参考上游 `Makefile` / `src/host/README`、交叉编译说明）。  
3. iOS：关闭 JIT（`LUAJIT_DISABLE_JIT`）除非有明确且受支持的例外。  
4. 将产出的 `.a` 放入 §5 路径，并确认 Inspector 中平台与 CPU 勾选正确。  
5. 重新 Install（头文件与 Define）后打 Il2Cpp 包，验证链接无 unresolved `lua_*`。

---

## 8. 检查清单（例：`luajit-2.1`）

- [ ] 已 clone 源码到 `LuaSrcCache`；执行 Install  
- [ ] `Local.../libil2cpp/lua` **仅有头文件**（无 `lj_*.c` 等）  
- [ ] Editor：`luajit21`（或约定名）动态库就位；具备 [callback gate](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/) 原生库  
- [ ] Define：`ZLUA_USE_LUAJIT`；`ZLUA_FAST_METATABLE` 为 `0`  
- [ ] Il2Cpp Android/iOS：对应 ABI 的 **`libluajit.a`（或约定名）已在 Plugins 且平台已启用**  
- [ ] 不在 WebGL 上使用本配置  

---

## 9. 与其它文档的分工

| 文档 | 内容 |
|------|------|
| [11-MULTI-VERSION.md](/docs/spec/11-MULTI-VERSION/) | UPM、Install、Define、fingerprint |
| [01-OFFICIAL-LUA.md](/docs/spec/build/01-OFFICIAL-LUA/) | PUC-Rio 源码进树 |
| **本文** | LuaJIT 头文件 + `.a`、平台限制 |
| [03-MONO-LUAJIT-CALLBACK-GATE.md](/docs/spec/build/03-MONO-LUAJIT-CALLBACK-GATE/) | Editor Mono × JIT 的 `lua_error` 安全边界 |
| [04-EMMYLUA-DEBUGGER.md](/docs/spec/build/04-EMMYLUA-DEBUGGER/) | Editor EmmyLua；JIT 下 hook 抑制性能可接受 |
