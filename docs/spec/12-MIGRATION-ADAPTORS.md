---
sidebar_position: 8
title: "迁移适配（xLua / toLua / SLua）"
---

# 12 — 迁移适配（xLua / toLua / SLua）

> 为从 **xLua / toLua / SLua** 迁到 ZLua 的项目提供 **Lua→C# 类型访问路径** 兼容层。  
> 本适配 **不** 改变 ZLua 核心语义；权威类型访问仍是 `CSharp[assemblyName][typeFullName]`（见 [02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/)）。  
> 实现交付物位于包内 `ZLua~/adaptors/{xlua|tolua|slua}/`（实现阶段落地；本文为契约）。

---

## 1. 目标与非目标

### 1.1 目标

| 目标 | 说明 |
|------|------|
| **降低改写量** | 旧脚本可继续写 `CS.UnityEngine.GameObject` / `GameObject` / `UnityEngine.GameObject` 等形式访问类型 |
| **白名单对齐旧框架** | 导出清单来自原方案的导出配置 / 特性，而非扫全量程序集 |
| **不侵入 ZLua 核心** | 适配为可选 Lua 模块 + 一次性 Editor 导出工具；不修改 `CSharp` 根表语义 |
| **三分案独立交付** | xLua / toLua / SLua 各自独占目录 `adaptors/{方案}/`，内含 `adaptor.lua` + `ExportTypes.cs` |

### 1.2 非目标（本阶段明确不做）

| 项 | 说明 |
|----|------|
| **C#→Lua** | `GetFunction` / 旧 `LuaFunction` / `[CSharpCallLua]` 等不在适配范围 |
| **成员调用语义对齐** | 重载、Event、`ref`/`out`、Marshal 等仍以 ZLua spec 为准；适配只解决 **类型表如何拿到** |
| **泛型构造语法兼容** | 如 xLua `CS.System.Collections.Generic.List(CS.System.Int32)` → 需改写为 `zlua.make_generic_type`（见 [05-LIB.md](/docs/spec/05-LIB/)） |
| **把适配做成 ZLua 默认全局** | 须开发者显式 `require` + `init`；不随 `zlualib.lua` 自动安装 |
| **扁平索引配置** | `export_types` **仅** 使用 `assemblyName → typeFullName[]`；**不**生成 path / 短名扁平表 |

### 1.3 访问形态对照

以 `UnityEngine.CoreModule.dll` 中的 `UnityEngine.GameObject` 为例：

| 方案 | 获取类型 |
|------|----------|
| **ZLua（原生）** | `CSharp['UnityEngine.CoreModule']['UnityEngine.GameObject']` |
| **xLua** | `CS.UnityEngine.GameObject` |
| **toLua** | `GameObject`（全局短名） |
| **SLua** | `UnityEngine.GameObject` |

适配层把后三者 **重定向** 到前者对应的类型表。

---

## 2. 交付物与部署模型

### 2.1 包内权威源（只读模板）

```
Packages/com.code-philosophy.zlua/ZLua~/adaptors/
├── README.md                 -- 总览：复制路径、require 示例、能力边界
├── xlua/
│   ├── adaptor.lua           -- init：挂 CS.* 命名空间树
│   └── ExportTypes.cs        -- 菜单 ZLua/ExportTypes（xLua 工程用）
├── tolua/
│   ├── adaptor.lua           -- init：挂全局短名
│   └── ExportTypes.cs        -- 同上（toLua 工程用）
└── slua/
    ├── adaptor.lua           -- init：挂 UnityEngine.* 等命名空间树
    └── ExportTypes.cs        -- 同上（SLua 工程用）
```

三者 **互不依赖**：每个 `adaptors/{方案}/` 目录自成一套；`adaptor.lua` 只配合 **同目录** `ExportTypes.cs` 生成的清单使用。

### 2.2 开发者侧部署（必须复制）

| 文件 | 部署方式 |
|------|----------|
| `adaptors/{方案}/adaptor.lua` | 复制到业务 Lua 源码目录中 **LuaLoader / moduleLoader 可 `require` 到的位置**（复制后的模块名由放置路径决定，常见为 `adaptor`） |
| `adaptors/{方案}/ExportTypes.cs` | 复制到对应旧框架工程的 **Editor** 目录（与 xLua / toLua / SLua Editor 脚本同级或子目录均可） |
| 生成的 `*_export_types.lua` | 由菜单生成后，再放入业务 Lua 源码目录（建议纳入版本库） |

适配 **不会** 随 ZLua 初始化自动加载；未复制 / 未 `require` 则无任何全局副作用。

### 2.3 推荐入口脚本

```lua
local export_types = require "xlua_export_types"   -- 或 tolua_ / slua_ 前缀，与生成文件名一致
local adaptor = require "adaptor"                  -- 已复制到 Lua 搜索路径的 adaptor.lua

adaptor.init(export_types)
```

`require` 模块名以项目 loader 约定为准；上表仅为示意。

---

## 3. 导出清单格式（`export_types`）

### 3.1 唯一形状

生成物为 **单个 Lua 模块**，返回：

