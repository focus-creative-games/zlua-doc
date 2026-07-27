---
sidebar_position: 5
title: "与 xLua / toLua / SLua 对比"
---

# 与 xLua / toLua / SLua 对比

> **性质：** 选型与分析材料，**不是** ZLua 行为规范。  
> **覆盖：** xLua、toLua/tolua#、SLua 与 ZLua 四方对比。

## 本目录

| 文件 | 内容 |
|------|------|
| [FEATURES.md](/docs/compare/FEATURES/) | 特性与用法差异：类型访问、调用、C#→Lua、值类型、热更/生成、Editor/Player、侵入性、白名单 |
| [PERFORMANCE.md](/docs/compare/PERFORMANCE/) | Lua↔C# 性能：调用路径、理论开销、**Il2Cpp 实测（ZLua vs xLua）** |
| [GC.md](/docs/compare/GC/) | GC 理论分析：热路径分配、ObjectRegistry/ByVal/Opaque、「零 GC」边界 |
| [BRIDGE.md](/docs/compare/BRIDGE/) | 桥接函数性能与二进制体积：生成粒度、stub 复用、四方案对照 |

## 对比对象

| 方案 | 典型定位 | 成熟度 | 与 ZLua 关系 |
|------|----------|--------|--------------|
| **xLua** | 热更友好、生成 Wrap + 反射兜底、生态成熟 | 生产级 | 同属「高性能原生绑定」路线；ZLua 目标减少 libxlua / C# Wrap 折返 |
| **toLua / tolua#** | 导出包装类、传统 Lua 框架风格 | 历史方案，维护较少 | 均需从「预生成 Wrap」迁到 ZLua 懒绑定 |
| **SLua** | 导出 + 自动绑定 | 历史方案 | 与 toLua 类似，配置驱动导出 |
| **ZLua** | Editor Mono / Player Il2Cpp 双后端；Il2Cpp 内嵌、签名 stub 复用、语义贴近 C# | **Mono 与 Il2Cpp 均已完成**（见 [impl/MONO.md](/docs/impl/MONO/)、[impl/IL2CPP.md](/docs/impl/IL2CPP/)） | 本文档树的「被评估方」 |

## ZLua 当前状态（诚实说明）

| 后端 | 状态 | 说明 |
|------|------|------|
| **Il2Cpp（Player）** | 已完成 | 规范与实现以 `build-win64/.../libil2cpp/zlua` 为准；性能对比应以 Player 为准 |
| **Mono（Editor）** | 已完成 | 与 Il2Cpp Lua 可见语义一致；实现为 Expression Emit |
| **文档 / 生态** | 建设中 | 无 xLua 级社区与热更配套；迁移需自建测试矩阵 |

**性能/GC 文档中的 ZLua 理论值**指 Il2Cpp Player **设计目标**；Mono Editor 在 Phase 4–5 完成前不代表 Player 性能。

## 阅读顺序

1. 选型或迁移前：先读 [FEATURES.md](/docs/compare/FEATURES/) 确认语义与工程差异。
2. 性能是瓶颈：读 [PERFORMANCE.md](/docs/compare/PERFORMANCE/) + [GC.md](/docs/compare/GC/)，再决定是否 profiling。
3. 包体 / 生成量：读 [BRIDGE.md](/docs/compare/BRIDGE/)。
4. 实际迁移：见 [guides/migration/](/docs/guides/migration/)。

## 写作原则

1. **特性/用法**：对照表 + 迁移影响（链 [guides/migration/](/docs/guides/migration/)）。
2. **性能 / GC / 桥体积**：先给**理论模型与假设**，再给**可复现基准**；未测项标 **待测**。
3. 不贬低其它方案的适用场景；写清 ZLua 的取舍（侵入 libil2cpp、Unity 版本 merge、Lua 版本锁定等）。
4. 倍数、纳秒区间：§2–§7 为路径推演；**§8 已填 ZLua vs xLua Il2Cpp 实测**；toLua / SLua 仍待测。

## 相关文档

| 文档 | 内容 |
|------|------|
| [spec/00-OVERVIEW.md](/docs/spec/00-OVERVIEW/) | ZLua 产品目标与双运行时 |
| [guides/migration/README.md](/docs/guides/migration/) | 迁移指南索引 |
| [guides/TESTING.md](/docs/community/testing/) | 双端回归测试 |

---

*对比文档随 ZLua 实现演进更新；冲突时 ZLua 行为以 `spec/**` 为准。*
