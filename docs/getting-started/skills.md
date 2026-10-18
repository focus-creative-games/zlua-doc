---
sidebar_position: 4
title: AI Skills
description: 包内给 AI 编程助手用的技能说明，以及如何接到所用助手上。
---

# AI Skills

ZLua 在包内附带一组 **Agent Skills**。它们是给 AI 编程助手读的 Markdown，**不是** Lua / C# 运行时 API，也不会改变 Play 或 Player 的行为。

源码目录：[ZLua~/skills](https://github.com/focus-creative-games/zlua/tree/main/ZLua~/skills)。装进工程后的路径是：

```text
Packages/com.code-philosophy.zlua/ZLua~/skills/<技能名>/SKILL.md
```

目录名以 `~` 结尾，Unity **不会**把这里的 Markdown 当资源导入。不要把这些文件挪到普通的 `Assets/` 或 `Packages/.../` 子目录（没有 `~` 的那种），否则 Unity 会导入它们。

每份技能是一个目录加一份 `SKILL.md`。文首的 `description` 告诉助手**什么时候该读它**。助手按当前任务自行选用，例如安装失败会落到 `zlua-setup`，`ref` / `out` 会落到 `zlua-in-ref-out`。

## 如何使用

助手**不会**自己去扫 `ZLua~/skills`。先看所用助手的说明，找到它读取 skill 的目录（有的在工程里，有的在用户目录，有的可以额外加一条搜索路径）。每个技能都是「目录 + `SKILL.md`」。

两种接法，用其中一种即可：

1. **加搜索路径。** 助手允许配置 skill 根目录时，把 `Packages/com.code-philosophy.zlua/ZLua~/skills` 加进去。这个目录下面已经是一个技能一个子目录。
2. **复制或联接。** 把每个技能目录放进助手的 skill 根目录，使 `<skill 根>/<技能名>/SKILL.md` 能被找到。

包在稳定路径（`Packages/com.code-philosophy.zlua`，或 manifest 里的 `file:` 本地包）时，用目录联接，升级包后不用再拷。在**工程根**把 `SKILLS` 换成助手的 skill 根目录后执行：

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

Git URL 安装时，Unity 把包放在 `Library/PackageCache/com.code-philosophy.zlua@<版本>/`，这个目录名会随升级变化。那种情况请把技能目录**复制**到助手的 skill 根目录，升级 ZLua 后再复制一次。不要把联接指到 PackageCache。

接好后新开一次助手对话。直接写 ZLua 相关的安装、互调或 Marshal 问题即可；也可以点名技能，例如「按 zlua-setup 检查 Install」。

技能和人工文档的对照表见 [使用指南 · AI Skills](/docs/guides/skills/)。

## 技能一览

| 技能 | 何时用 |
|------|--------|
| `zlua-setup` | 加包、改 `luaVersionId`、Install / Generate、Editor 与 Player 脚本路径 |
| `zlua-lua-call-csharp` | Lua 经 `CSharp` 访问类型、构造、字段、方法、事件 |
| `zlua-csharp-call-lua` | `Initialize`、`GetFunction`、`Reset` |
| `zlua-method-overload` | 同名重载、全签名键 |
| `zlua-default-arguments` | 省略 C# 可选参数 |
| `zlua-generic-method` | `make_generic_type`、`inflate`、GTAP |
| `zlua-params` | `params T[]` |
| `zlua-array` | `T[]`、多维数组、`to_table` / `to_bytes` |
| `zlua-delegate` | `Action` / `Func`、`to_delegate`、`add_` / `remove_` |
| `zlua-in-ref-out` | `ref` / `in` / `out` |
| `zlua-marshal` | 默认 Marshal（基元、string、enum、struct、class） |
| `zlua-marshal-as` | `[LuaMarshalAs]` 与 MarshalAs XML |
| `zlua-alias` | `[LuaAlias]` |
| `zlua-extension` | `[LuaExtension]` |
| `zlua-lib` | 全局 `zlua` 表 |

## 下一步

- [使用指南 · AI Skills](/docs/guides/skills/)
- [安装与集成](/docs/getting-started/installation/)
- [5 分钟快速开始](/docs/getting-started/quick-start/)
