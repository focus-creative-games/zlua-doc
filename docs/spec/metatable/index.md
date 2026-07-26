---
sidebar_position: 22
title: "元表规范（`spec/metatable/`）"
---

# 元表规范（`spec/metatable/`）

本目录规定 ZLua 在 Lua 侧可见的 **类型表、静态元表（SMT）、实例元表（IMT）** 布局，以及 **`__index` / `__newindex`** 成员分派语义。内容为 **规范性** 描述：Mono 与 Il2Cpp 运行时须表现一致；具体实现（Mono 三表 Lua indexer、Il2Cpp native `Dispatch*` 等）见 `impl/metatable/`。

## 文档索引

| 文件 | 内容 |
|------|------|
| [01-LAYOUT.md](/docs/spec/metatable/01-LAYOUT/) | SMT / IMT、ByVal·ByObj 双实例元表、类型表键（`LuaConsts.h`） |
| [02-INDEX.md](/docs/spec/metatable/02-INDEX/) | `__index` / `__newindex` 算法、三表职责、miss 语义 |
| [03-BINDING.md](/docs/spec/metatable/03-BINDING/) | public 可见性、Bind 期继承扁平化、成员归类 |
| [04-SPECIAL-TYPES.md](/docs/spec/metatable/04-SPECIAL-TYPES/) | enum、Nullable、struct、array、delegate 特例 |

## 与其它规范的边界

- 类型命名、`CSharp` 路径、泛型/数组类型入口 → [../02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/)
- C# ↔ Lua 值形态与 Push/Pop → [../marshal/](/docs/spec/marshal/)
- 方法重载 dispatch、`register_method` → [../04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/)
- **Event：无专用元表子表**；脚本使用 `add_EventName` / `remove_EventName` 普通方法（见 [03-BINDING.md](/docs/spec/metatable/03-BINDING/)）

## 核心语义（速览）

- 静/实例各一套 **三表**（method / fieldGetter / fieldSetter），由 indexer 闭包持有。
- **`__index` miss → `nil`**；**`__newindex` miss → error`**；无 C# 反射 fallback。
- 继承在 **EnsureBinding** 期 **扁平写入** 三表，运行时不上链查找。
- struct 同时提供 **`__byval_instance_mt`** 与 **`__byobj_instance_mt`**；引用类型仅 ByObj。
