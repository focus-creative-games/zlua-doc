---
sidebar_position: 2
title: "Codegen / Weaver / Emit"
---

# Codegen / Weaver / Emit

本目录描述 **构建期** Il2Cpp stub 生成、**Editor** LuaInvoke IL 改写、**运行时** Mono Expression Emit。不重复 [../../spec/](../../spec/00-OVERVIEW) 中的 Lua 语义。

| 文件 | 后端 | 内容 |
|------|------|------|
| [STUBS-IL2CPP.md](./STUBS-IL2CPP) | Il2Cpp Player | `generated/*Stub*`、ReducedType 签名复用、`BuiltinScripts.inc` |
| [WEAVER.md](./WEAVER) | Editor + Player | `[LuaInvoke]` ILPostProcessor；typed `LuaInvokeBridge`；**无 `object[]` legacy（Phase 4 删除）** |
| [EMIT-MONO.md](./EMIT-MONO) | Mono Editor | 每成员 `Expression.Compile`；无法 Emit → 绑定期显式失败 |

## 生成器入口

- **Il2Cpp C++：** `Packages/com.code-philosophy.zlua/Editor/CppCodeGen/CodeGenerator.cs` → 输出至 `build-win64/.../zlua/generated/`
- **C# IL：** `Packages/com.code-philosophy.zlua/Editor/CodeGen/LuaInvokeILPostProcessor.cs`

## 对照摘要

| 方向 | Il2Cpp | Mono |
|------|--------|------|
| Lua→C# | Method/Property/Delegate **stub 表** | **Emit/** 特化桥 |
| C#→Lua | LuaInvokeStub + InternalCall | Weaver → **LuaInvokeBridge** catalog |

上级索引：[../IL2CPP.md](../IL2CPP)、[../MONO.md](../MONO)
