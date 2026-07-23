---
sidebar_position: 0
title: 为什么选择 ZLua
description: 更易用、更完备、更快、更少 GC、更小桥接 —— ZLua 相对 xLua / toLua / SLua 的选型理由。
---

# 为什么选择 ZLua

xLua、toLua、SLua 已经证明「在 Unity 里用 Lua」可行。ZLua 要解决的是下一层问题：**把 Lua↔C# 做成真正现代、完备、且在 Il2Cpp 上足够快、足够省的互操作**——而不是再堆一套配置、白名单和海量 Wrap。

详细矩阵见 **[选型对比](../compare/)**；迁移见 **[migration](../community/migration/)**。

---

## 七个理由（30 秒）

| | 一句话 |
|--|--------|
| **更易用** | 设计更现代；极度简单；**零配置**（无需 per-type C# Wrap 白名单） |
| **更完备** | 标准、完备的 C#↔Lua 交互，几乎覆盖全部常用 C# 特性 |
| **更高效** | **98.2%** 对齐用例快于 xLua；Lua→C# 平均约 **2.62×**；常见字段/属性/调用约 **4×** |
| **更少更快的 GC** | 引用类型与 struct（含含引用字段的 struct）默认 **0 GC**；另有 OpaqueValue 等策略 |
| **极小的桥接** | 同签名合并 + 直接生成高效 C++；体积可小一个数量级；支持 **0 桥接函数** 仍保持高性能 |
| **版本更广** | Lua **5.1–5.5**、**LuaJIT**；Unity **2021+**、**团结引擎** |
| **维护更积极** | 全职专业团队；Bug 响应与特性迭代更快 |

---

## 1. 更易用：现代、简单、零配置

传统方案的心智负担往往是：

- 维护 `LuaCallCSharp` / 导出列表
- 改 API 就要重新 Generate **海量 C# Wrap**
- C#→Lua 走命令式 `LuaEnv` / `GetInPath` / `Call`

ZLua 把互操作做成接近 **P/Invoke** 的声明式模型：

| 你要做的事 | ZLua |
|------------|------|
| C# 调 Lua | `[LuaInvoke("mod", "fn")] static extern …` |
| 覆盖编组 | `[LuaMarshalAs]` |
| Lua 访问 C# | `CSharp` 根表懒加载，**无需**为每个类型写 Wrap 配置 |

```csharp
[LuaInvoke("app", "add")]
private static extern int AppAdd(int a, int b);
// AppAdd(10, 20);
```

```lua
CSharp['AC'] = CSharp['Assembly-CSharp']
print(CSharp.AC.Demo.Add(3, 5))
```

**零配置**指：不需要 per-type C# Wrap 白名单与成员级 Wrap 工程。Editor 开箱即用；发 Il2Cpp Player 时执行一次 **`ZLua/Generate/All`**（生成 **C++ stub**，不是 xLua 式 C# Wrap）。