```lua
-- 示例：xlua_export_types.lua（tolua_ / slua_ 同构）
return {
  ["UnityEngine.CoreModule"] = {
    "UnityEngine.GameObject",
    "UnityEngine.Transform",
  },
  ["Assembly-CSharp"] = {
    "Demo.Foo",
    "Bar",   -- 无命名空间类型：FullName == Name
  },
}
```

| 约束 | 说明 |
|------|------|
| **键** | 程序集名，与 ZLua `CSharp[assemblyName]` 所用键一致（通常为简单名，如 `UnityEngine.CoreModule`、`Assembly-CSharp`） |
| **值** | 该程序集内类型的 **CLR `Type.FullName`** 字符串数组（非 AQN；嵌套类型用 `+`，与 CLR 一致） |
| **禁止** | 扁平 path 索引、短名字段、多方案共用的「解析目标」旁路表 |

各 `adaptors/{方案}/adaptor.lua` 在 `init` 时 **自行** 由 `FullName` 推导挂载路径（命名空间分段 / 短名），不依赖导出工具再写一份索引。

### 3.2 导出范围（硬约束）

| 方案 | 扫描源（须对齐旧工程真实白名单） |
|------|----------------------------------|
| **xLua** | `[LuaCallCSharp]` 及工程内既有 Gen / 配置所覆盖的类型集合 |
| **toLua** | `CustomSettings` / `ExportToLua` 等既有导出列表 |
| **SLua** | `[CustomLuaClass]` 等既有导出标记 / 配置 |

**禁止** 默认「遍历所有已加载程序集 public 类型」作为主路径；否则清单与旧运行时可用集合不一致，造成迁移假成功。

### 3.3 MVP 类型范围

| 包含 | 不包含（本阶段） |
|------|------------------|
| 白名单中的 **非开放泛型** 具名类型（含普通 class / struct / enum / delegate **类型表** 获取） | 开放泛型定义的「xLua 式调用构造」语法兼容 |
| 无命名空间类型（`FullName` 无 `.`） | 数组类型特殊挂载（`T[]` 等仍走 ZLua `make_*array_type` / 原生路径） |

开放泛型若出现在旧白名单中：导出工具可 **跳过并告警**，或导出其 `FullName`（如 `System.Collections.Generic.List`1`）供 `CSharp[...][...]` 取泛型定义表；**不得**声称已兼容旧框架的 `List(Int32)` 调用写法。

### 3.4 输出路径

| 项 | 规范 |
|----|------|
| **菜单** | `ZLua/ExportTypes`（三个 Editor 脚本各自注册；并存于同一工程时仅应复制 **当前方案** 那一份，避免菜单重复） |
| **默认输出** | 可配置；**推荐** 直接写到业务可 `require` 的 Assets（或项目约定的 Lua 根）下，例如 `Assets/**/xlua_export_types.lua` |
| **不推荐** | 以 `Library/ZLua/...` 为唯一落点（`Library` 可被清理，且仍需二次复制） |
| **文件名** | 按方案区分：`xlua_export_types.lua` / `tolua_export_types.lua` / `slua_export_types.lua` |

---

## 4. Adaptor 行为契约

### 4.1 公共 API

每个 `adaptors/{方案}/adaptor.lua` 模块导出：

```lua
local M = {}

--- @param export_types table  -- §3.1 形状
function M.init(export_types)
  -- 幂等：重复 init 须安全（已缓存叶子不重复报冲突；或文档约定只调用一次）
end

