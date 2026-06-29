---
sidebar_position: 4
title: 编组速查表
description: C# 类型默认编组规则速查。
---

# 编组速查表

以下为未标注 `[LuaMarshalAs]` 时的默认编组规则摘要。完整说明见 [编组规范](../spec/marshal/)。

| C# 类型 | C# → Lua | Lua → C# |
|---------|----------|----------|
| `bool` | boolean | boolean |
| 整数类型 | integer / number | integer / number |
| `float` / `double` | number | number |
| `string` | string | string |
| `char` | integer (码点) | integer |
| class | userdata | userdata / nil |
| struct | userdata | userdata |
| enum | 见类型系统规范 | 见类型系统规范 |
| delegate | function / userdata | function |

:::tip
完整表格含 `IntPtr`、数组、泛型等条目，请参阅 [编组规范 §1](../spec/marshal/#1-默认-marshal-规则总览)。
:::
