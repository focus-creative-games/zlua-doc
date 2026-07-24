---
sidebar_position: 1
title: "桥接与体积"
---

# 桥接函数 — 性能与代码体积

> **性质：** 架构与体积模型分析；实测 **待测**。  
> **核心问题：** 桥接代码是 **每成员一条** 还是 **按签名复用 stub**？间接层对 ns/call 与 `.so`/`.dll` 体积的影响。

---

## 1. 分析轴

| 轴 | 问题 |
|----|------|
| **生成粒度** | 每个 method/field 独立桥 vs ReducedType / 签名哈希复用 |
| **调用成本** | 间接跳转、dispatch 表、marshal writer 共享与否 |
| **二进制体积** | 生成文件总大小、符号数、与成员数线性还是与签名数亚线性 |
| **Editor** | Mono Emit 数量 vs Il2Cpp 共享 stub |
| **裁剪** | 未引用类型 / 签名是否进 Player 包 |

---

## 2. 四方案「桥如何生成」

### 2.1 xLua

| 项 | 说明 |
|----|------|
| 粒度 | **每类型一套 C# Wrap**；成员级 C# 静态函数（`MonoPInvokeCallback`） |
| Lua→C# | Wrap 内联或调用 `LuaDLL`；**每个导出成员至少一个 C# 入口** |
| C#→Lua | `DelegateBridge` 等；按签名有模板但仍偏 C# 侧 |
| 体积 | 与 **导出成员数** 近似线性；Generate 白名单可控 |
| Player | Wrap 编译进 Il2Cpp；**无** C++ stub 复用 |

```text
类型 T 有 M 个成员 → O(M) 个 Wrap 函数（C#）
```

### 2.2 toLua / tolua#

| 项 | 说明 |
|----|------|
| 粒度 | **每导出类型** `*Wrap.cs`；成员级 tolua 绑定函数 |
| 模型 | 与 xLua 类似：**成员 × wrapper** |
| 体积 | 导出列表越大，Wrap 越多 |
| 性能 | 经 C# Wrap + lua 绑定层；间接层与 xLua 同量级 |

### 2.3 SLua

| 项 | 说明 |
|----|------|
| 粒度 | 自动绑定生成；**成员级** wrapper 为主 |
| 体积 / 性能 | 与 toLua 类似，取决于导出配置 |

### 2.4 ZLua

| 后端 | 粒度 | 说明 |
|------|------|------|
| **Il2Cpp Player** | **签名 stub 复用** | Codegen 按 **ReducedType**（参数+返回值 marshal 形状）生成 C++ `MethodBridge` / `PropertyBridge` / `DelegateBridge`；**多成员共享同一 stub** |
| **Mono Editor** | **每成员 Emit 一条** | Expression.Compile → `lua_pushcfunction` 写入三表；**不进 Player 包** |

```text
Il2Cpp：类型 T 有 M 个成员、S 种 distinct ReducedType → O(S) stub，S ≤ M
Mono：  M 个成员 → M 条 Emit 桥（开发期特化，调用更直）
```

详见 [impl/codegen/](../impl/codegen/)、[impl/MONO.md](../impl/MONO) D6。

---

## 3. ReducedType 与 stub 复用（ZLua Il2Cpp）

**ReducedType** 抽象：忽略成员名，只保留 **marshal 形状**（如 `int,int→int`、`userdata→void`）。

| 成员示例 | 可能共享 |
|----------|----------|
| `Add(int,int):int` | stub A |
| `Sub(int,int):int` | stub A（同形状） |
| `GetX():int` | stub B |
| `set_x(int):void` | stub C |

**好处：**

- Player 二进制：**体积 ~ O(签名种类)** 而非 O(成员数)。
- icache：热路径 stub 体小、可内联 lua API + `methodPointer`。

**代价：**

- stub 入口需 **methodId / dispatch 元数据**（一次表查，~0–50 ns 量级，见 [PERFORMANCE.md](./PERFORMANCE)）。
- Codegen + 元数据表维护复杂度高于 xLua Generate。

---

## 4. 体积模型（估算）

设：

- `W_wrap` = xLua/toLua 单成员 Wrap 平均大小（含 P/Invoke 属性等）
- `W_stub` = ZLua 单 ReducedType stub 大小
- `M` = 类型成员数
- `S` = distinct ReducedType 数（通常 `S << M` 于大型 API）

| 方案 | 桥接代码量（量级） |
|------|-------------------|
| xLua / toLua / SLua | **≈ M × W_wrap**（按导出成员） |
| ZLua Il2Cpp | **≈ S × W_stub** + 元数据表 + `generated/` 注册 |
| ZLua Mono（Editor only） | M × Emit 动态方法（**不计入 Player**） |

