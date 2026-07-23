---
sidebar_position: 10
title: "Il2Cpp Dispatch* Indexer"
---

# Il2Cpp Dispatch* Indexer

> **源码：** `mt/TypeRegistryCommon.cpp`、`mt/MetaBinding.cpp`  
> **语义权威：** [../../spec/metatable/02-INDEX.md](../../spec/metatable/02-INDEX)

---

## 1. 路径

Il2Cpp Player 成员索引走 native **`Dispatch*`** C closure：`__index` / `__newindex` 带 **1 个 upvalue**（`TypeBinding*` lightuserdata）。

`TypeRegistryCommon.cpp` 在填充 IMT/SMT 时调用 `FillInstanceMetatable(..., DispatchInstanceIndex, DispatchInstanceNewIndex)`。

静态类型表 SMT 使用对称的 `DispatchStaticIndex` / `DispatchStaticNewIndex`（查 `binding->staticMap`）。

---

## 2. 核心数据结构

### 2.1 `TypeBinding`（`MetaBinding.h`）

| 字段 | 用途 |
|------|------|
| `Il2CppClass* klass` | 声明类型 |
| `NameMetaMap staticMap` | 静态成员：name → `MetaInfo` |
| `NameMetaMap byobjInstanceMap` | 引用 / struct ByObj 实例成员 |
| `NameMetaMap byvalInstanceMap` | struct ByVal 实例成员 |
| `MethodGroups* ctorGroups` | 构造 overload（不走 indexer） |

`NameMetaMap` = `AppendOnlyStringHashMap<MetaInfo>`：绑定期写入，运行时只读；key 为成员名字符串（Il2Cpp 持久化 name）。

### 2.2 `MetaInfo`

```cpp
enum class MetaKind { Method, Field, Property };  // Event 已移除

struct MetaInfo {
    MetaKind kind;
    union {
        struct { int closureRef; } method;
        FieldMarshalCtx field;
        PropertyMarshalCtx property;
    };
};
```

- **Method：** `closureRef` 为 registry 中 direct bridge 或 dispatch closure。
- **Field：** `FieldMarshalCtx`（offset + `MarshalMetaInfo*` + `cs2luaWriter`）。
- **Property：** `PropertyMarshalCtx`（getter/setter 函数指针 + sealed 标志）。

---

## 3. `DispatchInstanceIndex` 算法

模板参数：

- `ResolveInstanceMethodTargetFn` — 解析 `this`（ByVal / ByObj 引用 / 引用类型）。
- `MetaTableKind` — 选择 `byvalInstanceMap` 或 `byobjInstanceMap`。

```cpp
template <ResolveInstanceMethodTargetFn resolveMethodTarget, MetaTableKind kind>
static int DispatchInstanceIndex(lua_State* L)
{
    TypeBinding* binding = (TypeBinding*)lua_touserdata(L, lua_upvalueindex(1));
    const char* key = luaL_checkstring(L, 2);
    const MetaInfo* info = LookupMeta(map, key);
    if (info == nullptr) {
        lua_pushnil(L);
        return 1;
    }
    switch (info->kind) {
    case MetaKind::Method:
        return LuaUtil::PushRef(L, info->method.closureRef);
    case MetaKind::Field:
        writer(L, fieldPtr, meta); return 1;
    case MetaKind::Property:
        PropertyBridge::InvokeGetter(L, target, &info->property); return 1;
    }
}
```

**与规范对齐：**

| 规范要求 | Dispatch* 行为 |
|----------|----------------|
| method 直接返回 closure | `PushRef(closureRef)`，不 call |
| field/property 自动 invoke getter | C closure 内 call writer/getter |
| `__index` miss | `lua_pushnil` |
| method 优先于 field 同名 | Bind 期 `MetaBinding` 写入 map 时已消解；lookup 单表 |

### 3.1 实例变体入口