→ [快速开始](../getting-started/quick-start) · [C# 调用 Lua](../guides/csharp-to-lua)

---

## 2. 更完备：几乎能调到的 C# 都能调

目标不是「导出几个热路径 API」，而是 **标准和完备的 C#↔Lua 交互**，包括但不限于：

| 类别 | 能力 |
|------|------|
| 类型 | class / struct / interface / enum / nullable |
| 成员 | 静态与实例：字段、属性、方法 |
| 高级 | 泛型类、泛型方法、delegate、数组（含多维） |
| 语言细节 | 方法重载、`ref` / `out` / `in`、Event（`add_` / `remove_`） |

语义以 [规范](../spec/00-OVERVIEW) 为契约；双端（Mono Editor / Il2Cpp Player）**Lua 可见行为一致**。

→ [兼容性矩阵](../getting-started/compatibility) · [特性对比](../compare/FEATURES)

---

## 3. 更高效：不是「理论上快一点」

在 **Il2Cpp Win64 Release** 上与 xLua 对齐基准（见 [PERFORMANCE](../compare/PERFORMANCE)）：

| 指标 | 结果 |
|------|------|
| 领先比例 | **98.2%** 用例快于 xLua（279 领先 / 5 落后） |
| Lua→C# 平均 | 约 **2.62×**（231 用例全胜） |
| 常见字段 / 属性 / 函数调用 | 约 **4×**（例如 `field.get.int` ≈ 3.6×，大量 prop/field 落在 3.5–4.3×） |
| C#→Lua | 平均约 **1.66×**；`int[]` / `class` 等可达 **5–6×** |

根因很直接：去掉 **libxlua 折返 + 海量 C# Wrap**，在 C++ 里一次完成 marshal 与 `methodPointer` 调用。

:::tip
互调再快，也要先 profiling。若脚本边界只占帧时间 2%，五倍互调也只省约 1.6%。ZLua 适合 **战斗公式、UI、每帧大量小调用** 这类边界热点。
:::

→ [性能对比](../compare/PERFORMANCE)

---

## 4. 更少更快的 GC

默认策略面向热路径：

| 策略 | 含义 |
|------|------|
| **引用类型** | 默认走对象表 / userdata，避免无意义装箱与临时 `object[]` |
| **struct** | 无论字段中是否含引用类型，默认可走 **0 GC** 编组路径（ByVal / ByObj 等，见规范） |
| **OpaqueValue** | lightuserdata 临时句柄：同步调用链内更灵活的低分配策略 |
| **enum** | 默认 integer，不强制 boxed userdata |

需要写回时用 Opaque / ByVal userdata；裸 number **不回写**（与 C# `ref` 语义对齐，见 [ref/out/in](../guides/marshal-ref-out-in)）。

→ [GC 对比](../compare/GC) · [生命周期规范](../spec/10-LIFETIME)

---

## 5. 极小的 wrapper / 桥接：可小一个数量级，可至 0

| 方案 | 典型体积模型 |
|------|----------------|
| xLua / toLua / SLua | **每类型 / 每成员** 生成 Wrap，体积近似随导出成员线性膨胀 |
| **ZLua（Il2Cpp）** | **合并同签名** 桥接函数，直接生成高效 **C++** stub（ReducedType 复用） |

因此在「仍能访问几乎全部 C# 类型、字段、属性、方法」的前提下：

- 桥接代码体积通常比传统方案 **小一个数量级以上**
- 支持 **0 桥接函数** 配置；即便如此，交互性能仍可高于「生成大量 Wrap」的传统路径

Editor（Mono）用 Expression Emit，**不进 Player 包**；Player 体积由 C++ stub 决定。

→ [桥接与体积](../compare/BRIDGE)

---

## 6. 支持的 Unity 与 Lua 更多

| 维度 | ZLua |
|------|------|
| Lua | **5.1 – 5.5**、**LuaJIT**（默认分发与主验证线为 **5.4**） |
| Unity | **2021+**（主验证 **2022.3 LTS**） |
| 引擎 | **团结引擎** |

多版本意味着更少「卡在某个 Lua/Unity 组合」的选型风险。当前文档与 Demo 默认环境：Unity **2022.3** + Lua **5.4**。

→ [支持的版本与平台](../getting-started/compatibility)

---

## 7. 维护更积极

ZLua 由 **全职专业团队** 维护：

- Bug 响应更积极
- 特性与规范迭代更快
- 文档、基准与包内 `Docs` 同源演进

适合把 Lua 互操作当作 **长期基础设施**，而不是「停更的第三方插件」。

---

## 不适合选 ZLua 的情况

诚实边界同样重要：

| 情况 | 建议 |
|------|------|
| **不愿维护 libil2cpp 集成** | 插件形态的 xLua / toLua 更轻 |
| **强依赖 xLua Hotfix 管线** | 继续使用 xLua |
| **已有大量 xLua 资产、短期无迁移预算** | 先读 [从 xLua 迁移](../community/migration/from-xlua) |

---

## 下一步

1. [5 分钟快速开始](../getting-started/quick-start) + [zlua-demo](https://github.com/focus-creative-games/zlua-demo)
2. [性能对比](../compare/PERFORMANCE) · [GC](../compare/GC) · [BRIDGE](../compare/BRIDGE)
3. [特性对比](../compare/FEATURES)
4. [规范总览](../spec/00-OVERVIEW)

## 延伸阅读

| 文档 | 内容 |
|------|------|
| [设计概览](./design-overview) | L/Invoke 模型 |
| [双运行时](./dual-runtime) | Mono / Il2Cpp 分工 |
| [术语表](./glossary) | Opaque / ByVal / stub 等 |
| [Il2Cpp 实现](../impl/IL2CPP) | Player 模块图 |
