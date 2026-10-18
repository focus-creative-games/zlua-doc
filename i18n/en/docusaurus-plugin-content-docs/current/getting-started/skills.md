---
sidebar_position: 4
title: AI Skills
description: Skill notes shipped for AI coding agents, and how to point the agent you use at them.
---

# AI Skills

ZLua ships a set of **Agent Skills** inside the package. They are Markdown for an AI coding agent. They are **not** a Lua or C# runtime API, and they do not change Play or Player behavior.

Sources: [ZLua~/skills](https://github.com/focus-creative-games/zlua/tree/main/ZLua~/skills). After the package is in the project:

```text
Packages/com.code-philosophy.zlua/ZLua~/skills/<skill-name>/SKILL.md
```

The `~` in the folder name keeps Unity from importing this Markdown as assets. Do not move the files into a normal `Assets/` or `Packages/.../` folder that has no `~`, or Unity will import them.

Each skill is a directory with one `SKILL.md`. The opening `description` tells the agent **when to read it**. The agent picks a skill from the task: a failed Install lands on `zlua-setup`; `ref` / `out` lands on `zlua-in-ref-out`.

## How to use them

Agents do **not** scan `ZLua~/skills` on their own. Read that agent's docs for the directory it loads skills from (some keep it in the project, some under the user home, some accept an extra search path). Each skill is a directory plus `SKILL.md`.

Either of these is enough:

1. **Add a search path.** If the agent lets you configure a skills root, add `Packages/com.code-philosophy.zlua/ZLua~/skills`. That folder already has one subdirectory per skill.
2. **Copy or link.** Put each skill directory under the agent's skills root so `<skills-root>/<skill-name>/SKILL.md` is visible.

When the package path is stable (`Packages/com.code-philosophy.zlua`, or a `file:` local package), a directory link stays valid across upgrades. From the **project root**, set `SKILLS` to the agent's skills root, then run:

```bat
set "SKILLS=path to the agent's skills root"
if not exist "%SKILLS%" mkdir "%SKILLS%"
for /d %d in ("Packages\com.code-philosophy.zlua\ZLua~\skills\*") do if not exist "%SKILLS%\%~nxd" mklink /J "%SKILLS%\%~nxd" "%~fd"
```

```bash
SKILLS="path to the agent's skills root"
mkdir -p "$SKILLS"
for d in Packages/com.code-philosophy.zlua/ZLua~/skills/*/; do
  name=$(basename "$d")
  ln -sfn "$(cd "$d" && pwd)" "$SKILLS/$name"
done
```

A Git URL install puts the package under `Library/PackageCache/com.code-philosophy.zlua@<version>/`. That folder name changes on upgrade. **Copy** the skill directories into the agent's skills root and copy them again after upgrading ZLua. Do not link into PackageCache.

Start a new agent chat after the folders are in place. Ask a normal ZLua question about install, interop, or Marshal, or name a skill, for example "check Install using zlua-setup".

The map from skills to the written guides is on [Guides · AI Skills](/docs/guides/skills/).

## Skill list

| Skill | Use when |
|-------|----------|
| `zlua-setup` | Adding the package, changing `luaVersionId`, Install / Generate, Editor vs Player script paths |
| `zlua-lua-call-csharp` | Lua reaches types, constructors, fields, methods, and events through `CSharp` |
| `zlua-csharp-call-lua` | `Initialize`, `GetFunction`, `Reset` |
| `zlua-method-overload` | Same-name overloads, full-signature keys |
| `zlua-default-arguments` | Omitting C# optional parameters |
| `zlua-generic-method` | `make_generic_type`, `inflate`, GTAP |
| `zlua-params` | `params T[]` |
| `zlua-array` | `T[]`, multidimensional arrays, `to_table` / `to_bytes` |
| `zlua-delegate` | `Action` / `Func`, `to_delegate`, `add_` / `remove_` |
| `zlua-in-ref-out` | `ref` / `in` / `out` |
| `zlua-marshal` | Default marshal (primitives, string, enum, struct, class) |
| `zlua-marshal-as` | `[LuaMarshalAs]` and MarshalAs XML |
| `zlua-alias` | `[LuaAlias]` |
| `zlua-extension` | `[LuaExtension]` |
| `zlua-lib` | The global `zlua` table |

## Next steps

- [Guides · AI Skills](/docs/guides/skills/)
- [Installation](/docs/getting-started/installation/)
- [Quick start](/docs/getting-started/quick-start/)
