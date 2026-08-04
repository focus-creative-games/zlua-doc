---
sidebar_position: 5
title: "第三方原生模块"
---

# 构建 — 第三方原生模块（socket / cjson 等）

> 约定游戏工程如何把 **非 zlua 随附** 的 Lua C 模块（如 lua-cjson、luasocket）接到 ZLua。  
> **不**把具体第三方库 vendoring 进 `com.code-philosophy.zlua`。  
> Editor 先例：[04-EMMYLUA-DEBUGGER](/docs/spec/build/04-EMMYLUA-DEBUGGER/)；多版本：[11-MULTI-VERSION](/docs/spec/11-MULTI-VERSION/)；宿主：[01-HOST-API](/docs/spec/01-HOST-API/)。  
> 使用指南：[第三方原生插件](/docs/guides/native-modules/)。

---

## 1. 目标与非目标

### 1.1 目标

| 项 | 约定 |
|----|------|
| 业务 API | 统一 `require("modname")`，与实现形态无关 |
| Editor | 动态库 + `package.cpath` + `require`（`luaopen_*`） |
| Player (Il2Cpp) | 静态链接进同一产物 + `luaL_requiref` / `package.preload` |
| 纯 Lua | 仅经 `moduleLoader` / 自定义 searcher，无原生 |
| ABI | 与 Settings `luaVersionId` **同一系列** |

### 1.2 非目标

| 项 | 态度 |
|----|------|
| 随包分发 socket / cjson 二进制或源码 | **不做**（许可、体积、版本矩阵） |
| Player 上依赖 `dlopen` + `cpath` | **不推荐**（iOS / WebGL；Android 成本高） |
| 改变 C#↔Lua 互操作语义 | **不做** |
| 替代 `moduleLoader` 加载 `.lua` | **不做**；原生与源码路径正交 |

### 1.3 现状（实现边界）

| 能力 | 行为 |
|------|------|
| `luaL_openlibs` | 仅标准库（Mono `LuaEnv` / Il2Cpp `LuaEnv::RegisterLibs`） |
| `moduleLoader` | **仅**返回模块源码（string / byte[]），不加载 `.dll/.so` |
| EmmyLua `emmy_core` | 包内唯一正式 C 模块集成先例 |
| 公共 `OpenLib` / `RegisterNativeModule` API | **当前无**；产品化钩子见 §6 |

---

## 2. 形态对照

| 形态 | 宿主 | 加载 |
|------|------|------|
| A 纯 Lua | Editor + Player | `moduleLoader(name)` → `load` |
| B 原生动态 | **仅 Editor Mono** | `package.cpath` → `require` → `luaopen_*` |
| C 原生静态 | **Il2Cpp Player** | 链接 `luaopen_*` → `luaL_requiref` / preload |

换 `luaVersionId` 后：所有原生插件必须 **按新系列重编** 并切换目录。

---

## 3. Editor（形态 B）

### 3.1 布局

按 **系列**（与 `Plugins/lua/<series>/`、`Plugins/emmylua/<series>/` 同一逻辑名）分目录，例如：

```text
<project>/zlua-native-modules/
  lua55/<os>/cjson.<ext>
  lua55/<os>/socket_core.<ext>
  luajit21/<os>/...
```

`<ext>`：Windows `dll`，macOS `dylib`，Linux Editor `so`。

### 3.2 PluginImporter

与 EmmyLua 相同：**所有平台 `enabled: 0`**。  
理由：模块由 Lua `require`/`loadlib` 加载；Unity 先 `LoadLibrary` 再 `require` 属于未定义/双载。

### 3.3 注入

`LuaAppDomain.Initialize` 完成且标准库已打开之后：

1. 解析当前系列与 OS，得到绝对目录 `absDir`；
2. 若 `package.cpath` 尚无该目录项，则追加 `absDir/?.ext`；
3. 按需 `require` 或仅依赖业务首次 `require`；
4. 复合库（luasocket）：先保证 `socket.core` 可被 C 加载，纯 Lua 外壳走 `moduleLoader`。

