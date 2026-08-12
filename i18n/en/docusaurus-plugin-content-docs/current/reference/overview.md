---
sidebar_position: 1
title: API Overview
description: Index of ZLua C# attributes and Lua APIs.
---

# API Overview

Programmer lookup entry: C# attributes, runtime APIs, Lua `CSharp` / `zlua` standard library, and Marshal rules.

## C# Attributes

| Attribute | Description | Docs |
|-----------|-------------|------|
| `GetFunction<T>` | Call a Lua function from C# | [LuaAppDomain](/docs/reference/csharp/lua-app-domain/) |
| `[MonoLuaCallback]` | Native `int (IntPtr L)` callback | [MonoLuaCallback](/docs/reference/csharp/lua-callback/) |
| `[LuaMarshalAs]` | Override default Marshal | [LuaMarshalAs](/docs/reference/csharp/lua-marshal-as/) |
| `[LuaAlias]` | Lua alias for method overloads | [LuaAlias](/docs/reference/csharp/lua-alias/) |

## C# Runtime API

| Type | Description | Docs |
|------|-------------|------|
| `LuaAppDomain` | **Public** initialization entry | [LuaAppDomain](/docs/reference/csharp/lua-app-domain/) |
| `LuaEnv` | Underlying `lua_State` (backend-internal; usually not used directly) | — |

## Lua API

| Module | Description | Docs |
|--------|-------------|------|
| `CSharp` | Lazy-load root table for assemblies / types | [CSharp root table](/docs/reference/lua/csharp-root/) |
| `zlua` | Type construction, overloads, ref, arrays, delegate | [zlua standard library](/docs/reference/lua/zlua-lib/) |
| `zlua.types` | corlib type constants | [zlua.types](/docs/reference/lua/zlua-types/) |

## Marshal

| Resource | Description |
|----------|-------------|
| [Marshal cheatsheet](/docs/reference/marshal-cheatsheet/) | Default rules + `[LuaMarshalAs]` summary |
| [Marshal spec](/docs/spec/marshal/) | Authoritative full rules |

## Guides Index

| Topic | Docs |
|-------|------|
| Install / interop / build / debug | [install](/docs/guides/install/) · [hello-interop](/docs/guides/hello-interop/) · [build](/docs/guides/build/) · [debugger](/docs/guides/debugger/) |
| Lua → C# | [lua-calling-csharp](/docs/guides/lua-calling-csharp/) |
| C# → Lua | [csharp-calling-lua](/docs/guides/csharp-calling-lua/) |
| Value types | [value-types](/docs/guides/value-types/) |
| Function | [functions](/docs/guides/functions/) |
| Arrays / generics | [arrays](/docs/guides/arrays/) · [generics](/docs/guides/generics/) |
| ref / MarshalAs / 0GC | [ref-out-in](/docs/guides/ref-out-in/) · [lua-marshal-as](/docs/guides/lua-marshal-as/) · [zero-gc-marshal](/docs/guides/zero-gc-marshal/) |
| Overloads / LuaAlias / Extension | [overloads](/docs/guides/overloads/) · [lua-alias](/docs/guides/lua-alias/) · [extension-methods](/docs/guides/extension-methods/) |
| zlua library / third-party native plugins | [zlua-lib](/docs/guides/zlua-lib/) · [native-modules](/docs/guides/native-modules/) |
| Migration | [migration](/docs/guides/migration/) |

## Authoritative Spec

Full API semantics follow the [spec docs](/docs/spec/00-OVERVIEW/); this section is a **lookup summary**. Spec wins when details change.
