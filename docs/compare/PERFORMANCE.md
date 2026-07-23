---
sidebar_position: 4
title: "性能对比"
---

# Lua ↔ C# 交互性能对比

> **原则：** 路径理论 + **可复现 Il2Cpp Player 基准**；未覆盖项标「待测」。  
> **环境：** 正式结论 **仅引用 Il2Cpp Player**；Mono Editor 不代表 Player 性能。  
> **实测：** ZLua vs xLua 已有同机基准（§8）；toLua / SLua **待测**。

---

## 1. 说明与假设

| 项 | 约定 |
|----|------|
| 数据性质 | §2–§7 为路径推演；**§8 为实测**（`benchmark/` 仓库对比报告） |
| ZLua 对比对象 | **Il2Cpp Win64 Player / Release**（实现已完成） |
| 实测环境 | Unity **2022.3.62f3**、Il2Cpp、Release、x64；mid = 5 轮中位数 |
| 单位 | **ns/call**（中位数）；ratio = xLua_mid / ZLua_mid（**>1 表示 ZLua 更快**） |
| 待测 | toLua / SLua 同机同脚本；Delegate 稳态（P5）；移动端 ARM64 |

**必须打折的因素：**

- 互调即使快 5 倍，若脚本边界只占帧时间 2%，整帧仅省 ~1.6%。**先 profiling** 确认热点。
- `string`、复杂 object、`List` 等 **marshal 占主导** 时，方案差距缩小。
- 首次 `EnsureBinding`、重载 dispatch、泛型 inflation 为 **稳态外** 成本。
- 本基准 **暂未测 GC Alloc**（Il2Cpp Player 无可靠 `GetAllocatedBytesForCurrentThread`）；GC 见 [GC.md](./GC)。

---

## 2. 调用路径简图

### 2.1 Lua → C#（例：`Demo.Add(3, 5)` / `obj:GetX()`）

**xLua**

```text
lua_pcall
  → [MonoPInvokeCallback] 生成的 C# Wrap（Il2Cpp AOT）
      → LuaDLL.lua_tointeger / lua_push*（P/Invoke → libxlua）
      → 目标 C# 方法（Il2Cpp 生成体）
      → 再经 LuaDLL 写回栈
  → ObjectTranslator：userdata → pool index → object
```

**toLua / SLua（典型）**

```text
lua_pcall
  → 生成的 C# Wrap（结构类似 xLua，具体随版本）
      → lua API（内嵌或经 tolua 绑定层）
      → 目标方法
  → 对象池 / translator 查表
```

**ZLua（Il2Cpp Player）**

```text
lua_pcall
  → C++ MethodBridge（与 lua 同链接域）
      → lua_tointeger / lua_push*（直接 lua API，无 P/Invoke）
      → method->methodPointer(...)（Il2Cpp 生成体同级）
  → ObjectRegistry：userdata → slot（弱表缓存）
```

**差异要点：** xLua / toLua / SLua 的 Lua 栈操作常经 **额外 C# / P/Invoke 边界**；ZLua Player 在 **C++ 一次完成** marshal + `methodPointer`。

### 2.2 C# → Lua（例：`[LuaInvoke]` / 脚本回调）

**xLua**

```text
C# 业务
  → LuaEnv / DelegateBridge
  → 多次 LuaDLL（getglobal、push、pcall、pop…）
  → libxlua → lua VM
```

单次调用常见 **5–15 次** LuaDLL 跨界。

**toLua / SLua**

```text
C# → LuaState / LuaFunction
  → 多次 native 绑定调用（次数随 API 封装而异，通常 ≥ xLua 同量级）
  → lua VM
```

**ZLua**

```text
C# [LuaInvoke] → InternalCall（一次进 native）
  → LuaInvokeRuntime::Call（C++ 模板）
      → lua_rawgeti(funcRef) + Push* + lua_pcall + Pop
```

构建期解析 `moduleRef` / `funcRef`；运行时 **无按名 getglobal**。

### 2.3 Lua function → C# Delegate（已绑定后）

| | xLua | toLua / SLua | ZLua |
|---|------|--------------|------|
| 机制 | C# delegate bridge + translator + LuaDLL | LuaFunction → delegate | `LuaMethod` + funcRef + closed delegate + C++ DelegateBridge |
| 稳态 | C# invoke → Lua pcall | 同左 | 同左，少 Wrap / LuaDLL 层 |

