---
sidebar_position: 1
title: LuaInvoke
description: "[LuaInvoke(module, method)] 属性说明。"
---

# LuaInvoke

```csharp
[LuaInvoke("moduleName", "methodName")]
private static extern ReturnType MethodName(ParamTypes...);
```

## 参数

| 参数 | 说明 |
|------|------|
| moduleName | Lua 模块名（LoadLuaModule 的文件名） |
| methodName | 模块 return 表中的函数名 |

## 约束

- 必须为 `static extern`
- 不可为泛型类成员或泛型函数本身

## 详见

- [C# 调用 Lua 指南](../../guides/csharp-to-lua)
- [设计规范](../../spec/design-spec)
