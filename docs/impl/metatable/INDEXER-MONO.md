---
sidebar_position: 11
title: "Mono 三表 Indexer 实现"
---

# Mono 三表 Indexer 实现

> **源码：** `Runtime/Mono/Mt/TypeMemberLuaIndexer.cs`  
> **语义权威：** [../../spec/metatable/02-INDEX.md](../../spec/metatable/02-INDEX)  
> **重写约束：** [../MONO.md](../MONO) D2、D5、D7

---

## 1. 设计定位

Mono Editor **不**实现 Il2Cpp 的 `DispatchInstanceIndex`。成员分派完全在 **Lua VM 内** 完成：IMT/SMT 上的 `__index` / `__newindex` 为 Lua closure，通过 upvalue 持有三张普通 table（method / fieldGetter / fieldSetter）。

这与规范 §2–§4 的算法 **字面一致**，也是 Mono 重写的硬性决策（见 [../MONO.md](../MONO) D2）。

---

## 2. Bootstrap 流程

### 2.1 一次性加载（`EnsureLoaded`）

`LuaEnv` 构造时调用 `TypeMemberLuaIndexer.EnsureLoaded(L)`：

1. `dostring` 执行内嵌 `BootstrapChunk`（工厂函数 `bind_indexer`）。
2. 工厂返回 `(index, newindex)` 两个 function；将工厂本身 `luaL_ref` 到 registry（`_bindIndexerRef`）。
3. 全局仅加载 **一次**；后续每个类型绑定复用同一工厂 ref。

Bootstrap 使用 **`rawget`** 查三表，避免用户篡改 table metatable 影响分派。静态与实例共用同一工厂，通过 `isStatic` 布尔 upvalue 切换 `__newindex` 错误前缀。

### 2.2 静态 SMT 的 extrasTable

`BindStaticMetatable` 将 **SMT 自身** 作为 `extrasTable` 传入工厂。这样 `__index` 在 method/getter miss 后还可 `rawget(extrasTable, key)`，用于 `__call` 等非三表成员（规范 [../../spec/metatable/01-LAYOUT.md](../../spec/metatable/01-LAYOUT) 中挂在 SMT 上的键）。实例 IMT **无** extrasTable（传 `nil`）。

### 2.3 绑定期挂接（`BindInstanceMetatable` / `BindStaticMetatable`）

对每个 `MemberTableSet`（registry 中已有三张空表 ref）：

1. `lua_rawgeti` 取出 `_bindIndexerRef` 工厂。
2. `pushvalue` 三张 member table（及可选 extras）。
3. `pcall(工厂, 5, 2, 0)` → 栈顶 `newindex`，次顶 `index`。
4. **先** `lua_setfield(mt, "__newindex")`，**再** `lua_setfield(mt, "__index")`（与 pcall 返回顺序一致）。

闭包 upvalue 持有三表 **副本引用**（`pushvalue` 时的 table），非 registry index；table 本体仍在 registry 中由 `MemberTableSet` 管理，Emit 阶段向同一张表 `rawset` 成员 closure。

---

## 3. 三表生命周期

| 阶段 | 行为 |
|------|------|
| Phase 2 | `TypeRegistryCommon.CreateEmptyMemberTableSet` 创建三张 **空** table 并 ref；挂 indexer；**不写成员** |
| Phase 3（已完成） | `MemberTableEmitter.Fill` 按 Map 写入 compiled closure；替换 `SMT.__call` |
| 静/实隔离 | `TypeBinding.StaticTables`、`ByObjInstanceTables`、`ByValInstanceTables` 各一套，**不可共用** upvalue |
| struct ByVal/ByObj | 实例成员名相同，但 IMT 与三表 **各一套**（与 Il2Cpp `byvalInstanceMap` / `byobjInstanceMap` 同构） |

注册顺序（避免静态 `__newindex` 误触发）与规范一致：

1. 构建 SMT（含 `__call` 占位）。
2. `PushInstanceMetatable` → 建 IMT + 三表 + 绑 indexer。
3. `lua_setfield(T, "__instance_mt")`（此时 T 尚无 SMT）。
4. `lua_setmetatable(T, SMT)`。

---

