---
sidebar_position: 9
title: "ObjectRegistry / StructRegistry"
---

# ObjectRegistry / StructRegistry

> **Il2Cpp：** `marshal/ObjectRegistry.cpp`、`marshal/StructRegistry.cpp`  
> **Mono：** `Runtime/Mono/Marshaling/ObjectRegistry.cs`、`StructRegistry.cs`  
> **语义：** [../../spec/10-LIFETIME.md](../../spec/10-LIFETIME)、[../../spec/marshal/06-CLASS.md](../../spec/marshal/06-CLASS)、[../../spec/marshal/05-STRUCT.md](../../spec/marshal/05-STRUCT)

---

## 1. 职责概览

| Registry | 管理对象 | 目的 |
|----------|----------|------|
| **ObjectRegistry** | ByObj userdata（引用类型、struct ByObj、boxed enum 等） | `(obj, viewType)` 弱缓存复用 + **槽位强引用** 防止 Lua 侧 GC 丢 C# 对象 |
| **StructRegistry** | non-blittable **ByVal** userdata payload | 让 GC 扫描 payload 内嵌的 managed 引用（Il2Cpp GC root / Mono boxed companion） |

二者均在 `LuaEnv` 初始化早期注册，Shutdown 时逆序清理。

---

## 2. ObjectRegistry

### 2.1 Userdata 布局（`MarshalDefs.h`）

```cpp
struct ZLuaObjectUserData {
    UserDataHeader header;   // kind == ByObj
    uint32_t slotIndex;
    Il2CppObject* obj;
    Il2CppClass* viewKlass;  // 声明类型门面（IMT / 缓存键）
};
```

Mono 侧 `obj`/`viewType` 存于 **槽位表**，userdata 仅保留 `SlotIndex`（减小 userdata 体积、统一释放路径）。

**viewKlass / ViewType：** 同一 C# 实例以不同声明类型（接口、基类）push 时，IMT 与 overload 解析需声明类型；缓存键为 `(obj, viewKlass)` 二元组。

### 2.2 槽位强引用（Slot Registry）

Il2Cpp `ObjectSlotRegistry` / Mono `ObjectSlotRegistry`：

- 预分配数组（初始 1024，倍增扩容）；
- `Register` 返回 `slotIndex`；userdata `__gc` 时 `Unregister` 并回收 index 到 free stack；
- **强引用** C# 对象，直到对应 userdata 被 Lua GC。

这保证 Lua 仍持有 userdata 时，C# 侧不会因无其他引用被回收。

### 2.3 弱缓存（Identity + View）

Il2Cpp：

- registry 中一张 **弱值** Lua table（`s_objectCacheRef`）；
- C++ `HashMap<ObjectViewKey, int>` 记录 `(obj, viewKlass) → cache table 中的 integer key`；
- 命中则复用已有 userdata，避免重复 push。

Mono：同等语义，`Dictionary<ObjectViewKey, int>` + registry weak table。

**Push 流程（概念）：**

1. 查 weak cache `(obj, viewType)`；
2. miss → 分配 slot → 创建 full userdata → 设 metatable（`MetaTableCache` / `MetatableHooks`）→ 写入 cache。

### 2.4 Pop / This 解析

- `Pop(L, idx)` → 还原 `Il2CppObject*` / `object`，校验 kind；
- `PopThis` → 仅 ByObj，供 bridge 热路径；
- 与 [../../spec/marshal/06-CLASS.md](../../spec/marshal/06-CLASS) 的 identity 规则一致。

### 2.5 `__gc`：`OnReleaseObjectUserData`

1. 从 userdata 读 `slotIndex`；
2. `UnregisterObject(slotIndex)`；
3. 从 weak cache 移除 `(obj, view)` 条目（若仍映射到该 userdata）。

`LuaEnv::AddPendingRef` / `ProcessPendingRefReleases`：绑定期若需延迟 `luaL_unref`，在安全点批量释放，避免 GC 回调重入问题。

