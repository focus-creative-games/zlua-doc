---
sidebar_position: 3
title: "GC 差异"
---

# GC 差异 — 理论分析对比

> **性质：** 理论分析，非 benchmark。  
> **ZLua 细节：** 以 [spec/10-LIFETIME.md](../spec/10-LIFETIME)、[spec/marshal/](../spec/marshal/) 为准。

---

## 1. 分析轴

| 轴 | 问题 |
|----|------|
| 热路径分配 | 每次 Lua↔C# 是否必然 `object[]`、装箱、新 `string` |
| userdata 与托管对象 | 一对一？弱表？registry 槽？ |
| struct | 拷贝 / 池化 / Opaque 临时句柄 |
| 字符串 | Push/Pop 是否每次新托管 `string` |
| Delegate / 闭包 | 桥接对象生命周期与 ref |
| 峰值 vs 稳态 | 首次 Bind / 首次 delegate vs 热循环 |

---

## 2. 四方案热路径分配画像（典型）

### 2.1 xLua

| 路径 | 典型分配 |
|------|----------|
| Lua→C# 简单方法 | 生成 Wrap **通常无** `object[]`；参数为值类型时较干净 |
| Lua→C# 重载 / 反射兜底 | 可能 `object[]`、`params` 装箱 |
| C#→Lua | `LuaFunction.Call` 等可能分配；多次 LuaDLL |
| userdata ↔ object | **ObjectTranslator** 池 + 弱引用；Push 新对象可能分配 wrapper 信息 |
| string | Lua string ↔ UTF-16 **通常分配** 新 `string` |
| struct | 常 **装箱** 或 table 中转（视 Wrap） |
| Delegate | DelegateBridge + translator 条目；首次绑定分配 |

**「零 GC」：** 官方与社区均 **不** 承诺热路径零 GC；blittable 热循环可接近零分配，string/object 必分配。

### 2.2 toLua / tolua#

| 路径 | 典型分配 |
|------|----------|
| Wrap 调用 | 类似 xLua；早期版本热路径相对粗糙 |
| 出参 / ref | 常 table 或多返回值，可能临时 table |
| string / object | 与 xLua 同量级 |
| struct | 多依赖导出策略，装箱常见 |

**「零 GC」：** **不** 成立为通用承诺。

### 2.3 SLua

| 路径 | 典型分配 |
|------|----------|
| 自动绑定 | 与 toLua 类似 |
| 值类型优化 | 部分版本有 struct 优化，仍依赖导出 |
| Delegate | LuaFunction 转换常分配 |

**「零 GC」：** **不** 通用；需 per-API profiling。

### 2.4 ZLua（Il2Cpp Player 设计目标）

| 路径 | 典型分配 |
|------|----------|
| Lua→C# blittable 方法 | C++ 桥直接读栈 → `methodPointer`；**目标零 GC** |
| Lua→C# string / class | `string` 分配；class **ObjectRegistry** Push（槽位 + 弱缓存） |
| C#→Lua `[LuaInvoke]` blittable | C++ PushDefault*；**目标零 GC** |
| C#→Lua `ref`/`out` | **OpaqueValue**（lightuserdata，无托管 boxing） |
| struct ByVal | userdata 内 **payload 拷贝**；non-blittable 可能 boxed companion |
| Delegate | closed delegate + funcRef；首次绑定有分配，稳态 **待测** |
| Mono Editor Emit | 设计为 **无** 热路径 `object[]` + `Method.Invoke`；与 Player 语义一致 |

---

## 3. ZLua 核心机制

### 3.1 ObjectRegistry（ByObj）

管理 **class / string / array / delegate / boxed enum** 等 ByObj userdata：

```text
Push → 分配 slotIndex → _registeredObjects[] + GC root（Il2Cpp）
     → 弱值缓存 (obj, viewKlass) → 避免重复 Push
__gc → UnregisterObject → 解除 root
```

| 项 | GC 含义 |
|----|---------|
| slot + root | Lua 持有 userdata 期间，**阻止** Il2Cpp 回收该对象 |
| 弱缓存 | 命中时不新 Push；未命中一次 Push 成本 |
| Pop | 不分配；仅查 slot |

详见 [spec/10-LIFETIME.md](../spec/10-LIFETIME) §2。

### 3.2 ByVal struct

| 形态 | 分配 |
|------|------|
| ByVal userdata | payload 在 userdata 内 **拷贝**；`__gc` 释放 native 拷贝 |
| non-blittable ByVal | 可能 **boxed companion** + `NotBlittableStructRegistry` 扫描 |
| `zlua.box` → ByObj |  boxing 为 ByObj，走 ObjectRegistry |

**Lua→C# 传 struct：** 默认 ByVal 拷贝；**非** 每次装箱（除非 ByObj 路径）。

### 3.3 OpaqueValue（C#→Lua）

| 项 | 说明 |
|----|------|
| 形态 | lightuserdata handle，指向 C# 侧 ref 槽 |
| 生命周期 | **仅当次** C#→Lua 调用帧；跨 pcall 保存 → error |
| GC | handle 本身 **不** 增加托管对象计数；指向的 ref 槽在 invoke 内有效 |

