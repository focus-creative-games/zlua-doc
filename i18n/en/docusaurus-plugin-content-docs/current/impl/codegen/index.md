---
sidebar_position: 2
title: "Codegen / Emit"
---

# Codegen / Emit

This directory covers **build-time** Il2Cpp stub generation and **runtime** Mono Expression Emit. It does not repeat Lua semantics from [../../spec/](/docs/spec/00-OVERVIEW/). **C#→Lua uses `GetFunction`; there is no IL rewrite or dedicated stub.**

| File | Backend | Contents |
|------|---------|----------|
| [STUBS-IL2CPP.md](/docs/impl/codegen/STUBS-IL2CPP/) | Il2Cpp Player | `generated/*Stub*`, ReducedType signature reuse, `BuiltinScripts.inc` |
| [EMIT-MONO.md](/docs/impl/codegen/EMIT-MONO/) | Mono Editor | Per-member `Expression.Compile`; cannot Emit → explicit bind-time failure |

## Generator entry

- **Il2Cpp C++:** `Packages/com.code-philosophy.zlua/Editor/CppCodeGen/CodeGenerator.cs` → output to `build-win64/.../zlua/generated/`

## Comparison summary

| Direction | Il2Cpp | Mono |
|-----------|--------|------|
| Lua→C# | Method/Property/Delegate **stub tables** | **Emit/** specialized bridges |
| C#→Lua | `GetFunction` + Delegate bridge (`LuaCallInvoker` / `InvokeFromRegistry`) | Same |

Parent index: [../IL2CPP.md](/docs/impl/IL2CPP/), [../MONO.md](/docs/impl/MONO/)
