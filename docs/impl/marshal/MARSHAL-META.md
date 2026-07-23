---
sidebar_position: 6
title: "MarshalMeta 与 Writer"
---

# MarshalMeta 与 Writer

> **Il2Cpp：** `marshal/MarshalMeta.cpp`、`marshal/MarshalDefs.h`  
> **Mono：** `Runtime/Mono/Marshaling/MarshalDefs.cs` 及 `TypedMarshal` / `PrimitiveMarshal` / `ObjectMarshal` 等
> **规范：** [../../spec/marshal/](../../spec/marshal/)（Default / MarshalAs / 各类型 push-pop 规则）

---

## 1. 核心结构：`MarshalMetaInfo`

定义于 `MarshalDefs.h`：

```cpp
struct MarshalMetaInfo {
    FnMarshalLua2Cs lua2csWriter;   // Lua 栈 → C# 内存
    FnMarshalCs2Lua cs2luaWriter;   // C# 内存 → Lua 栈
    const Il2CppType* type;
    Il2CppClass* typeKlass;         // 声明类型门面
    int32_t size;                   // 非 ref 值类型字节数；引用类型为 sizeof(void*)
    int luaByValRefIndex;           // 延迟绑定的 ByVal IMT ref
    int luaByObjRefIndex;           // 延迟绑定的 ByObj IMT ref
    bool passByValue;               // 桥接 alloca 路径是否按值传递
};
```

Writer 为 **函数指针**，绑定期一次解析，运行时无反射：

```cpp
typedef void (*FnMarshalLua2Cs)(lua_State* L, int valueIdx, void* address, const MarshalMetaInfo* ctx);
typedef void (*FnMarshalCs2Lua)(lua_State* L, void* address, const MarshalMetaInfo* ctx);
```

Mono Phase 1+ 在 managed 侧用 delegate / 编译闭包模拟同等「绑定期固定、运行时直调」语义。

---

## 2. 创建入口：`MarshalMeta::Create`

| 重载 | 用途 |
|------|------|
| `Create(L, MethodInfo*, argIndex)` | 方法参数；`argIndex == -1` 表示 **返回值** |
| `Create(L, FieldInfo*)` | 字段 offset 读写 |
| `Create(L, PropertyInfo*)` | property（常转调 accessor MethodInfo） |

创建流程（Il2Cpp）：

1. 根据 `Il2CppType*` 分类（primitive / string / enum / class / struct / array / delegate / pointer …）；
2. 选择预定义的 `Lua2CSMarshalXxx` / `CS2LuaMarshalXxx` 或 `ObjectMarshal` / `StructMarshal` / `OpaqueValueMarshal` 子路径；
3. 应用 `[LuaMarshalAs]`（若存在）→ 切换 `LuaMarshalType`（UserData、Bytes、Opaque、ParamsTable 等，见 spec [02-MARSHAL-AS](../../spec/marshal/02-MARSHAL-AS)）；
4. 填充 `size`、`passByValue`、`typeKlass`；
5. `luaByValRefIndex` / `luaByObjRefIndex` 初始为 `LUA_NOREF`，首次 push 时 `EnsureByValMetatableRefSlow` 懒绑定。

分配器：`LuaMetadataAlloc`（AppDomain 生命周期，与 `LuaEnv` 共存）。

---

## 3. Writer 分派矩阵（Default 路径）

| CLR 类别 | lua2cs | cs2lua | 实现文件 |
|----------|--------|--------|----------|
| void | no-op | no-op | `MarshalMeta.cpp` 内联 |
| bool / 整数 / 浮点 | `PrimitiveMarshal::Pop*` | `Push*` | `PrimitiveMarshal.cpp` |
| char / string | `StringMarshal` | 同 | `StringMarshal.cpp` |
| enum | 底层整数 writer | 同 | `PrimitiveMarshal` + 元数据 |
| class / interface / object | `ObjectMarshal` | 同 | `ObjectMarshal.cpp` |
| struct ByVal | `StructMarshal` copy-in | copy-out / push userdata | `StructMarshal.cpp` |
| struct ByObj |  boxed / ByObj userdata | 同 | `StructMarshal.cpp` |
| array | `ArrayMarshal` | 同 | `ArrayMarshal.cpp` |
| delegate | `DelegateMarshal` | 同 | `DelegateMarshal.cpp` |
| IntPtr / pointer | `OpaqueValueMarshal` | 同 | `OpaqueValueMarshal.cpp` |
| Vector2/3/4 等 | `IntrinsicTypes` | 同 | `IntrinsicTypes.cpp` |

