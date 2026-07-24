---
sidebar_position: 3
title: "Il2Cpp Generated Stubs"
---

# Il2Cpp Generated Stubs

> **输出目录：** `libil2cpp/zlua/generated/`（构建写入 `build-win64/.../zlua/generated/`）  
> **生成器：** `Packages/com.code-philosophy.zlua/Editor/CppCodeGen/`  
> **运行时加载：** `LuaAppDomain::Initialize` → `*Bridge::Initialize`

---

## 1. 设计原则

Il2Cpp Player **不能** JIT 或 `Method.Invoke`。Lua→C# 热路径依赖构建期扫描用户程序集，为每个 **AOT 可达签名** 生成 C++ stub，并在 runtime 通过 **函数指针表** 查找。

与 Mono 对比（[EMIT-MONO.md](./EMIT-MONO)）：

| Il2Cpp | Mono |
|--------|------|
| 构建期 C++ 代码生成 | 绑定期 `Expression.Compile` |
| **按 ReducedType 签名复用** stub | **每成员一条** 特化桥，不共享 ReducedType 表 |
| 产物在 `generated/` | 逻辑在 `Runtime/Mono/Emit/` |

---

## 2. 生成入口：`CodeGenerator.Generate`

`Editor/CppCodeGen/CodeGenerator.cs` 依次调用：

| 顺序 | 生成器 | 产物 |
|------|--------|------|
| 1 | `BuiltinScriptsCodegen` | `BuiltinScripts.inc` |
| 2 | `PropertyBridgdeCodegen` | `PropertyBridgeStub.h` |
| 3 | `MethodBridgeCodegen` | `MethodBridgeStub.h` |
| 4 | `DelegateBridgeCodgen` | `DelegateBridgeStub.h` |
| 5 | `MarshalAsCodegen` | `MarshalBindings.h/.cpp`（`[LuaMarshalAs]` 扩展） |

Unity Editor 构建 Il2Cpp 时写入目标 `zlua/generated/`；**勿手改**生成文件。

---

## 3. `MethodBridgeStub.h`

### 3.1 分析

`MethodBridgeAnalyzer.Collect` 遍历用户程序集非泛型类型/方法，跳过 `.cctor`，为每个 `MethodDef` 生成 `MethodBindingInfo`：

- `uniqueName` / `stubName`（`NameUtil.CreateStubName`）
- 参数/返回值 `ParamMarshalInfo` / `LuaMarshalMetaInfo`（`MarshalMetaUtil`）

### 3.2 产物结构

```cpp
namespace methodbridge {
struct MethodBridgeEntry {
    const char* stubName;
    FnLua2CsInvoker lua2CsInvoker;
};
static const MethodBridgeEntry g_methodBridges[] = {
    { "Stub_MyType_DoWork_int", Bridge_MyType_DoWork_int },
    ...
    { nullptr, nullptr }
};
}
```

每个 `Bridge_*` 函数：

- 从 Lua 栈 pop 参数（typed writer 或内联 primitive）；
- `alloca` / 栈上布局；
- 调 `method->invoker_method(...)`；
- push 返回值。

### 3.3 Runtime 注册

`MethodBridge::Initialize()` 遍历 `g_methodBridges` 填入 `AppendOnlyStringHashMap<FnLua2CsInvoker>`。

`MethodBridge::ResolveMethodInvoker(method)` 按 **ReducedType 签名** 查 stubName；miss 时 fallback `DefaultInvokeLuaMethod`（alloca + `MarshalMeta` writer，较慢）。

`MetaBinding::CreateMethodMarshalCtx` 将解析结果写入 `MethodMarshalCtx::lua2CsInvoker`。

---

## 4. `PropertyBridgeStub.h`

为 property getter/setter 生成 `FnPropertyGetter` / `FnPropertySetter` 函数指针表。

`PropertyBridge::Initialize()` 注册；`MetaBinding` 填充 `PropertyMarshalCtx::getter/setter`。

Field **不**单独 stub 表：field 读写走 `MarshalMetaInfo::cs2luaWriter` / `lua2csWriter` + offset（`FieldMarshalCtx`）。

---

## 5. `DelegateBridgeStub.h`

C# delegate 类型 invoke 与 Lua function → delegate 的 stub 表。

`DelegateBridge::Initialize()` 在 AppDomain 级加载；与 [../../spec/marshal/09-FUNCTION.md](../../spec/marshal/09-FUNCTION) 一致。

---

## 6. C#→Lua（GetFunction）

**不在 `generated/` 内。** C#→Lua 由 `LuaAppDomain.GetFunction<T>` 运行时绑定 module function 为 closed delegate，`Invoke` 经 **Delegate 桥**（与 [../../spec/marshal/09-FUNCTION.md](../../spec/marshal/09-FUNCTION) 一致）。Il2Cpp 与 Mono **API 相同**。

---

## 7. `MarshalBindings.*`

`MarshalAsCodegen` 为带 `[LuaMarshalAs]` 的 **非默认** 签名生成额外 writer/reader，供 stub 或 `MarshalMeta::Create` 引用。

规则见 [../../spec/marshal/02-MARSHAL-AS.md](../../spec/marshal/02-MARSHAL-AS)。

---

## 8. `BuiltinScripts.inc`

嵌入 `globals.lua`、`zlualib.lua` 等为 C 字符串数组；`LuaEnv.cpp` `#include` 后在 `RegisterGlobals` / `RegisterZLuaApi` 中 `dostring`。

Mono 等价物：`Lvm/BuiltinScripts.cs` 从资源加载同名脚本。

---

## 9. 失败策略

| 场景 | 行为 |
|------|------|
| 签名无法生成 stub（unsupported generic 等） | Codegen **报错** 或跳过并记录；不生成 silent slow path 进 Player |
| Runtime stub 查表 miss | `DefaultInvokeLuaMethod`（显式慢路径，开发期应补 stub） |

Mono 对应：无法 Emit → **绑定期抛异常**（见 [../MONO.md](../MONO) D3）。

---

## 10. 与 MetaBinding / Indexer 的关系

- stub **不**决定成员是否进入 indexer；`MetaBinding` 仍创建 closure ref。
- direct method closure 的 upvalue 含 `MethodMarshalCtx*` → 指向已解析的 `lua2CsInvoker`。
- `Dispatch*` 仅影响 **如何取到** closure，不影响 stub 本体。

---

## 11. 相关文件

| 路径 | 职责 |
|------|------|
| `Editor/CppCodeGen/CodeGenerator.cs` | 总入口 |
| `Editor/CppCodeGen/MethodBridgeCodegen.cs` | Method stub |
| `Editor/CppCodeGen/PropertyBridgdeCodegen.cs` | Property stub |
| `Editor/CppCodeGen/DelegateBridgeCodgen.cs` | Delegate stub |
| `bridge/MethodBridge.cpp` | stub 表加载 |
| `lvm/LuaAppDomain.cpp` | Initialize 顺序 |
