---
sidebar_position: 4
title: "性能对比"
---

# Lua ↔ C# 交互性能对比

正式结论仅引用 **Il2Cpp Player**（Mono Editor 不代表发布性能）。

**基准工程：** [focus-creative-games/zlua-benchmark](https://github.com/focus-creative-games/zlua-benchmark)（ZLua / xLua / toLua / SLua 四方对齐）。  
**最新报告：** [comparison_20260728_121554.md](https://github.com/focus-creative-games/zlua-benchmark/blob/main/reports/comparison_20260728_121554.md)

| 项 | 值 |
|----|-----|
| Unity | **2022.3.62f3** · Il2Cpp · C++ Release · Win64 |
| 统计 | 预热后 5 轮 **mid ns/op**；**ratio = 其他 / ZLua**（>1 表示比 ZLua 慢） |
| 范围 | cs2lua 54 + lua2cs 231；未含 Delegate 稳态；未测 GC Alloc（见 [GC](/docs/compare/GC/)） |

复现：仓库 README 中 `run_benchmark.ps1`（或 `-CompareOnly`）。

---

## 实测摘要

相对 ZLua 的平均 ratio：

| 方向 | cases | xLua | toLua | SLua |
|------|------:|-----:|------:|-----:|
| **Lua→C#** | 231 | **2.57×** | **3.52×** | **7.68×** |
| **C#→Lua** | 54 | **1.59×** | **3.27×** | **14.9×** |

相对 xLua：约 **98.6%** 用例领先（281/285）。逐 case 见完整报告。

### 代表 case（ns/call mid）

| 场景 | case_id | ZLua | xLua | ratio |
|------|---------|-----:|-----:|------:|
| 无参方法 | `lua2cs.instance.method.0arg.void` | 21.57 | 58.64 | **2.72** |
| prop get int | `lua2cs.instance.prop.get.int` | 21.67 | 79.03 | **3.65** |
| field get int | `lua2cs.instance.field.get.int` | 21.32 | 75.23 | **3.53** |
| field set Vector3 | `lua2cs.instance.field.set.Vector3` | 22.80 | 90.90 | **3.99** |
| C#→Lua class | `cs2lua.class.3arg.ret` | 94.00 | 461.00 | **4.90** |
| C#→Lua int[] | `cs2lua.int[].3arg.ret` | 92.00 | 601.00 | **6.53** |

toLua / SLua 同 case 数值见报告。

**读数注意：** 互调即使快数倍，若边界只占帧时间一小部分，整帧收益有限——先 profiling。`string` / 重对象场景 marshal 占主导时，方案差距会缩小。

---

## 为什么更快

xLua / toLua / SLua 的典型热路径要经过 **C# Wrap + 多次 Lua 绑定 / P/Invoke（如 LuaDLL）** 再进目标方法；栈读写每次数次跨界。

ZLua Player 在 **与 lua 同链接域的 C++** 里一次完成：读栈 → marshal → `methodPointer`（或字段 offset）→ 写栈，**没有** per-type C# Wrap，也没有反复 native↔managed 折返。

| 根因 | 效果 |
|------|------|
| 无 libxlua / 多层 P/Invoke 往返 | 栈操作不再每次跨界 |
| 无生成 C# Wrap（Lua→C#） | C++ 直桥 + `methodPointer` |
| C#→Lua 经缓存 Delegate 一次桥接 | 非 C# 循环调 LuaDLL |
| 字段 / 无参属性快路径 | Il2Cpp offset 直读 |

因此轻量 `int` / 字段场景领先更明显；marshal 很重时差距收敛——与实测一致。桥体积与 stub 复用见 [BRIDGE](/docs/compare/BRIDGE/)。

---

## 相关文档

| 文档 | 内容 |
|------|------|
| [zlua-benchmark](https://github.com/focus-creative-games/zlua-benchmark) | 可复现基准与最新报告 |
| [GC.md](/docs/compare/GC/) | 分配与「零 GC」边界 |
| [BRIDGE.md](/docs/compare/BRIDGE/) | stub 体积与间接层 |
| [FEATURES.md](/docs/compare/FEATURES/) | 功能差异 |
