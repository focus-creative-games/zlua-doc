---
sidebar_position: 1
title: "官方 Lua（PUC-Rio）构建"
---

# 构建 — 官方 Lua（PUC-Rio 5.1.x–5.5.x）

> 本文约定 ZLua 在 **Editor（Mono）** 与 **Il2Cpp Player** 上如何接入 **PUC-Rio Lua**。  
> LuaJIT 见 [02-LUAJIT.md](02-LUAJIT.md)。  
> 包布局、Install 流水线、Define、`ZLuaConf.inc` 见 [11-MULTI-VERSION.md](../11-MULTI-VERSION.md)。  
> 本文不改变 Lua 可见互操作语义。

---

## 1. 与 LuaJIT 的对比（摘要）

| | **PUC-Rio（本文）** | **LuaJIT**（[02-LUAJIT.md](02-LUAJIT.md)） |
|--|---------------------|---------------------------------------------|
| Settings id | `lua-{major}.{minor}.{patch}`（如 `lua-5.3.6`） | `luajit-{major}.{minor}` |
| 源码缓存 | `LuaSrcCache/{id}/`（可自动下载） | 手动 clone |
| Editor | `Plugins` 系列动态库（如 `lua53.dll`）+ **callback gate** | `luajit21.dll` 等 + **callback gate** |
| Il2Cpp | **完整可编译 `src/`** 进 `libil2cpp/lua`（多平台） | **仅头文件** + 开发者自备 `.a`；**仅 Android / iOS** |
| FastMT | ≥5.3.2 可启用；其余见矩阵 | 强制 `0` |
| WebGL / 桌面 Il2Cpp | ✅（WebGL 等） | ❌ |

**原则（两条引擎共用）：**

- **Editor** 通过 `DllImport` 加载 Plugins 动态库。  
- **Il2Cpp** 中 `zlua-runtime` 直接调用 `lua_*`；PUC 路径靠把源码编进 `libil2cpp` 提供符号。

---

## 2. 为何可以直接进 `libil2cpp/lua`

PUC-Rio 是可移植纯 C 库：无宿主代码生成、无架构专用 VM 目标文件。Install 拷贝 `src/` 后，Unity/Il2Cpp 递归编译 `libil2cpp/**/*.c` 即可（去掉解释器入口源码）。

---

## 3. Install 行为（摘要）

1. 解析 `luaVersionId`；缓存缺失则从 `https://www.lua.org/ftp/` 下载。  
2. 对 **5.3+**（含 5.3.0/5.3.1）按 floor 应用 `ZLua~/patches/lua/...`（FastMT / VM 等）；**5.1 / 5.2 不** apply VM patch。  
3. 将处理后的 `src/` 复制到 `Local.../libil2cpp/lua`。  
4. 删除独立入口：`lua.c`、`luac.c`、`print.c`（若存在）。  
5. 按矩阵写入 / 强制 `ZLUA_FAST_METATABLE`；必要时对 5.1/5.2 做 Il2Cpp lump 相关的 `luaconf` 适配。  
6. 写入 Scripting Define（`ZLUA_LUA_5_1` … `ZLUA_LUA_5_5`）与 `ZLuaConf.inc`。

细节与 patch floor 算法见 [11-MULTI-VERSION.md](../11-MULTI-VERSION.md) §3、§5。

---

## 4. Editor 动态库

| API 族宏 | 逻辑名 | Windows 示例 |
|----------|--------|--------------|
| `ZLUA_LUA_5_1` | `lua51` | `Plugins/x64/lua51.dll` |
| `ZLUA_LUA_5_2` | `lua52` | `lua52.dll` |
| `ZLUA_LUA_5_3` | `lua53` | `lua53.dll` |
| `ZLUA_LUA_5_4` | `lua54` | `lua54.dll` |
| `ZLUA_LUA_5_5` | `lua55` | `lua55.dll` |

缺 DLL 时 Install **警告不失败**。换系列后须 **重启 Editor**。  
Editor 与 Player 所用小版本不必完全一致，但 API 族应匹配当前 Define。

Editor **须**使用 native callback gate（[03-MONO-LUAJIT-CALLBACK-GATE.md](03-MONO-LUAJIT-CALLBACK-GATE.md)）；与 LuaJIT 相同协议。

---

## 5. Il2Cpp 平台面

源码进树后，凡 Unity Il2Cpp 支持的目标（含 **Android / iOS / WebGL / 桌面** 等）均可按 Unity 常规流程构建；无额外「自备 `.a`」要求。

---

## 6. 检查清单（例：`lua-5.4.8`）

- [ ] Settings `luaVersionId` 正确；执行 Install  
- [ ] `Local.../libil2cpp/lua` 含完整库源码且无 `lua.c`/`luac.c`  
- [ ] `Plugins` 中有对应 `lua54.dll`（或目标 OS 等价物）；重启 Editor  
- [ ] Define 为 `ZLUA_LUA_5_4`（无 `ZLUA_USE_LUAJIT`）  
- [ ] 需要 FastMT 时确认小版本 ≥ 5.3.2 且 patch 已应用  

---

## 7. 与其它文档的分工

| 文档 | 内容 |
|------|------|
| [11-MULTI-VERSION.md](../11-MULTI-VERSION.md) | UPM 布局、Install 顺序、patch floor、Define、DLL 逻辑名、`ZLuaConf.inc` |
| **本文** | PUC-Rio 的 Editor DLL 与 Il2Cpp **源码进树**构建形态 |
| [02-LUAJIT.md](02-LUAJIT.md) | LuaJIT 头文件 + 静态库模型 |
