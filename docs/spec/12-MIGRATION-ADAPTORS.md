---
sidebar_position: 8
title: "迁移适配（xLua / toLua / SLua）"
---

# 12 — 迁移适配（xLua / toLua / SLua）

> 为从 **xLua / toLua / SLua** 迁到 ZLua 的项目提供 **Lua→C# 类型访问路径** 兼容层。  
> 本适配 **不** 改变 ZLua 核心语义；权威类型访问仍是 `CSharp[assemblyName][typeFullName]`（见 [02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/)）。  
> 实现交付物位于包内 `ZLua~/adaptors/`（本文为契约）。

---

## 1. 目标与非目标

### 1.1 目标

| 目标 | 说明 |
|------|------|
| **降低改写量** | 旧脚本可继续写 `CS.UnityEngine.GameObject` / `UnityEngine.GameObject` 等形态访问类型 |
| **白名单对齐旧框架** | 导出清单来自原方案的导出配置 / 特性，而非扫全量程序集 |
| **不侵入 ZLua 核心** | 适配为可选 Lua 模块 + 一次性 Editor 导出工具；不修改 `CSharp` 根表语义 |
| **一份 adaptor + 三分案 Export** | 共用 `adaptor.lua`；xLua / toLua / SLua 各自一份 `ExportTypes.cs` 生成同构清单 |

### 1.2 非目标（本阶段明确不做）

| 项 | 说明 |
|----|------|
| **C#→Lua** | `GetFunction` / 旧 `LuaFunction` / `[CSharpCallLua]` 等不在适配范围 |
| **成员调用语义对齐** | 重载、Event、`ref`/`out`、Marshal 等仍以 ZLua spec 为准；适配只解决 **类型表如何拿到** |
| **泛型构造语法兼容** | 如 xLua `CS.System.Collections.Generic.List(CS.System.Int32)` → 需改写为 `zlua.make_generic_type`（见 [05-LIB.md](/docs/spec/05-LIB/)） |
| **把适配做成 ZLua 默认全局** | 须开发者显式 `require` + `init`；不随 `zlualib.lua` 自动安装 |

### 1.3 访问形态对照

以 `UnityEngine.CoreModule.dll` 中的 `UnityEngine.GameObject` 为例：

| 方案 | 获取类型 |
|------|----------|
| **ZLua（原生）** | `CSharp['UnityEngine.CoreModule']['UnityEngine.GameObject']` |
| **xLua** | `CS.UnityEngine.GameObject` |
| **toLua** | `UnityEngine.GameObject`（`BeginModule` 命名空间链 + 类型短名；**不是** 仅全局 `GameObject`） |
| **SLua** | `UnityEngine.GameObject` |

适配层把后三者 **重定向** 到前者对应的类型表。差异由清单中的 `top_namespace` / `export_name` 表达，**不**再拆三份 adaptor 逻辑。

---

## 2. 交付物与部署模型

### 2.1 包内权威源（只读模板）

```
Packages/com.code-philosophy.zlua/ZLua~/adaptors/
├── README.md
├── adaptor.lua               -- 唯一 Lua 适配实现
├── xlua/
│   └── ExportTypes.cs        -- 菜单 ZLua/ExportTypes（xLua 工程用）
├── tolua/
│   └── ExportTypes.cs
└── slua/
    └── ExportTypes.cs
```

### 2.2 开发者侧部署（必须复制）

| 文件 | 部署方式 |
|------|----------|
| `adaptors/adaptor.lua` | 复制到业务 Lua 源码目录中 **LuaLoader / moduleLoader 可 `require` 到的位置** |
| `adaptors/{方案}/ExportTypes.cs` | 复制到对应旧框架工程的 **Editor** 目录 |
| 生成的 `*_export_types.lua` | 由菜单生成后放入业务 Lua 源码目录（建议纳入版本库） |

### 2.3 推荐入口脚本

```lua
local export_types = require "xlua_export_types"  -- 或 tolua_ / slua_
local adaptor = require "adaptor"

adaptor.init(export_types)
```

---

## 3. 导出清单格式（`export_types`）

### 3.1 唯一形状

```lua
return {
  top_namespace = "CS",  -- 可选；缺省 / "" / nil → 挂到 _G
  types = {
    ["UnityEngine.CoreModule"] = {
      { full_name = "UnityEngine.GameObject" },
      { full_name = "UnityEngine.Transform" },
    },
    ["Assembly-CSharp"] = {
      { full_name = "Demo.Foo" },
      { full_name = "Bar" },
      -- 嵌套类型：export_name 与 full_name 不同时才写出
      { full_name = "Ns.Outer+Inner", export_name = "Ns.Outer.Inner" },
    },
  },
}
```

| 字段 | 说明 |
|------|------|
| `top_namespace` | **单段** 根表名（如 `"CS"`）。省略则根为 `_G`。**禁止** 多段（如 `Foo.Bar`） |
| `types` | 程序集名 → **条目数组** |
| `full_name` | CLR `Type.FullName`（非 AQN；嵌套用 `+`），用于 `CSharp[asm][full_name]` |
| `export_name` | 相对根的 Lua 点号路径（**不含** `top_namespace` 前缀）。**省略时等价于 `full_name`**；仅当与 `full_name` 不同时写出（如嵌套 `+`→`.`、toLua `SetLibName` 别名） |

`export_name` 由各方案 `ExportTypes` 填入（相同时省略）；adaptor 在缺省时用 `full_name`，**不**再猜测其它挂载规则。

### 3.2 各方案如何填写（ExportTypes 职责）