| C closure | Map | this 解析 |
|-----------|-----|-----------|
| `InstanceByValIndex` | `byvalInstanceMap` | `ResolveByValMethodTarget` |
| `InstanceByObjIndex` | `byobjInstanceMap`（值类型 boxed） | `ResolveByObjValueTypeMethodTarget` |
| `InstanceReferenceIndex` | `byobjInstanceMap` | `ResolveByObjReferenceMethodTarget` |

`FillInstanceMetatable` 在创建 IMT 时绑定对应 Index/NewIndex 函数对。

---

## 4. `DispatchInstanceNewIndex`

```cpp
const MetaInfo* info = LookupMeta(map, key);
if (info == nullptr)
    return luaL_error(L, "zlua: member not found: %s", key);
// Field → lua2csWriter; Property → PropertyBridge::InvokeSetter
// Method / 无 setter → error
```

miss 时 **strict error**（与规范一致）。只读 field（`cs2luaWriter == nullptr` 且尝试写）在 field 分支报错。

---

## 5. Bind 期：`MetaBinding`

`MetaBinding::EnsureBinding(Il2CppClass*)` 在 **首次** `import_type` / 触达类型时：

1. 扁平化 public instance/static 成员到三个 map。
2. 为每个 method 创建 `MethodMarshalCtx`；单重载 → `CreateDirectMethodClosureRef`；多重载 → `CreateMethodDispatchClosureRef` + `MethodGroups`。
3. Field/Property 写入 `MetaInfo`；`Dispatch*` 在运行时 lookup 同一份 map。

**Event：** 不生成 `MetaKind::Event`；`add_*` / `remove_*` 作为普通 method 进入 map。

Closure upvalue 布局（direct method）：

- `[1]` ClosureKind（number）
- `[2]` `TypeBinding*`
- `[3]` `MethodMarshalCtx*`

Dispatch closure 额外 upvalue 挂 `MethodGroups*`。

---

## 6. 与 `TypeRegistryCommon` 的协作

| 函数 | 职责 |
|------|------|
| `WriteCommonTypeFields` | `__fullname`、`__typeid`、`__klass` 等 |
| `RegisterStaticLiteralFields` | enum/const 直接写类型表 T |
| `FillInstanceMetatable` | `__type`、`__udkind`、`__gc`、`Dispatch*` |
| `AttachStaticMetatable` | SMT + `__call`（构造 dispatch） |
| `PushTypeTable` | 确保 `MetaBinding::EnsureBinding` 已执行 |

`MetaTableCache` 缓存 `(Il2CppClass* → IMT ref, SMT ref)`，避免重复绑表。

---

## 7. 热路径成本

每次 `obj.field` / `obj:Method` **取成员** 时，Dispatch* 固定开销：

1. Lua：查 mt → 调 C `__index` closure
2. C：`lua_touserdata` + `luaL_checkstring` + `LookupMeta`（字符串哈希）
3. Method 额外：`lua_rawgeti(REGISTRY, closureRef)`

**注意：** 本路径 **不** 改变 [../../spec/metatable/02-INDEX.md](../../spec/metatable/02-INDEX) 规定的 Lua 可见语义；仅实现机制不同。

---

## 8. 调试

- `LookupMeta` miss 返回 nil 时 **不** 调用 C# 反射 fallback（规范禁止）。
- 对照 Mono 行为时，Il2Cpp 与 Mono 的 miss/成员集应一致（Mono 走 Lua 三表 indexer，见 [INDEXER-MONO.md](./INDEXER-MONO)）。

---

## 9. 相关文件

| 文件 | 内容 |
|------|------|
| `mt/TypeRegistryCommon.cpp` | `Dispatch*` 模板、`FillInstanceMetatable` |
| `mt/MetaBinding.cpp` | map 填充、closure ref 创建 |
| `mt/InstanceTarget.cpp` | this / field 地址 |
| `bridge/PropertyBridge.cpp` | getter/setter invoke |
| `marshal/MarshalMeta.cpp` | field writer 函数指针 |