## 4. 与 MetaBinding / Emit 的衔接

### 4.1 Phase 2：`MetaBinding.EnsureBinding`

- 扫描 public method / field / property（含继承扁平化）。
- 写入 `TypeBinding.{Static,ByObj,ByVal}Map`（C# `Dictionary<string, MetaInfo>`）。
- **不**创建 Lua closure；**不** Event 专用分支（D5）。
- 同名 method 收集为 `MethodOverloads` 列表，供 Phase 3 overload dispatch。

### 4.2 Phase 3：Emit 写入三表（已实现）

| C# 成员 | 目标表 | closure 行为 |
|---------|--------|--------------|
| Method（单重载） | `methodTable` | 直接返回 bridge；**不** call |
| Method（多重载） | `methodTable` | arity dispatch（MVP：同 arity 先到先得） |
| 索引器 property | `methodTable` | 暂作 Method 路径；完整 get/set_Item 后续 |
| Field / 无参 Property getter | `fieldGetterTable` | `function(obj) return ... end` |
| 可写字段 / 可写 property | `fieldSetterTable` | `function(obj, value) ... end` |
| `add_*` / `remove_*` | `methodTable` | 与普通方法相同 |

**禁止：** field getter 进 `methodTable`；只读 property 进 `fieldSetterTable`。

Emit 失败（无法为签名生成 Expression）→ **`EmitException`**；继承成员可跳过，本类型声明成员失败则中止绑定（D3）。禁止静默 `Method.Invoke` + `object[]`。

### 4.3 热路径约束（D7）

特化 bridge closure **不得** 依赖：

- `MethodMarshalCtx*` upvalue
- methodId / registry 间接查表
- 运行时字符串 → C# 字典

闭包应直接捕获 `MethodInfo`/`FieldInfo`/已编译 delegate，与 Il2Cpp direct method closure 语义对齐。

---

## 5. Miss 与错误消息

与 [../../spec/metatable/02-INDEX.md](../../spec/metatable/02-INDEX) §5 一致：

| 场景 | 行为 |
|------|------|
| `__index` 三表均 miss | 返回 `nil`（**不**调 C# fallback） |
| `__newindex` setter miss 但 getter 存在 | `zlua: property is read-only: {key}` |
| `__newindex` 完全 miss | `zlua: instance member not writable: {key}` / static 前缀变体 |

Phase 2 空表时，除 enum 常量等写在类型表 `T` 上的键外，任意实例成员访问均 miss。Phase 3 起已写入成员的键按上表命中。

---

## 6. 性能说明

相对旧 Mono 的 C# `InstanceIndex`（P/Invoke + `tostring` + GC），三表 Lua indexer 在 **不 patch VM** 前提下与 xLua `obj_indexer` 同量级：

- method：`__index` 帧 + 1× `rawget(methodTable)`
- field：+ 1× `rawget(fieldGetterTable)` + getter call

Mono 与 Il2Cpp 实现路径不同，但 Lua 可见语义须一致（见 [../../spec/metatable/02-INDEX.md](../../spec/metatable/02-INDEX)）。

---

## 7. 实现文件

| 文件 | 职责 |
|------|------|
| `Mt/TypeMemberLuaIndexer.cs` | Bootstrap + BindInstance/StaticMetatable |
| `Mt/TypeRegistryCommon.cs` | 创建空三表、挂 SMT/IMT、注册顺序 |
| `Mt/MetaBinding.cs` | Bind 期成员扫描 → Map |
| `Mt/TypeRegistry*.cs` | 按类型族调用 Common + EnsureBinding |
| `Emit/*`（Phase 3） | 写三表 closure |

---

## 8. 验收检查项

- [ ] 已注册成员：hot path 无 C# `InstanceIndex` / `StaticTypeIndex`
- [ ] 未注册：`__index` → `nil`；`__newindex` → strict error
- [ ] 静/实三表隔离；struct ByVal/ByObj 各一套实例三表
- [ ] 继承成员 Bind 期扁平化；子类覆盖同名键
- [ ] 无 Event 子表；`add_Event` 在 `methodTable` 且为普通 closure
- [ ] Mono 与 Il2Cpp 成员集合与 miss/strict 语义一致
