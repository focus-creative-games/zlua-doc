---
sidebar_position: 8
title: Lua 模块加载
description: LuaLoader 与模块 return 表约定。
---

# Lua 模块加载

## LuaLoader

`LuaAppDomain.Initialize(loader)` 接受模块名，返回 Lua 源码字符串：

```csharp
private static string LoadLuaModule(string module)
{
    string path = Path.Combine(
        Application.streamingAssetsPath, "LuaScripts", module + ".lua.txt");
    return File.Exists(path) ? File.ReadAllText(path, Encoding.UTF8) : null;
}
```

## 模块约定

每个 Lua 文件应 `return` 一个表，表中的函数可被 `[LuaInvoke]` 引用：

```lua
local function main() end
local function add(a, b) return a + b end

return { main = main, add = add }
```

## 下一步

- [C# 调用 Lua](./csharp-to-lua)