| 方案 | `top_namespace` | `export_name` 默认规则 |
|------|-----------------|------------------------|
| **xLua** | `"CS"` | `FullName` 将 `+` 换成 `.` |
| **toLua** | 省略 | 与运行时注册路径一致：有命名空间则为 `nameSpace .. "." .. libName`（如 `UnityEngine.GameObject`）；`SetNameSpace(null)` 时仅为 `libName`；`SetLibName` 覆盖 `libName` |
| **SLua** | 省略 | 默认同 xLua（`FullName` 的 `+`→`.`）；`OnAddCustomClass(t, typename)` 在 `typename ~= null` 时用该别名（如 `"ListInt"`、`"String"`） |

> **toLua 更正：** 官方 README 部分 demo 易误导为「全局短名」；实际 `LuaBinder` / `BeginModule` 按 **命名空间链** 注册。Export 与 adaptor 必须以 `UnityEngine.GameObject` 这类路径为准。

### 3.3 导出范围（硬约束）

| 方案 | 扫描源 |
|------|--------|
| **xLua** | `[LuaCallCSharp]` 及 Gen 配置所覆盖类型（`Generator.LuaCallCSharp`） |
| **toLua** | `CustomSettings.customTypeList`（`BindType`） |
| **SLua** | `[CustomLuaClass]` / 自定义命名空间 / `OnAddCustomClass`（对齐 `LuaCodeGen.Custom`） |

**禁止** 默认扫全量 public 类型作为主路径。

### 3.4 MVP 类型范围

| 包含 | 不包含（本阶段） |
|------|------------------|
| 白名单中的 **非开放泛型** 具名类型 | 开放泛型的旧式 `List(Int32)` 调用语法 |
| 无命名空间类型（`export_name` 无 `.`） | 数组类型特殊挂载 |

开放泛型 / FullName 含 `[`：导出时可 **跳过并告警**。

### 3.5 输出路径

| 项 | 规范 |
|----|------|
| **菜单** | `ZLua/ExportTypes`（三分案各自注册；同工程只复制一份） |
| **默认输出** | 如 `Assets/ZLua/xlua_export_types.lua`（常量可改） |
| **文件名** | `xlua_export_types.lua` / `tolua_export_types.lua` / `slua_export_types.lua` |

---

## 4. Adaptor 行为契约（唯一 `adaptor.lua`）

### 4.1 公共 API

```lua
local M = {}

--- @param export_types table  -- §3.1
function M.init(export_types)
end

return M
```

### 4.2 根表

- 若 `top_namespace` 为非空字符串：使用全局该名作为根；已存在且为 table → **合并**；否则新建 `{}`。
- 否则根为 `_G`。

### 4.3 急切 vs 惰性（硬约束）

对每条条目：`export_name` 缺省时取 `full_name`。

| 有效 `export_name` | 策略 |
|--------------------|------|
| **不含** `.` | `init` 时立即 `CSharp[asm][full_name]` + `rawset(root, export_name, typeTable)` |
| **含** `.` | `init` **只** 建中间命名空间表并登记 pending；**禁止**预解析。首次访问叶子经 `__index` → resolve → `rawset` 缓存 |

跨 assembly 的相同 `export_name` 前缀必须合并到 **同一棵** 命名空间树。

### 4.4 失败与冲突

- 解析失败 → **`error`**（含 asm + full_name）。
- 同一路径指向不同 `(asm, full_name)`，或叶子与命名空间互撞 → **`error`**。
- 未导出名：`__index` 返回 **`nil`**。

### 4.5 幂等

重复 `init`：相同路径相同目标允许；冲突仍报错。

---

## 5. Editor 导出工具契约

### 5.1 三分案独立脚本

| 包内路径 | 适用工程 |
|----------|----------|
| `adaptors/xlua/ExportTypes.cs` | xLua |
| `adaptors/tolua/ExportTypes.cs` | toLua |
| `adaptors/slua/ExportTypes.cs` | SLua |

须复制到已引用对应框架的工程 Editor 后使用。

### 5.2 生成步骤

1. 按 §3.3 收集类型（及 toLua/SLua 别名信息）。  
2. 写入 §3.1 形状（`top_namespace` / `full_name`；仅当 `export_name ≠ full_name` 时写出 `export_name`）。  
3. UTF-8 写出；打印路径；非 batch 可 Reveal。  
4. 键序 / 数组按程序集名、`full_name` **稳定排序**。

---

## 6. 使用流程

```text
1. 复制对应 ExportTypes.cs → 旧工程 Editor
2. ZLua/ExportTypes → xxx_export_types.lua
3. 复制 adaptor.lua + 清单到 ZLua 工程 Lua 目录
4. require 两者并 adaptor.init(export_types)
```

---

## 7. 与其它文档的关系

| 主题 | 文档 |
|------|------|
| `CSharp` / 类型表 | [02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) |
| 迁移指南 | [guides/migration/](/docs/guides/migration/) |
| 特性对比（非规范） | [compare/FEATURES.md](/docs/compare/FEATURES/) |

**冲突裁决：** 以 **本文** 为准。指南 / README demo 若写 toLua「仅全局短名」，以本文 §1.3 / §3.2 更正为准。

---

## 8. 验收标准

| # | 标准 |
|---|------|
| 1 | 一份 `adaptor.lua` + 方案清单即可还原 xLua `CS.*`、toLua/SLua 命名空间链（及 toLua `SetNameSpace(null)` 根名） |
| 2 | 含 `.` 的 `export_name` 惰性；不含 `.` 急切 |
| 3 | 冲突 / 缺失明确 `error` |
| 4 | 未 `init` 无额外全局副作用 |
| 5 | ExportTypes 三分案独立；adaptor 不出现方案开关分支表 |
