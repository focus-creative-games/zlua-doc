---
sidebar_position: 1
title: "Mono Expression Emit"
---

# Mono Expression Emit

> **目标目录：** `Runtime/Mono/Emit/`（Phase 3 起）  
> **对照 Il2Cpp：** [STUBS-IL2CPP.md](./STUBS-IL2CPP)（构建期 stub 表）  
> **约束：** [../MONO.md](../MONO) D3、D6、D7

---

## 1. 设计原则

Mono Editor 在 **类型绑定期**（`MetaBinding.EnsureBinding` 之后、首次需要 Lua closure 时）为 **每个** public 字段、property accessor、方法、构造函数生成 **唯一** 的 Lua C# 回调：

```
System.Linq.Expressions → Compile() → LuaCSFunction / delegate
    → lua_pushcfunction → 写入三表（method / fieldGetter / fieldSetter）
```

与 Il2Cpp **ReducedType 签名复用** 不同，Mono **不**维护全局 stub 哈希表；每个 `(Type, MemberInfo, isStatic, isByVal)` 组合一条特化桥。

---

## 2. 失败策略（D3）

| 情况 | 行为 |
|------|------|
| 签名在 Expression 可表达集合内 | 正常 Compile |
| 不支持的签名（如 open generic method、特定 byref 组合） | **绑定期 `InvalidOperationException`**，消息含类型与成员全名 |
| **禁止** | 静默 fallback 到 `Method.Invoke` + `object[]` |

已知可支持集用 `Tests/Lua/**` 覆盖；新增签名类型需 **先** 扩展 Emit 再放开绑定。

---

## 3. 实施顺序（Phase 3）

[../MONO.md](../MONO) 建议按依赖从简到繁：

| 步骤 | 成员 | 写入表 | 备注 |
|------|------|--------|------|
| 1 | **Field** static/instance | getter → `fieldGetterTable`；可写 → `fieldSetterTable` | 直接 `FieldInfo.Get/SetValue` 的 Expression 或 emit IL |
| 2 | **Property** 无参 | 同 Field，调 property getter/setter MethodInfo | 索引器 property → **methodTable**（dispatch） |
| 3 | **Method** 单重载 | `methodTable` direct closure | 捕获 `MethodInfo` + typed pop/push |
| 4 | **Method** 多重载 | `methodTable` dispatch closure | 内调 managed `MethodOverloadResolver`（对齐 [../marshal/OVERLOAD-RESOLVER.md](../marshal/OVERLOAD-RESOLVER)） |
| 5 | **Constructor** | `SMT.__call` | 复用 ctor overload 分组 |
| 6 | **别名** | `methodTable` 额外键 | `[LuaAlias]`、`zlua.register_method` |

每步完成后跑对应 Lua case，再进入下一步。

---

## 4. Closure 形状（D7）

### 4.1 禁止的 upvalue 模式

Il2Cpp direct method closure 使用：

- `ClosureKind` + `TypeBinding*` + `MethodMarshalCtx*`

Mono Emit **不得** 复制 `MethodMarshalCtx` / methodId 到 Lua upvalue。特化桥应：

- 直接 `Compile` 为 `(IntPtr L) => int` 委托；
- 内部静态持有或闭包捕获 **已解析** 的 `MethodInfo`/`FieldInfo`、预构建的 pop/push delegate；
- overload dispatch 捕获 **只读** 候选数组，而非 runtime 字符串查表。

### 4.2 写入三表

Emit 完成后：

```csharp
// 伪代码
LuaDll.lua_rawgeti(L, RegistryIndex, binding.StaticTables.MethodTableRef);
LuaDll.lua_pushcfunction(L, compiledDelegate);
LuaDll.lua_setfield(L, -2, methodName);
LuaDll.lua_pop(L, 1);
```

与 [../metatable/INDEXER-MONO.md](../metatable/INDEXER-MONO) 一致：method 表存 **closure 本身**，非 wrapper。

---

## 5. `this` 与 ByVal / ByObj

实例方法 Emit 须分支：

| 目标种类 | `this` 来源 |
|----------|-------------|
| class ByObj | `ObjectRegistry.PopThis(L, 1)` |
| struct ByVal | `InstanceTarget` 等价：payload 指针 / 复制 |
| struct ByObj | boxed ByObj userdata |

与 Il2Cpp `InstanceTarget::GetResolveMethodThisFunc` 规则对齐；具体 helper 放 `Mt/InstanceTarget.cs`（已有占位）。

---

## 6. Marshal 与 Emit 协作

Pop/push 逻辑 **复用** `Marshaling/*Marshaling*.cs` 的 typed API，不在 Emit 内重复 spec 规则：

- 绑定期为每个参数/返回值构建 **delegate 链**（等同 Il2Cpp `MarshalMetaInfo` writer）；
- 热路径 **无** 每 call 分配 `object[]`（除非 spec 要求的 boxing 本身）。

`[LuaMarshalAs]`：Emit 读 attribute 选择 pop/push 策略（对齐 [../../spec/marshal/02-MARSHAL-AS.md](../../spec/marshal/02-MARSHAL-AS)）。

---

## 7. 与 GetFunction / Delegate 的边界

| 路径 | 实现 |
|------|------|
| Lua→C# 成员 | **Emit/**（本文） |
| C#→Lua `GetFunction` | `DelegateImpl/` + `LuaCallInvoker`（非 Emit） |
| Lua function → C# delegate | `DelegateImpl/` Expression（Phase 4） |

勿混用 Emit 目录存放 C#→Lua delegate 桥逻辑。

---

## 8. 目录规划（建议）

```
Emit/
├── FieldEmitter.cs
├── PropertyEmitter.cs
├── MethodEmitter.cs
├── ConstructorEmitter.cs
├── MemberTableEmitter.cs   // Fill 三表 + BindCall
├── BridgeMarshaling.cs
├── EmitMethods.cs          // Expression 用 MethodInfo 缓存
├── ClosurePin.cs
└── EmitException.cs
```

命名空间：`ZLua.Emit`。Overload 精细解析（better-member）与 `OverloadDispatchEmitter` 可后续拆分。

---

## 9. 验收

- [x] 绑定期 unsupported 签名 → `EmitException`，无 silent Invoke
- [ ] 三表成员与 Il2Cpp 成员集一致（同一类型 public API）
- [x] 热路径无 `Method.Invoke`、无 `object[]` 参数数组（Field 用 `FieldInfo.Get/SetValue`）
- [ ] overload 与 Il2Cpp 选中同一重载（当前 arity MVP）
- [x] MetaBinding / closure 无 methodId upvalue
- [ ] `Tests/Lua/manifest.lua` Phase 3 相关 case 全绿

---

## 10. 相关文档

- 三表挂载：[../metatable/INDEXER-MONO.md](../metatable/INDEXER-MONO)
- Overload：[../marshal/OVERLOAD-RESOLVER.md](../marshal/OVERLOAD-RESOLVER)
- Il2Cpp stub 对照：[STUBS-IL2CPP.md](./STUBS-IL2CPP)