绑定完成后，三者都须「C# → Lua pcall」；ZLua 少中间层，但 **string / 重对象** 仍占主导。

---

## 3. 理论常数项拆解

| 成本项 | xLua (Il2Cpp) | toLua / SLua | ZLua (Il2Cpp 目标) | 备注 |
|--------|----------------|--------------|---------------------|------|
| Lua 进入 C 回调 | ~5–15 ns | ~5–15 ns | ~5–15 ns | 同在 VM 内 |
| **栈读写单次** | ~30–150（经 LuaDLL） | ~20–100（视绑定层） | ~3–15（内联 lua API） | **主要差距来源** |
| C#↔native 边界 | ~20–80 / 次 | ~15–60 / 次 | 0 或 IC 1 次 | xLua 栈操作多次跨界 |
| userdata → 对象 | ~20–80 | ~20–80 | ~10–40 | 均为池 + 缓存 |
| 方法分派 | ~0–30 | ~0–40 | ~0–50（map / dispatch） | 重载两边都可能贵 |
| 调用 Il2Cpp 方法体 | ~1–5 | ~1–5 | ~1–5 | 同为生成代码 |
| 读 `int` 实例字段 | 常经 Wrap ~150–500+ | 经 Wrap ~100–400 | offset 直读 ~15–50 | **字段差距最大** |
| `string` 往返 | ~200–2000+ | 类似 | 类似 | UTF + GC，瓶颈一致 |

---

## 4. 统一基准场景 P1–P6

编号统一为 **P1–P6**，便于四方案对照。

| ID | 场景 | 脚本 / C# 探针 | 关注点 |
|----|------|----------------|--------|
| **P1** | 静态 `int Add(int,int)` 热循环 | `for i=1,N do Demo.Add(1,2) end` | 调用开销下限 |
| **P2** | 实例无参 `GetX()` | `for i=1,N do o:GetX() end` | 实例 + userdata 解引用 |
| **P2b** | 实例字段 `obj.x`（`int`） | `for i=1,N do local _=o.x end` | `__index` + 字段快路径 |
| **P3** | 实例有参 + 简单重载 | 两 overload 交替调用 | dispatch 成本 |
| **P4** | C#→Lua 少参 | `[LuaInvoke]` 空函数 / `int` 返回循环 | 反向跨界次数 |
| **P5** | Delegate 已绑定后回调 | C# `Action` 循环调 Lua function | 稳态回调 |
| **P6** | `string` / 复杂 object | 传 `string`、`List<int>` 等 | marshal 主导 |

**建议：** N = 1_000_000；记录 **ns/call**、**GC Alloc/帧**；设备、Unity 版本、Lua 版本一并记录。

---

## 5. 分场景理论估计（ZLua vs xLua）

> toLua / SLua 与 xLua **同量级**（均经 C# Wrap + 多层绑定）；相对 ZLua 的倍数 **待测**，趋势应接近 xLua 列。

**符号：**

- **总耗时倍数** = T_其它 / T_ZLua（越大 ZLua 越快）
- **互调开销削减** ≈ (T_其它 − T_native) / (T_其它 − T_函数体)

### P1：静态 `Add(int,int)`

| 指标 | xLua 粗算 | ZLua 粗算 | 总耗时倍数 | 互调开销削减 |
|------|-----------|-----------|------------|--------------|
| 单次 | ~150–600 ns | ~30–100 ns | **2–5×**（常见 ~3×） | **70%–90%** |

### P2：实例 `GetX()`

| 指标 | 估计 |
|------|------|
| 总耗时倍数 | **3–6×** |
| 互调开销削减 | **75%–90%** |

### P2b：字段 `obj.x`

| 对比 | xLua | ZLua |
|------|------|------|
| 路径 | `__index` → Wrap → getter | `__index` → C++ offset getter |
| 总耗时倍数 | **5–15×** | — |
| 互调开销削减 | **85%–95%** | — |

### P3：简单重载

| 指标 | 估计 |
|------|------|
| 总耗时倍数 | **2–4×**（视 dispatch 实现） |
| 备注 | 四方案均可能在此场景拉开差距；**待测** |

### P4：C#→Lua

| 指标 | 估计 |
|------|------|
| 总耗时倍数 | **2–4×** |
| 互调开销削减 | **60%–85%** |

参数越多，xLua「每次 push 都跨界」放大越明显。

### P5：Delegate 回调（已绑定）

