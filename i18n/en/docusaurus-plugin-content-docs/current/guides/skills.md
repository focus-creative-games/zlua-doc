---
sidebar_position: 1.4
title: AI Skills
description: Point a coding agent at the package Agent Skills, and see which guide each skill follows.
---

# AI Skills

[ZLua~/skills](https://github.com/focus-creative-games/zlua/tree/main/ZLua~/skills) in the package is a set of notes for AI coding agents. It is **not** a runtime API. Unity skips the folder because the name ends with `~`. Do not move the files into an `Assets/` or `Packages/` folder that has no `~`.

After install:

```text
Packages/com.code-philosophy.zlua/ZLua~/skills/<skill-name>/SKILL.md
```

Each skill is one directory. The `description` at the top of `SKILL.md` decides when the agent reads the body. The agent then writes code in that style. For people, this guide set and the [spec](/docs/spec/00-OVERVIEW/) stay the contract.

## How to use them

Agents do not scan `ZLua~/skills` inside the package. Use that agent's docs to find its skills root, or a search path it lets you add. Each skill is a directory plus `SKILL.md`.

Either of these is enough:

1. **Add a search path.** Point the agent at `Packages/com.code-philosophy.zlua/ZLua~/skills`. That folder already has one subdirectory per skill.
2. **Copy or link.** Place `<skills-root>/<skill-name>/SKILL.md` where the agent reads skills.

When the package path is stable (`Packages/com.code-philosophy.zlua`, or a `file:` local package), set `SKILLS` to the agent's skills root and link from the project root. Upgrades keep pointing at the package files:

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

A Git URL install stores the package in `Library/PackageCache/com.code-philosophy.zlua@<version>/`. That cache folder name changes, so **copy** the skill directories into the agent's skills root and copy them again after a ZLua upgrade. Do not link into PackageCache.

Open a new chat afterwards. Ask in plain language, or name a skill, for example "change this call using zlua-params".

## Skills and guides

| Skill | The agent uses it for | Guide |
|-------|------------------------|-------|
| `zlua-setup` | UPM, `luaVersionId`, Install, Generate, script paths, HybridCLR order | [Install and Lua versions](/docs/guides/install/), [Editor vs Player](/docs/guides/editor-vs-player/) |
| `zlua-lua-call-csharp` | `CSharp` root, construction, members, events | [Lua calling C#](/docs/guides/lua-calling-csharp/) |
| `zlua-csharp-call-lua` | `Initialize`, `GetFunction`, `Reset` | [C# calling Lua](/docs/guides/csharp-calling-lua/) |
| `zlua-method-overload` | Short-name dispatch, full-signature keys, when to alias | [Method overloads](/docs/guides/overloads/) |
| `zlua-default-arguments` | Trailing optional parameters and defaults | [Method calls](/docs/getting-started/method-calls/) |
| `zlua-generic-method` | Closing generic types and generic methods | [Generics](/docs/guides/generics/) |
| `zlua-params` | Expanding `params T[]` or passing one array | [params](/docs/guides/params/) |
| `zlua-array` | One-dimensional and multidimensional arrays, `to_table`, `to_bytes` | [Arrays](/docs/guides/arrays/) |
| `zlua-delegate` | `Action` / `Func`, `to_delegate`, event subscription | [Function](/docs/guides/functions/) |
| `zlua-in-ref-out` | `ref` / `in` write-back, `out` as extra results | [ref / in / out](/docs/guides/ref-out-in/) |
| `zlua-marshal` | Default value shapes | [Value types](/docs/guides/value-types/), [0GC Marshal](/docs/guides/zero-gc-marshal/) |
| `zlua-marshal-as` | `[LuaMarshalAs]` and XML | [LuaMarshalAs](/docs/guides/lua-marshal-as/) |
| `zlua-alias` | `[LuaAlias]` and XML | [LuaAlias](/docs/guides/lua-alias/) |
| `zlua-extension` | `[LuaExtension]` and XML | [Extension methods](/docs/guides/extension-methods/) |
| `zlua-lib` | `typeof`, `inflate`, `box` / `unbox` / `cast`, opaque, array factories | [Common zlua library](/docs/guides/zlua-lib/) |

## Learning path

| | |
|---|---|
| **Previous** | [Settings](/docs/guides/settings/) |
| **Next** | [Hello interop](/docs/guides/hello-interop/) |

## Related

- [Getting started · AI Skills](/docs/getting-started/skills/)
- [Install and Lua versions](/docs/guides/install/)