用于 `[LuaInvoke]` / delegate bridge 的 `ref`/`out`/`in` 默认路径（见 [spec/marshal/04-OPAQUE.md](../spec/marshal/04-OPAQUE)）。

### 3.4 Indexer 与分配

| 模式 | 分配影响 |
|------|----------|
| Il2Cpp `Dispatch*` indexer | C++ 路径；**不** 因 indexer 额外分配 |
| Mono 三表 Lua indexer | 纯 Lua 表查找；miss 返回 nil，**无** 临时对象 |

---

## 4. 「零 GC」声称的边界条件

以下「零 GC」指 **稳态热循环、GC Alloc ≈ 0**（Unity Profiler / dotMemory 意义下），**非** 绝对无 native 侧 malloc。

### 4.1 可能接近零 GC 的 ZLua 路径（Il2Cpp Player）

| 条件 | 示例 |
|------|------|
| 签名全 blittable | `void Tick(float)`、`int Add(int,int)` |
| Lua→C# 无 new string / class | 仅 number + 已存在 userdata |
| C#→Lua 返回值 blittable | `int`、`float`、无 `string` |
| 已 Bind，无首次 EnsureBinding | 热循环内 |
| 无 ref/out 跨帧 Opaque | Opaque 仅在单次 invoke 内使用 |

### 4.2 必然或极可能有分配的路径

| 路径 | 四方案 |
|------|--------|
| **new `string`** 跨边界 | 均可能分配 UTF-16 `string` |
| **new class** 从 C# 返回 Lua | ZLua ObjectRegistry Push；xLua translator |
| **装箱** enum / struct（若走 ByObj） | 均可能 |
| **首次** 类型 Bind / delegate 绑定 | 均可能 |
| **Lua table** ↔ C# collection | 视 `[LuaMarshalAs]` / API，常分配 |
| **重载 dispatch** 失败重试 | 可能临时对象（**待测**） |

### 4.3 四方案「零 GC」对照（诚实）

| 声称 | 成立范围 |
|------|----------|
| xLua 热路径可优化 | 需 Generate + 避免反射；**非** 全局零 GC |
| toLua / SLua | **一般不** 宣传零 GC |
| ZLua Il2Cpp | **仅** blittable 热路径 **目标** 零托管 GC；string/object/delegate 首次绑定 **否** |

---

## 5. 峰值 vs 稳态

| 阶段 | xLua | toLua / SLua | ZLua |
|------|------|--------------|------|
| 首次访问类型 | Generate 已做则 Wrap 就绪 | 导出已生成 | **EnsureBinding** + stub 注册（Il2Cpp） |
| 首次 Push 某 object | translator 登记 | 池登记 | ObjectRegistry slot + 缓存 |
| 热循环 100 万次 P1 | 分配应 ≈0（Wrap 良好时） | 类似 | **目标** ≈0 |
| 每帧 1000 次 string API | 分配与 GC 压力主导 | 同左 | 同左 |

---

## 6. Delegate 与 Lua ref 生命周期

| 方案 | 模型 |
|------|------|
| xLua | DelegateBridge 持有 ref；需在适当时机 Dispose / GC |
| toLua / SLua | LuaFunction 生命周期手动管理 |
| ZLua | funcRef + closed delegate；`ProcessPendingRefReleases` 帧泵延迟释放（[spec/10-LIFETIME.md](../spec/10-LIFETIME)） |

**迁移注意：** 不要以为「C# delegate 已不被引用」Lua 侧 function 会立刻释放；须理解 ZLua ref 释放语义。

---

## 7. Il2Cpp GC 集成（ZLua 特有）

| 机制 | 目的 |
|------|------|
| ObjectRegistry 槽位 **GC root** | Lua userdata 存活 → 托管对象不被 Il2Cpp 单独回收 |
| non-blittable struct **push_other_roots** | 扫描 struct 内存内引用字段 |
| userdata `__gc` | 与 Lua GC 同步 Unregister |

xLua / toLua / SLua **一般不改** Boehm/Il2Cpp GC root 策略；ZLua 为正确性 **刻意** 集成。

---

## 8. 分析建议（工程实践）

1. **先定场景：** P1 式热循环 vs P6 式 string 密集。
2. **Profiler 看 Alloc：** 若每 call 有 `System.String` / `Box` / `object[]`，互调优化收益有限。
3. **双端跑：** Mono 与 Player GC 行为可能不同；**以 Player 为准**。
4. **读 spec：** struct/ref 路径见 [spec/marshal/03-BYREF.md](../spec/marshal/03-BYREF)、[05-STRUCT.md](../spec/marshal/05-STRUCT)。

---

## 相关文档

| 文档 | 内容 |
|------|------|
| [PERFORMANCE.md](./PERFORMANCE) | 性能场景 P1–P6 |
| [impl/marshal/REGISTRIES.md](../impl/marshal/REGISTRIES) | Registry 实现 |
| [FEATURES.md](./FEATURES) | 值类型用法差异 |

---

*理论分析稿；四方案同场景 GC Alloc 对比 **待测**。*