| 指标 | 估计 |
|------|------|
| 总耗时倍数 | **2–3×** |
| 互调开销削减 | **50%–75%** |

首次绑定、泛型约束、未 codegen 签名时两边都贵。

### P6：`string` / 复杂 object

| 指标 | 估计 |
|------|------|
| 总耗时倍数 | **1.1–1.8×** |
| 互调开销削减 | **20%–50%** |

### 汇总表（Player / 轻量签名，ZLua vs xLua）

| 场景 | 理论倍数 | 实测代表（ratio） |
|------|----------|-------------------|
| P1 Lua→C# `int` 方法 | **2–5×** | ~1.8–2.6×（见 §8） |
| P2 实例 getter / 无参 | **3–6×** | ~2.6×（0arg ret） |
| P2b 读 `int` 字段 | **5–15×** | **~3.6×**（field.get.int） |
| P4 C#→Lua 少参 | **2–4×** | ~1.1–1.2×（int arity2–3）；数组/class 可达 **5–6×** |
| P5 Delegate 回调 | **2–3×** | **待测**（基准未含） |
| P6 重 string / 对象 | **1.1–1.8×** | string ~2.1×；int[] 可达 **~5×** |

**实测结论（Il2Cpp Win64 Release，285 对齐 case）：** Lua→C# 全面领先（avg **~2.6×**）；C#→Lua 多数领先（avg **~1.7×**），极简无参/arity0 有少数 xLua 更快。详见 §8。

---

## 6. Editor vs Player

| 后端 | xLua / toLua / SLua | ZLua |
|------|---------------------|------|
| Editor | lib + Wrap，接近 Player | **Mono Emit**（已完成）；性能结论仍以 **Il2Cpp Player** 为准 |
| Player | Il2Cpp + Wrap | **Il2Cpp native 桥**，设计目标性能在此体现 |

**规则：** 性能结论 **仅引用 Il2Cpp Player**；Editor 只用于功能开发。

---

## 7. 为何 ZLua Player 能更快（根因）

| 根因 | 说明 |
|------|------|
| 消灭 libxlua / 多层 P/Invoke 往返 | 栈操作不再每次跨界 |
| 消灭生成 C# Wrap 层（Lua→C#） | C++ 一次 marshal + `methodPointer` |
| C#→Lua 单次 InternalCall | 非 C# 循环调 LuaDLL |
| 字段 / 无参属性快路径 | Il2Cpp offset + `methodPointer` 同级 |
| 签名复用 stub | 控制体积同时避免 per-member C# 委托链（见 [BRIDGE.md](./BRIDGE)） |

**不是**单一黑科技 10 倍，而是 **减少重复的 native↔managed↔native 折返**。

---

## 8. 实测（ZLua vs xLua，Il2Cpp Player）

### 8.1 数据来源

| 项 | 值 |
|----|-----|
| 报告 | `benchmark/reports/comparison_20260722_201933.md` |
| ZLua CSV | `benchmark/results/zlua_20260722_201933.csv` |
| xLua CSV | `benchmark/results/xlua_20260716_121413.csv` |
| Unity / 后端 | **2022.3.62f3** / **Il2Cpp** / **Release** / Win64 |
| 统计 | 每 case 预热后 5 轮，取 **mid ns/op**；ratio = xLua / ZLua |
| 范围 | 对齐 case：**cs2lua 54** + **lua2cs 231**；未含 Delegate（P5）、toLua、SLua |

### 8.2 方向汇总

| direction | cases | ZLua 更快 | xLua 更快 | avg ratio (xLua/ZLua) |
|-----------|------:|----------:|----------:|----------------------:|
| **lua2cs**（Lua→C#） | 231 | **231** | 0 | **2.622** |
| **cs2lua**（C#→Lua） | 54 | 48 | 5 | **1.660** |
| **合计** | 285 | **279** | 5 | — |

> ratio > 1 → ZLua 更快；ratio < 1 → xLua 更快。

### 8.3 与 P1–P6 对齐的代表 case

单位：ns/call（mid）。toLua / SLua 列仍 **待测**。

