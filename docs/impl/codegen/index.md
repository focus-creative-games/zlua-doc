---
sidebar_position: 2
title: "Codegen / Emit"
---

# Codegen / Emit

本目录描述 **构建期** Il2Cpp stub 生成与 **运行时** Mono Expression Emit。不重复 [../../spec/](/docs/spec/00-OVERVIEW/) 中的 Lua 语义。**C#→Lua 使用 `GetFunction`，无 IL 改写或专用 stub。**

| 文件 | 后端 | 内容 |
|------|------|------|
| [STUBS-IL2CPP.md](/docs/impl/codegen/STUBS-IL2CPP/) | Il2Cpp Player | `generated/*Stub*`、ReducedType 签名复用、`BuiltinScripts.inc` |
| [EMIT-MONO.md](/docs/impl/codegen/EMIT-MONO/) | Mono Editor | 每成员 `Expression.Compile`；无法 Emit → 绑定期显式失败 |

## 生成器入口

- **Il2Cpp C++：** `Packages/com.code-philosophy.zlua/Editor/CppCodeGen/CodeGenerator.cs` → 输出至 `build-win64/.../zlua/generated/`

## 对照摘要

| 方向 | Il2Cpp | Mono |
|------|--------|------|
| Lua→C# | Method/Property/Delegate **stub 表** | **Emit/** 特化桥 |
| C#→Lua | `GetFunction` + Delegate 桥（`LuaCallInvoker` / `InvokeFromRegistry`） | 同左 |

上级索引：[../IL2CPP.md](/docs/impl/IL2CPP/)、[../MONO.md](/docs/impl/MONO/)
