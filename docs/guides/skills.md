---
sidebar_position: 1.4
title: AI Skills
description: 把包内 Agent Skills 接到编程助手，并对照到本指南各篇。
---

# AI Skills

包内的 [ZLua~/skills](https://github.com/focus-creative-games/zlua/tree/main/ZLua~/skills) 是给 AI 编程助手用的技能说明，**不是**运行时 API。Unity 因为目录名以 `~` 结尾而不会导入这些 Markdown。不要把它们挪进没有 `~` 的 `Assets/` 或 `Packages/` 子目录。

装进工程后的路径：

```text
Packages/com.code-philosophy.zlua/ZLua~/skills/<技能名>/SKILL.md
```

每份技能一个目录。`SKILL.md` 开头的 `description` 决定助手在什么任务下读取正文。助手匹配到任务后会按技能里的写法生成或修改代码；人工阅读仍以本指南和 [规范](/docs/spec/00-OVERVIEW/) 为准。

## 如何使用

助手不会自动扫描包内的 `ZLua~/skills`。先按所用助手的文档找到它的 skill 根目录，或它允许追加的搜索路径。每个技能都是「目录 + `SKILL.md`」。

两种接法，用其中一种即可：

1. **加搜索路径。** 把 `Packages/com.code-philosophy.zlua/ZLua~/skills` 配进助手的 skill 搜索路径。其下已经是一个技能一个子目录。
2. **复制或联接。** 使 `<skill 根>/<技能名>/SKILL.md` 落在助手会读的位置。

包路径稳定时（`Packages/com.code-philosophy.zlua`，或 `file:` 本地包），在工程根把 `SKILLS` 换成助手的 skill 根目录后做目录联接，升级后仍然指向包内文件：

```bat
set "SKILLS=助手的 skill 根目录"
if not exist "%SKILLS%" mkdir "%SKILLS%"
for /d %d in ("Packages\com.code-philosophy.zlua\ZLua~\skills\*") do if not exist "%SKILLS%\%~nxd" mklink /J "%SKILLS%\%~nxd" "%~fd"
```

```bash
SKILLS="助手的 skill 根目录"
mkdir -p "$SKILLS"
for d in Packages/com.code-philosophy.zlua/ZLua~/skills/*/; do
  name=$(basename "$d")
  ln -sfn "$(cd "$d" && pwd)" "$SKILLS/$name"
done
```

用 Git URL 安装时，实体在 `Library/PackageCache/com.code-philosophy.zlua@<版本>/`。缓存目录名会变，请把技能目录**复制**到助手的 skill 根目录，升级 ZLua 后重新复制。不要联接到 PackageCache。

接好后新开对话。可以直接提问，也可以点名，例如「用 zlua-params 改这个调用」。

## 技能与指南

| 技能 | 助手用来处理 | 对应文档 |
|------|----------------|----------|
| `zlua-setup` | UPM、`luaVersionId`、Install、Generate、脚本路径、HybridCLR 顺序 | [安装与 Lua 版本](/docs/guides/install/)、[Editor 与 Player](/docs/guides/editor-vs-player/) |
| `zlua-lua-call-csharp` | `CSharp` 根表、构造、成员、事件 | [Lua 调用 C#](/docs/guides/lua-calling-csharp/) |
| `zlua-csharp-call-lua` | `Initialize`、`GetFunction`、`Reset` | [C# 调用 Lua](/docs/guides/csharp-calling-lua/) |
| `zlua-method-overload` | 短名分派、全签名键、何时用别名 | [方法重载](/docs/guides/overloads/) |
| `zlua-default-arguments` | 尾部可选参数与默认值 | [函数调用](/docs/getting-started/method-calls/) |
| `zlua-generic-method` | 闭合泛型类型与泛型方法 | [泛型](/docs/guides/generics/) |
| `zlua-params` | `params T[]` 展开或整段数组 | [params](/docs/guides/params/) |
| `zlua-array` | 一维 / 多维数组、`to_table`、`to_bytes` | [数组](/docs/guides/arrays/) |
| `zlua-delegate` | `Action` / `Func`、`to_delegate`、事件订阅 | [Function](/docs/guides/functions/) |
| `zlua-in-ref-out` | `ref` / `in` 写回，`out` 多返回值 | [ref / in / out](/docs/guides/ref-out-in/) |
| `zlua-marshal` | 默认值传递形态 | [值类型](/docs/guides/value-types/)、[0GC Marshal](/docs/guides/zero-gc-marshal/) |
| `zlua-marshal-as` | `[LuaMarshalAs]` 与 XML | [LuaMarshalAs](/docs/guides/lua-marshal-as/) |
| `zlua-alias` | `[LuaAlias]` 与 XML | [LuaAlias](/docs/guides/lua-alias/) |
| `zlua-extension` | `[LuaExtension]` 与 XML | [Extension 方法](/docs/guides/extension-methods/) |
| `zlua-lib` | `typeof`、`inflate`、`box` / `unbox` / `cast`、opaque、数组工厂 | [常用 zlua 库](/docs/guides/zlua-lib/) |

## 学习路径

| | |
|---|---|
| **上一篇** | [Settings](/docs/guides/settings/) |
| **下一篇** | [初始化与最小互调](/docs/guides/hello-interop/) |

## 相关文档

- [入门 · AI Skills](/docs/getting-started/skills/)
- [安装与 Lua 版本](/docs/guides/install/)