### 2.6 Initialize / Shutdown

**Initialize(L)：** 创建 weak cache table 并 `luaL_ref`；初始化 slot 数组。

**Shutdown(L)：** 清空 map、释放所有 slot、unref cache table。

顺序：在 `MetaTableCache` 之前 Initialize；Shutdown 在 `MetaTableCache` 之后、`lua_close` 之前。

---

## 3. StructRegistry

### 3.1 适用场景

**仅 non-blittable struct 的 ByVal userdata：** payload 内可能含 `string`、引用类型字段等，Lua GC 不会自动扫描 raw userdata 内存。

Blittable struct ByVal：**不**登记 StructRegistry；IMT 可挂 `nullptr` `__gc`（见 `TypeRegistryCommon` 对 `klass->is_blittable` 分支）。

### 3.2 Il2Cpp 实现

```cpp
struct ByValUserDataHeader {
    UserDataHeader header;  // kind == ByVal
    Il2CppClass* klass;
    // payload follows
};

static void Register(ByValUserDataHeader* header);
static void Unregister(ByValUserDataHeader* header);
```

- `Register`：将 payload 内引用标记为 GC root（或等价跟踪）；
- `OnReleaseByValUserData`（`__gc`）：`Unregister`。

### 3.3 Mono 实现

Mono 无 Il2Cpp 式 embedded GC scan，采用 **boxed companion**：

```csharp
static Dictionary<IntPtr, object> s_boxedByUserData;

RegisterBoxed(userdataPtr, boxed);  // push 时
Unregister(userdataPtr);            // __gc 时
```

boxed 对象持有 struct 副本及其中引用的强引用，直到 ByVal userdata 释放。

### 3.4 与 Mt 的边界

`StructRegistry` 位于 `marshal/`；**不** include `mt/`。Metatable ref 由 `MetaTableCache` / `MetatableHooks.PushByValMetatable` 提供。

---

## 4. Mono `MetatableHooks`

`MarshalDefs.cs` 中注入：

```csharp
internal static class MetatableHooks {
    internal static Action<IntPtr, Type> PushByObjMetatable;
    internal static Action<IntPtr, Type> PushByValMetatable;
}
```

`Mt` 在 startup 赋值，避免 `Marshal → Mt` 硬依赖，与 Il2Cpp 分层一致。

---

## 5. 对照表

| 行为 | Il2Cpp | Mono |
|------|--------|------|
| ByObj 槽位 | `Il2CppObject**` 数组 | `ObjectSlot[]` |
| 弱缓存 | weak values registry table | 同 |
| view 键 | `Il2CppClass* viewKlass` | `Type ViewType` |
| non-blittable ByVal GC | `StructRegistry` root | boxed companion dict |
| `__gc` 入口 | C closure 注册到 IMT | `GetFunctionPointerForDelegate` + pin |

---

## 6. 常见 invariant

- 元数据指针 `Il2CppClass*` / `MethodInfo*` 等在热路径 **默认非 null**（见 workspace rule）；Registry API 不重复 null-check viewKlass。
- 同一 `(obj, view)` 缓存条目在同一 Lua 线程内应指向 **同一** userdata，直到该 userdata 被 GC。
- Shutdown 必须先 `ProcessPendingRefReleases`，再 tear down Registry，最后 `lua_close`。

---

## 7. 相关文件

| Il2Cpp | Mono |
|--------|------|
| `marshal/ObjectRegistry.h/.cpp` | `Marshaling/ObjectRegistry.cs` |
| `marshal/StructRegistry.h/.cpp` | `Marshaling/StructRegistry.cs` |
| `marshal/ObjectMarshal.cpp` | `Marshaling/ObjectMarshal.cs` 等 |
| `marshal/StructMarshal.cpp` | `Marshaling/StructMarshal.cs` |
| `mt/MetaTableCache.cpp` | `Mt/MetaTableCache.cs` |