**示例（纯估算）：** 某类 200 方法，80 种签名形状：

- xLua：200 个 Wrap 函数
- ZLua Player：~80 个 C++ stub + dispatch 表

**待测：** 对同一程序集统计 Generate 后 `.cs` 行数 vs ZLua `generated/*.cpp` 符号数。

---

## 5. 性能：stub 间接层 vs 特化直调

| 模型 | 调用路径 | 体积 | 单次 call |
|------|----------|------|-----------|
| xLua 每成员 Wrap | C# 特化 + LuaDLL × N | 大 | 中–高（LuaDLL） |
| ZLua 共享 stub | C++ stub + methodId dispatch | 小 | 低–中（少跨界） |
| ZLua Mono 每成员 Emit | 特化 C# → 直接调用 | Editor 大 | **最低**（开发期） |

**结论（理论）：**

- Il2Cpp：**stub 间接一层** 通常远小于 xLua **多次 LuaDLL** 的开销（见 P1 [PERFORMANCE.md](./PERFORMANCE)）。
- Mono Emit：**Per-member 直调** 利于 Editor profiling；与 Player stub 语义一致但 **实现不同**。

---

## 6. 字段 / 属性桥

| 方案 | 读 `int` 字段 |
|------|---------------|
| xLua | Wrap → getter 或 property |
| ZLua Il2Cpp | **PropertyBridge / offset getter**；可共享「读 int 字段」stub |
| ZLua Mono | 每字段 Emit getter/setter |

字段快路径是 ZLua **体积与性能** 双赢点之一（少 Wrap、直内存读）。

---

## 7. C#→Lua：Delegate 桥

| 方案 | 模型 |
|------|------|
| xLua | C# DelegateBridge + 多次 LuaDLL |
| ZLua | **`GetFunction<T>`** 运行时绑定 function → closed delegate；`Invoke` 经 **Delegate 桥**（Mono / Il2Cpp 实现路径不同，语义一致） |

详见 [spec/01-HOST-API.md](../spec/01-HOST-API) 与 [guides/csharp-to-lua.md](../guides/csharp-to-lua)。

---

## 8. 裁剪与链接

| 方案 | 未使用 API |
|------|------------|
| xLua | 未 Generate 的类型 **不在包内** |
| toLua / SLua | 未导出 **不在包内** |
| ZLua | **懒 Bind**；未访问类型可能 **不** 注册 stub，但 Il2Cpp **仍链接** 程序集元数据；stub 表由 Codegen 预生成范围决定 |

**迁移：** 从 xLua 白名单迁到 ZLua 时，不能假设「未调用的类型不占成本」——需理解 Codegen 输入范围（通常测试程序集 + 游戏程序集 public API）。

---

## 9. 与 HybridCLR / 其它方案对比思路

| 路线 | 桥接形态 |
|------|----------|
| HybridCLR 等 | 改造执行模型；桥接思路可参考 **签名复用** |
| xLua | 成员级 C# Wrap，成熟可控 |
| ZLua | **Il2Cpp 内嵌 + ReducedType**，偏 Player 极致 |

ZLua **不是** HybridCLR 替代品；桥接层设计可类比「native stub 表 + methodPointer」。

---

## 10. 可复现体积统计方法（建议）

1. **xLua：** Generate 后统计 `Wrap/` 下 `.cs` 行数与 IL 大小（dotnet ilspy / `ildasm`）。
2. **ZLua：** 统计 `libil2cpp/zlua/generated/` 下 `.cpp/.h` 与 `MarshalBindings` 表项数。
3. **Player：** 对比链接前后 `libil2cpp.so` / `GameAssembly.dll` 大小（控制变量：仅桥接差异）。

结果填入下表（**待测**）：

| 指标 | xLua | toLua | SLua | ZLua Il2Cpp |
|------|------|-------|------|-------------|
| 桥接源文件总 KB | 待测 | 待测 | 待测 | 待测 |
| distinct stub 数 | N/A | N/A | N/A | 待测 |
| Player so 增量 | 待测 | 待测 | 待测 | 待测 |

---

## 相关文档

| 文档 | 内容 |
|------|------|
| [PERFORMANCE.md](./PERFORMANCE) | ns/call 与间接层 |
| [impl/codegen/STUBS-IL2CPP.md](../impl/codegen/STUBS-IL2CPP) | stub 类型清单 |
| [impl/codegen/EMIT-MONO.md](../impl/codegen/EMIT-MONO) | Mono Emit |
| [FEATURES.md](./FEATURES) | 生成与白名单差异 |

---

*体积与 stub 计数待实测补充。*