return M
```

命名统一为 **`init`**（不再使用 `init_xlua_adaptor` / `init_lua2cs_adaptor` 等别名）。

### 4.2 解析与挂载

对清单中每个 `(assemblyName, typeFullName)`：

1. **有命名空间**：只建 / 合并中间命名空间表，把叶子记入该表的 pending；**禁止**在 `init` 时访问 `CSharp[...][...]`。首次 `ns.name` 经 `__index` 再解析类型表并 `rawset` 缓存。
2. **无命名空间**（FullName 不含 `.`，或 toLua 短名挂 `_G`）：`init` 时 **立即** `resolve` + `rawset` 到根。
3. **跨程序集合并**：同一命名空间前缀必须挂到 **同一棵** 中间表树上。
4. **失败**（惰性或急切解析时）：类型不存在 → **`error`**，消息含 `assemblyName` 与 `typeFullName`。
5. **冲突**：同一路径指向不同类型 / 叶子与命名空间互撞 → **`error`**；禁止静默覆盖。

### 4.3 xLua：`adaptors/xlua/adaptor.lua`

| 项 | 行为 |
|----|------|
| **根** | 全局 `CS`；若已存在且为 table 则 **合并**，不得无条件覆盖整表 |
| **路径** | `typeFullName` 按 `.` 分段；最后一段为叶子类型名，前面各段为命名空间表 |
| **示例** | `UnityEngine.GameObject` → `CS.UnityEngine.GameObject` |
| **无命名空间** | `Bar` → `CS.Bar` |
| **中间表** | `init` 时创建并挂到父表；带 `__index`，仅在访问叶子名时解析 `CSharp[asm][full]` 并缓存 |

嵌套类型（`Outer+Inner`）：MVP 可将 `+` 视为叶子名的一部分挂在父命名空间下，或跳过并告警；须在 adaptor README 写明选定规则，三者文档一致即可。

### 4.4 toLua：`adaptors/tolua/adaptor.lua`

| 项 | 行为 |
|----|------|
| **根** | `_G` |
| **路径** | 短名 = CLR `Type.Name`（与 toLua 导出全局名惯例一致；**不是** FullName） |
| **示例** | `UnityEngine.GameObject` → `_G.GameObject` |
| **无命名空间** | `Bar` → `_G.Bar` |
| **冲突** | 短名冲突率最高，**必须**在 `init` 阶段 fail-fast |

### 4.5 SLua：`adaptors/slua/adaptor.lua`

| 项 | 行为 |
|----|------|
| **根** | `_G`（无 `CS` 前缀） |
| **路径** | 与 xLua 相同的命名空间分段，但顶层段直接挂在 `_G` |
| **示例** | `UnityEngine.GameObject` → `_G.UnityEngine.GameObject` |
| **污染控制** | 只创建清单中出现过的顶层命名空间；不预创建无关全局 |

### 4.6 急切 vs 惰性（硬约束）

| 类型 | 策略 |
|------|------|
| **无命名空间**（FullName 不含 `.`；toLua 全部短名） | `init` 时 **立即** `CSharp[asm][full]` + `rawset` 到根（`CS` / `_G`） |
| **有命名空间**（xLua / SLua） | `init` **只** 建命名空间表与 pending 叶子；**不得**预解析类型。首次 `namespace.TypeName` 走 `__index` → `CSharp[asm][full]` → `rawset` 缓存 |

未在 pending / 已缓存中的名字：`__index` 返回 **`nil`**（与「未导出不可用」一致）。

---

## 5. Editor 导出工具契约

### 5.1 三分案独立脚本

| 包内路径 | 适用工程 | 菜单 |
|----------|----------|------|
| `adaptors/xlua/ExportTypes.cs` | 仍含 xLua 的工程（迁移前或对照工程） | `ZLua/ExportTypes` |
| `adaptors/tolua/ExportTypes.cs` | toLua 工程 | `ZLua/ExportTypes` |
| `adaptors/slua/ExportTypes.cs` | SLua 工程 | `ZLua/ExportTypes` |

脚本 **复制** 到目标工程 Editor 后生效；不作为 ZLua UPM 包对任意工程自动注册的菜单（避免无旧框架程序集时编译失败）。实现时：对旧框架类型的引用须可编译——即脚本放在 **已引用 xLua/toLua/SLua** 的工程中。

### 5.2 生成步骤

1. 按 §3.2 收集类型集合。  
2. 按 `type.Assembly` 分组，写入 §3.1 Lua 表。  
3. 写出 UTF-8 Lua 文件到配置路径。  
4. 控制台打印输出路径；可选 Reveal in Explorer。

### 5.3 稳定性

- 同一输入多次生成，键序 / 数组成员序宜 **稳定排序**（按程序集名、FullName 序），便于 diff。  
- 生成文件头部可含注释：`生成时间`、`来源方案`、`ZLua adaptor 版本说明`（注释不影响 `return`）。

---

## 6. 使用流程（规范步骤）

```text
1. 在旧工程复制对应 adaptors/{方案}/ExportTypes.cs → Editor
2. 菜单 ZLua/ExportTypes → 得到 xxx_export_types.lua
3. 将 xxx_export_types.lua 与对应 adaptors/{方案}/adaptor.lua 放入 ZLua 工程 Lua 源码目录
4. 入口脚本 require 两者并 adaptor.init(export_types)
5. 旧 Lua→C# 类型访问路径在适配范围内可用；其余语义按 ZLua spec 回归
```

---

## 7. 与其它文档的关系

| 主题 | 文档 |
|------|------|
| `CSharp` / 类型表 / 懒绑定 | [02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) |
| `zlua.make_generic_type` 等 | [05-LIB.md](/docs/spec/05-LIB/) |
| 迁移操作说明（人读指南） | [guides/migration/](/docs/guides/migration/) |
| 特性对比（非规范） | [compare/FEATURES.md](/docs/compare/FEATURES/) |

**冲突裁决：** 本文与指南表述冲突时，以 **本文（spec）** 为准。

---

## 8. 验收标准（实现完成后）

| # | 标准 |
|---|------|
| 1 | 仅复制 adaptor + 清单并 `init` 后，样例旧路径能取到与 `CSharp[asm][full]` **同一** 类型表引用（或等价可用） |
| 2 | 跨 assembly 的相同命名空间前缀合并为同一中间表 |
| 3 | 短名 / 路径冲突、缺失类型均在 `init` 或首次解析时 **明确 error** |
| 4 | 未 `init` 时无 `CS` / 短名等额外全局（除开发者其它脚本） |
| 5 | 文档声明的非目标（C#→Lua、泛型调用语法等）无虚假兼容 |
| 6 | 三分案目录独立（`adaptors/xlua|tolua|slua/`）：不出现「一份 adaptor 用开关兼容三方案」的实现 |