| 场景 | 代表 case_id | ZLua | xLua | ratio | 备注 |
|------|--------------|-----:|-----:|------:|------|
| **P1** Lua→C# int 方法 | `lua2cs.instance.method.int.3arg.ret` | 41.69 | 73.22 | **1.76** | 三参 + 返回 |
| **P1** 无参方法 | `lua2cs.instance.method.0arg.ret` | 22.56 | 58.82 | **2.61** | 调用下限附近 |
| **P2** 实例 prop get int | `lua2cs.instance.prop.get.int` | 22.04 | 78.76 | **3.57** | getter |
| **P2b** 实例 field get int | `lua2cs.instance.field.get.int` | 21.79 | 78.35 | **3.60** | 字段快路径 |
| **P2b** field set Vector3 | `lua2cs.instance.field.set.Vector3` | 21.10 | 89.00 | **4.22** | 值类型写 |
| **P4** C#→Lua int 少参 | `cs2lua.int.arity2.ret` | 35.10 | 39.10 | **1.11** | 差距较小 |
| **P4** C#→Lua int 三参 | `cs2lua.int.arity3.ret` | 34.90 | 40.10 | **1.15** | |
| **P4** C#→Lua class | `cs2lua.class.3arg.ret` | 93.00 | 484.00 | **5.20** | 引用类型放大 |
| **P4** C#→Lua int[] | `cs2lua.int[].3arg.ret` | 90.00 | 602.00 | **6.69** | 本轮最大领先之一 |
| **P5** Delegate | — | — | — | **待测** | 基准未覆盖 |
| **P6** string Lua→C# | `lua2cs.instance.method.string.3arg.ret` | 88.80 | 189.40 | **2.13** | marshal 仍占主导但 ZLua 领先 |
| **P6** int[] Lua→C# | `lua2cs.instance.method.int[].3arg.void` | 49.20 | 263.80 | **5.36** | |

### 8.4 xLua 更快的 case（仅 5 个，均 cs2lua 极简）

| case_id | ZLua | xLua | ratio |
|---------|-----:|-----:|------:|
| `cs2lua.int.arity0.void` | 36.80 | 28.40 | 0.772 |
| `cs2lua.int.arity0.ret` | 43.30 | 33.80 | 0.781 |
| `cs2lua.int.arity1.ret` | 37.00 | 32.50 | 0.878 |
| `cs2lua.int.arity1.void` | 30.80 | 28.50 | 0.925 |
| `cs2lua.ulong.3arg.ret` | 40.10 | 39.40 | 0.983 |

解释：无参 / 单参 C#→Lua 路径上，xLua 预缓存 Delegate + 较少栈操作时，固定开销可略低；**参数变多或引用类型** 后 ZLua 重新领先并拉开。

### 8.5 解读

1. **Lua→C#（日常脚本调 C#）是 ZLua 主战场**：231/231 领先，平均约 **2.6×**；字段/属性读常见 **~3.5–4×**。
2. **C#→Lua**：平均约 **1.7×**；`int[]` / `class` 等可达 **5–6×**；极简 arity0–1 有少量回落。
3. 与 §5 理论同向：字段与多层 marshal 场景差距最大；极简 C#→Lua 理论「2–4×」偏乐观，实测更接近 **1.1–1.7×**（轻量）到 **5×+**（重类型）。
4. **toLua / SLua、移动端、Delegate（P5）、GC Alloc** 仍待补测。

### 8.6 复现

见 `benchmark/dev.md`：同机构建两个 Il2Cpp Win64 Release Player，跑全量 case 导出 CSV，再生成对比报告。

---

## 9. 理论下限参考

同进程嵌入 Lua 调同签名 native 函数的下限约：

```text
lua 回调 + 2×读栈 + 1×写栈 + methodPointer ≈ 20–60 ns
```

ZLua 热路径 **接近** 该下限；xLua 因多次 LuaDLL，通常 **高一个数量级**（P1 量级）。

---

## 10. 选型建议（性能视角）

| 选 xLua / toLua / SLua | 选 ZLua（Player） |
|------------------------|-------------------|
| 互调不是 profiling 热点 | 战斗公式、UI 每帧上千次小调用等 **边界热点** |
| 不愿维护 libil2cpp fork | 可投入双端测试 + Unity merge |
| 需要成熟工具链 | 接受文档与热更自建 |

---

## 相关文档

| 文档 | 内容 |
|------|------|
| [GC.md](./GC) | 分配与「零 GC」边界 |
| [BRIDGE.md](./BRIDGE) | stub 体积与间接层 |
| [FEATURES.md](./FEATURES) | 功能差异 |

---

*§2–§7 为路径分析；§8 为 2026-07-22 Il2Cpp Win64 实测（ZLua vs xLua）。toLua / SLua / P5 待补。*
