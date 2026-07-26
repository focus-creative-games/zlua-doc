---
sidebar_position: 0
title: "术语表"
---

# 术语表（GLOSSARY）

> 规范性术语以本表为准；实现细节见「实现落点」列。

## 核心架构

| 术语 | 含义 | 实现落点 |
|------|------|----------|
| **ZLua** | Unity 下 C# 与 Lua（PUC-Rio **5.1–5.5** 等）互操作框架；Editor 用 Mono，Player 用 Il2Cpp | `Packages/com.code-philosophy.zlua` |
| **Lua 可见语义** | 脚本侧可观察的行为契约；Mono 与 Il2Cpp **必须一致** | `spec/**` |
| **双运行时** | `ZLua.Mono`（Editor）+ `ZLua.Il2Cpp`（Player）；门面 `LuaAppDomain` | [spec/00-OVERVIEW.md](/docs/spec/00-OVERVIEW/) |
| **libil2cpp/zlua** | Player 侧 native 实现根目录 | `build-win64/.../libil2cpp/zlua` |
| **GetFunction** | C#→Lua：`LuaAppDomain.GetFunction<T>` 按模块与方法名绑定 Delegate | [spec/01-HOST-API.md](/docs/spec/01-HOST-API/) |
| **MethodBridge** | Lua→C# 方法桥；Il2Cpp 按 ReducedType 复用 stub；Mono 每成员 Emit | `impl/codegen/` |

## 类型与命名

| 术语 | 含义 | 实现落点 |
|------|------|----------|
| **`CSharp` 根表** | 全局表；`__index` 懒加载程序集 → 类型 | [spec/02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) §2 |
| **类型表（typeTable）** | `CSharp[assembly][typeFullName]` 解析得到的静态门面 table | §3.1 |
| **`typeFullName`** | CLR 全名；namespace 用 `.`；嵌套类型用 `+` | §2.3 |
| **typeArg** | `zlua` API 中描述 C# 类型的实参：类型表 / `zlua.types.*` / mscorlib 字符串 | [spec/05-LIB.md](/docs/spec/05-LIB/) §3 |
| **门面（view）** | userdata 对外暴露的**声明类型**；可与运行时具体类型不同 | [spec/marshal/06-CLASS.md](/docs/spec/marshal/06-CLASS/) |
| **`__typeid`** | 闭合泛型、数组等无法仅凭字符串反查的类型 id | TypeRegistry |
| **Intern** | 相同 `make_*_type` 实参多次调用返回同一类型表 | TypeRegistry |

## 元表与索引

| 术语 | 含义 | 实现落点 |
|------|------|----------|
| **SMT** | Static Metatable：类型表上的静态元表 | [spec/metatable/01-LAYOUT.md](/docs/spec/metatable/01-LAYOUT/) |
| **IMT** | Instance Metatable：实例 userdata 元表 | 同上 |
| **三表 indexer** | `methodTable` / `fieldGetterTable` / `fieldSetterTable` 分派（Mono） | [spec/metatable/02-INDEX.md](/docs/spec/metatable/02-INDEX/) |
| **Il2Cpp native indexer** | `Dispatch*` C closure + `NameMetaMap`（`MetaBinding` / `TypeRegistry`） | [impl/metatable/INDEXER-IL2CPP.md](/docs/impl/metatable/INDEXER-IL2CPP/) |
| **`__index` miss** | 未注册成员 → 返回 **`nil`**（禁止反射 fallback） | [spec/metatable/02-INDEX.md](/docs/spec/metatable/02-INDEX/) |
| **`__newindex` miss** | 未注册 / 不可写成员 → **`error`** | 同上 |
| **Bind 期扁平化** | 继承链 public 成员在 `EnsureBinding` 时写入当前类型三表；**无**运行时向上查找 | [spec/02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) §5 |
| **dispatch closure** | 多重重载时默认方法名绑定的运行时分派闭包 | [spec/04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) |
| **direct method closure** | 单重重载或别名绑定的桥接闭包；可 `register_method` / `make_generic_method` | MetaBinding |

## Marshal 形态

| 术语 | 含义 | 实现落点 |
|------|------|----------|
| **ByVal** | 值类型 payload userdata（struct 拷贝语义） | [spec/marshal/05-STRUCT.md](/docs/spec/marshal/05-STRUCT/) |
| **ByObj** | 托管引用 / boxed 值经 `ObjectRegistry` 的 userdata | [spec/marshal/06-CLASS.md](/docs/spec/marshal/06-CLASS/) |
| **OpaqueValue** | 无 metatable 的临时 lightuserdata（`ref`/`in`/`out` 或显式标注） | [spec/marshal/04-OPAQUE.md](/docs/spec/marshal/04-OPAQUE/) |
| **StructHandle** | struct 在 C#→Lua 默认路径上的 opaque lightuserdata（同步调用链内有效） | 同上 + struct 分册 |
| **ReducedType** | Il2Cpp 桥接按简化签名复用 stub 的键；Mono 不做此复用 | `impl/codegen/` |
| **`ConversionKind`** | 重载分派用的 C# 隐式转换类别 | [spec/04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §3.6 |

## Registry 与生命周期

| 术语 | 含义 | 实现落点 |
|------|------|----------|
| **ObjectRegistry** | ByObj userdata 槽位 + `(identity, view)` 弱缓存 + GC root | [spec/10-LIFETIME.md](/docs/spec/10-LIFETIME/) |
| **StructRegistry** | non-blittable struct userdata 拷贝与 GC 扫描（Il2Cpp：`NotBlittableStructRegistry`） | 同上 |
| **OpaqueParameterScope** | C# 调 Lua 期间 opaque handle 的 generation 域 | OpaqueValueMarshal |
| **单 `lua_State`** | 宿主默认单主状态；跨线程须遵循帧泵 / 同步规则 | §10 §4 |

## 宿主 API

| 术语 | 含义 | 实现落点 |
|------|------|----------|
| **`GetFunction<T>`** | C#→Lua 正式入口；返回 `MulticastDelegate`；调用方负责缓存 | [spec/01-HOST-API.md](/docs/spec/01-HOST-API/) |
| **`[LuaMarshalAs]`** | 参数 / 返回值 / 字段 / 属性的 Marshal 标注 | [spec/marshal/02-MARSHAL-AS.md](/docs/spec/marshal/02-MARSHAL-AS/) |
| **`[LuaAlias]`** | 为方法追加最终 Lua 名；可与默认名/其它别名重复，按名分组进 overload | [spec/04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §5 |
| **Delegate 桥** | C#→Lua 调用路径：`GetFunction` 绑定 function 为 closed delegate 后 `Invoke` | [spec/marshal/09-FUNCTION.md](/docs/spec/marshal/09-FUNCTION/) |

## 明确不支持（rewrite 规则）

| 术语 | 含义 |
|------|------|
| **Event 专用元表** | **无** `{ get, set, fire }` 子表；使用 `add_EventName` / `remove_EventName` 普通方法 |
| **运行时继承 promotion** | 实例成员 **不在** `__index` miss 时沿链查找并缓存；改为 Bind 期扁平化 |

## 文档缩写

| 缩写 | 路径 |
|------|------|
| SPEC | `Docs/spec/**` |
| IMPL | `Docs/impl/**` |
| MT | `Docs/spec/metatable/**` |
| MAR | `Docs/spec/marshal/**` |