实现可参考包内 `EmmyLuaDebugger.BuildInitChunk`（防重复 append、缺目录只记日志等策略由工程自定）。

### 3.4 链接

- 插件须 **动态链接** 到同系列 Editor Lua DLL（如 `lua55.dll`），符号与调用约定一致。
- **禁止**在插件内再静态嵌入一份 Lua 解释器。

---

## 4. Il2Cpp Player（形态 C）

### 4.1 纳入链接

任选其一（工程自管构建）：

- 将插件 `.c/.cpp` 编入与 `libil2cpp`（含 `libil2cpp/lua`）相同的编译单元；或  
- 提供平台静态库（`.a` / `.lib`），在 iOS / Android / Windows Il2Cpp 链接阶段并入；iOS 导出对 Lua 为 `__Internal` 可见。

须与 Install 选定的 Lua 小版本 / Define（`ZLUA_LUA_5_x` / `ZLUA_USE_LUAJIT` 等）一致。

### 4.2 注册时机

在 `luaL_openlibs` **之后**、业务脚本执行 **之前**（概念上紧接 `LuaEnv::RegisterLibs` 尾部）：

```cpp
luaL_requiref(L, "cjson", luaopen_cjson, 1);
lua_pop(L, 1);
```

或写入 `package.preload["cjson"] = luaopen_cjson`（及 luasocket 的 `socket.core` 等），再 `require` 纯 Lua 外壳。

### 4.3 禁止

- 以 Player 运行时 `package.cpath` + 独立 `.so` 作为 **主路径**（尤其 iOS、WebGL）。
- 假设未重新 **Install / 出包** 即可拾取新的 `luaopen_*` 符号。

---

## 5. 项目侧 Bootstrap（推荐）

```text
NativeModuleBootstrap.Install(...)
  Editor  → 解析 series、拼 cpath、可选预 require
  Player  → 空操作（注册已在 native 完成）或断言 package.loaded
```

生命周期：`Initialize(moduleLoader)` → Bootstrap → 业务 `require`。

纯 Lua 外壳（如官方 `socket.lua`）一律走同一 `moduleLoader`，保证 Editor/Player 路径一致。

---

## 6. 产品化钩子（预留，非当前实现）

若需减少各项目重复代码，zlua **可**后续增加无具体库依赖的薄扩展点：

| 侧 | 建议 |
|----|------|
| Mono | `luaL_openlibs` 之后可选回调 / Settings 搜索路径列表 |
| Il2Cpp | `RegisterLibs` 之后弱符号或生成表（如 `ZLuaNativeModules.inc`）调用 `luaL_requiref` |
| Settings | 与 `luaAliasXmlPaths` 类似的路径约定字段（可选） |

**仍不**默认 vendoring 任何第三方库源码或二进制。

---

## 7. 库对照（信息性）

| 库 | `require` / open | 备注 |
|----|------------------|------|
| lua-cjson | `cjson` / `luaopen_cjson` | 注意 5.3+ integer 与 JIT 分编 |
| luasocket | `socket` + `socket.core` / `luaopen_socket_core` | 移动端阻塞与权限；可用 C# 网络栈替代 |
| 纯 Lua JSON | 任意模块名 | 形态 A |

---

## 8. 验收

- [ ] 选定系列下 Editor `require` 目标模块成功  
- [ ] 至少一款 Player 目标同脚本成功  
- [ ] PluginImporter 均为 disabled  
- [ ] 切换 `luaVersionId` 后旧二进制不可用且有明确失败，而非静默 ABI 错乱  
- [ ] 插件未静态嵌入第二份 Lua  

## 相关文档

- [第三方原生插件（指南）](/docs/guides/native-modules/)  
- [04-EMMYLUA-DEBUGGER](/docs/spec/build/04-EMMYLUA-DEBUGGER/)  
- [01-OFFICIAL-LUA](/docs/spec/build/01-OFFICIAL-LUA/) · [02-LUAJIT](/docs/spec/build/02-LUAJIT/)  
- [11-MULTI-VERSION](/docs/spec/11-MULTI-VERSION/)
