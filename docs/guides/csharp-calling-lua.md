---
sidebar_position: 5
title: C# 调用 Lua
description: GetFunction、模块 return 约定、Editor/Player 加载路径。
---

# C# 调用 Lua

用 **`LuaAppDomain.GetFunction<T>`** 按模块名与方法名取得绑定好的 Delegate，再调用。Editor 与 Player **API 相同**。

Canonical：[Bootstrap.cs](https://github.com/focus-creative-games/zlua-demo/blob/main/Assets/Bootstrap.cs)

## 基本用法

```csharp
var main = LuaAppDomain.GetFunction<Action>("app", "main");
main();

var add = LuaAppDomain.GetFunction<Func<int, int, int>>("app", "add");
int sum = add(10, 20);
```

```lua
local function add(a, b)
    return a + b
end

return {
    main = main,
    add = add,
}
```

| 规则 | 说明 |
|------|------|
| 先 `Initialize` | 否则抛异常 |
| `T : MulticastDelegate` | 具体 `Action` / `Func` / 自定义委托 |
| module / method | `"app","add"` ↔ `return { add = ... }` |
| 缓存 | 热路径自行保存；不保证同实例 |
| 时机 | 须在 `Initialize` **之后**；勿放在与 `RuntimeInitializeOnLoadMethod` 同类型的 static 字段初始化器 |

## 模块加载

`GetFunction("app", …)` 要求 `LoadLuaModule("app")` 能返回源码。

| 环境 | 典型路径 |
|------|----------|
| Editor | `{ProjectRoot}/LuaScripts/app.lua` |
| Player | `StreamingAssets/LuaScripts/app.lua.txt` |

```csharp
private static string LoadLuaModule(string module)
{
#if UNITY_EDITOR
    string path = Path.Combine(Application.dataPath, "..", "LuaScripts", module + ".lua");
#else
    string path = Path.Combine(
        Application.streamingAssetsPath, "LuaScripts", module + ".lua.txt");
#endif
    return File.Exists(path) ? File.ReadAllText(path, Encoding.UTF8) : null;
}
```

要点：

- 模块须 **`return { key = fn }`**；键名 = GetFunction 的 method  
- 子路径：`module.Replace('.', '/')`（如 `battle.ai`）  
- Player 构建前 Sync，见 [构建流程](/docs/guides/build/)  
- 热更扩展点 = 替换 loader 委托；Android 上 StreamingAssets 只读需注意  

### 多模块

```csharp
var appMain = LuaAppDomain.GetFunction<Action>("app", "main");
var battleTick = LuaAppDomain.GetFunction<Action<float>>("battle", "tick");
```

## 与「形参里的 function」对照

| 场景 | 做法 |
|------|------|
| C# **主动**调某个 Lua 导出函数 | `GetFunction<T>(module, method)` |
| C# 形参是 `Action`/`Func`，Lua 传入 `function` | **隐式** marshal，见 [Function](/docs/guides/functions/) |
| Lua 侧已有 function，要指定委托类型 | `zlua.to_delegate` |

## 常见错误

| 现象 | 处理 |
|------|------|
| `module 'app' not found` | Editor/Player 路径；是否 Sync |
| GetFunction 结果无效 / 调用无效果 | 未 Initialize；return 表键名不一致 |
| 旧脚本仍在跑 | Player 未重新 Sync |











## 学习路径

| | |
|---|---|
| **上一篇** | [Lua 调用 C#](/docs/guides/lua-calling-csharp/) |
| **下一篇** | [值类型](/docs/guides/value-types/) |

## 相关文档

- [宿主 API](/docs/spec/01-HOST-API/)  
- [LuaAppDomain 参考](/docs/reference/csharp/lua-app-domain/)  
- [Function 与 Delegate](/docs/guides/functions/)  
- [构建流程](/docs/guides/build/)
