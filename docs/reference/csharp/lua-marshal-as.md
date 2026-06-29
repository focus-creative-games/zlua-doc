---
sidebar_position: 3
title: LuaMarshalAs
description: "[LuaMarshalAs] 属性与 LuaMarshalType 枚举。"
---

# LuaMarshalAs

标注在参数、返回值、方法或字段上，覆盖默认编组规则。

```csharp
public void Foo([LuaMarshalAs(LuaMarshalType.LuaString)] int value) { }
```

## 详见

- [编组规范](../../spec/marshal/)
- [编组速查表](../marshal-cheatsheet)

:::info 文档建设中
完整 `LuaMarshalType` 合法集合表将在 v1.0 marshal 功能稳定后补充。
:::