具体规则与 `[LuaMarshalAs]` 覆盖见 spec 各分册；**本文不重复** Lua 可见转换表。

---

## 4. 与 Bind 上下文的关系

### 4.1 Field：`FieldMarshalCtx`

```cpp
struct FieldMarshalCtx {
    const MarshalMetaInfo* meta;
    const FieldInfo* field;
    union {
        void* staticAddress;              // 静态字段
        int32_t instanceOffsetIncludingHeader;  // 实例字段（含 userdata header）
    };
};
```

Indexer 读 field：`cs2luaWriter(L, fieldPtr, meta)`（`Dispatch*` 的 `__index` 内）。

### 4.2 Property：`PropertyMarshalCtx`

含 `FnPropertyGetter` / `FnPropertySetter`（通常指向 `PropertyBridge` stub）、`getterSealed` / `setterSealed`（虚调优化）、`valueTypeKlass`。

Property **不**单独走 `MarshalMetaInfo` 的 getter 函数指针分支时，由 `PropertyBridge::InvokeGetter` 内部分派到 generated stub。

### 4.3 Method：`MethodMarshalCtx`

```cpp
struct MethodMarshalCtx {
    const MethodInfo* method;
    FnResolveMethodThis resolveThis;
    FnLua2CsInvoker lua2CsInvoker;      // 多为 generated stub 或 DefaultInvokeLuaMethod
    const MarshalMetaInfo** paramsMeta;
    const MarshalMetaInfo* retMeta;
    int32_t valueSize;
    int32_t totalParamsSize;
    bool byVal;
    bool sealed;
};
```

`MetaBinding::CreateMethodMarshalCtx` 为每个 AOT 方法构建；params/ret 各调用一次 `MarshalMeta::Create`。

---

## 5. `TypedMarshal.h` 门面

`TypedMarshal::PushByType` / `PopByType`：按 `Il2CppType*` 在 **未绑成员** 场景（delegate invoke 临时路径、`zlua.cast` 等）动态 push/pop。

与 `MarshalMetaInfo` 的关系：门面内部复用相同 writer 逻辑或临时创建 meta。

---

## 6. Codegen 侧的 Meta

Editor `MarshalMetaUtil`（C#）在 **构建期** 为 stub 生成分析：

- `LuaMarshalMetaInfo` / `ParamMarshalInfo` → 写入 `MethodBridgeStub.h` 的桥接签名；
- 与 runtime `MarshalMeta::Create` **独立但规则对齐**（均遵循 spec marshal）。

`MarshalAsCodegen` 生成 `MarshalBindings.*` 扩展 writer。

---

## 7. Mono 对齐说明

| Il2Cpp | Mono（Phase 1–2 现状 / Phase 3 目标） |
|--------|--------------------------------------|
| `FnMarshalLua2Cs` 函数指针 | Emit 生成的 typed pop 序列或 static helper |
| `MarshalMeta::Create` | 绑定期构建 `MarshalMeta` descriptor（`MarshalDefs.cs` 扩展） |
| `EnsureByValMetatableRef` | `MetatableHooks.PushByValMetatable(type)` |

Mono Emit 桥 **不应** 在每次 call 时重新 `MarshalMeta::Create`；须绑定期缓存 layout。

---

## 8. 性能注记

- Writer 本体 **不在** `Dispatch*` indexer 优化范围内（见 [../metatable/INDEXER-IL2CPP.md](../metatable/INDEXER-IL2CPP)）。
- `DefaultInvokeLuaMethod`（无专用 stub 时）使用 alloca + 逐参 writer，慢于 generated stub；Player 应尽量覆盖热路径签名。

---

## 9. 相关文件

| 文件 | 职责 |
|------|------|
| `marshal/MarshalMeta.cpp/.h` | Create、Ensure*MetatableRef |
| `marshal/MarshalDefs.h` | 全部 marshal 上下文 struct |
| `marshal/TypedMarshal.cpp/.h` | Push/Pop 门面 |
| `marshal/PrimitiveMarshal.*` … | 类型 writer 实现 |
| `Editor/CppCodeGen/MarshalMetaUtil.cs` | 构建期 meta 分析 |
