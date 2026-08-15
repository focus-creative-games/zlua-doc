---
sidebar_position: 7
title: "MethodOverloadResolver Implementation"
---

# MethodOverloadResolver Implementation

> **Il2Cpp:** `marshal/MethodOverloadResolver.cpp`
> **Mono:** Phase 3 `Emit/` + planned managed resolver (semantics aligned)
> **Normative authority:** [../../spec/04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) — this doc only covers runtime data structures and C++ landing points

## 1. Call chain

1. Lua calls a **dispatch closure** (not a direct method closure).
2. Dispatch closure upvalue carries `MethodGroups*` (`MetaBinding::CreateMethodDispatchClosureRef`).
3. `MethodOverloadResolver::Resolve(L, groups, argStart, argCount)` returns a unique `MethodMarshalCtx*` or errors.
4. `MethodBridge::InvokeLua2Cs(L, target, argStart, ctx)` runs the selected overload.

Direct closures (single overload) do **not** go through the Resolver.

## 2. `MethodGroups` bucket structure

Defined in `MarshalDefs.h`:

```cpp
constexpr size_t kMaxSmallArgCount = 4;

struct MethodGroup {
    const MethodMarshalCtx** methods;
    size_t methodCount;
};

struct MethodGroups {
    const MethodGroup* smallArgCountMethodGroups[kMaxSmallArgCount + 1];
    const MethodMarshalCtx** largeArgCountMethods;
    size_t largeArgCountMethodCount;
};
```

**Bind-time bucketing:** Group by the method’s **Lua arg-slot range**. With no defaults the key is `luaArity`; with trailing defaults the method must cover buckets `minLuaArity … luaArity` (or equivalently sit in a set Resolve can scan) so omitted defaults still hit. Resolve first O(1)-fetches `groups->smallArgCountMethodGroups[argCount]`, then consults `largeArgCountMethods` when needed.

Order within the same argCount bucket = Codegen declaration order (spec §3.2 tie-break). Candidates must also satisfy `GetMinLuaArity(ctx) ≤ argCount ≤ ctx->luaArity`.

## 3. `ConversionKind` and Better Match

```cpp
enum class ConversionKind : uint8_t {
    None, Identity, ImplicitNumeric, ImplicitEnum, NullLiteral,
    ImplicitReference, ImplicitExtendedInteger, ImplicitBoxing,
    ImplicitArray, NotConvertible,
};

struct MethodOverloadResolutionResult {
    MethodOverloadResolutionKind kind;  // None / BestMatch / Ambiguous
    const MethodMarshalCtx* method;
};
```

`GetConversionKind(L, stackIndex, paramMeta)` (`MethodOverloadResolver.cpp`):

- Reads Lua stack type + target `Il2CppType*` from `MarshalMetaInfo`;
- Returns conversion category from that argument to the parameter;
- Matches spec §3.3 / §3.6 **better function member** rules (Identity beats ImplicitBoxing, etc.).

**Per-arg compare:** Check applicability for each candidate in the bucket; pick best among applicable; when conversion scores tie, prefer smaller `optionalUsed`, then declaration order.

## 4. `Resolve` algorithm outline

```cpp
MethodOverloadResolutionResult MethodOverloadResolver::Resolve(
    lua_State* L, const MethodGroups* groups, int32_t argStart, int32_t argCount)
{
    // 1. Fetch bucket by argCount (small / large); candidates must satisfy
    //    GetMinLuaArity(ctx) ≤ argCount ≤ ctx->luaArity (trailing C# defaults → MethodDefaultArgs)
    // 2. Walk methods[]:
    //    - Score each CLR formal; slot shortfall + ParamHasCachedDefault → optionalUsed++
    //    - NotConvertible → skip
    //    - Update best: better ConversionKind/score, or same score with smaller optionalUsed
    // 3. BestMatch → return method; Ambiguous / None → ThrowFormat upstream
}
```

Error message prefix `zlua:`, aligned with Mono goals (spec §3.5 / §7). Default-parameter semantics: [../../spec/04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/) §3.3.

## 5. Cooperation with `MethodMarshalCtx`

Each candidate overload already has its own `MethodMarshalCtx` at bind time (`paramsMeta[]`, `retMeta`, `lua2CsInvoker` stub; with trailing defaults, also a `MethodDefaultArgs*`).

Resolver **only selects** ctx; it does not re-marshal. After selection:

```cpp
MethodBridge::InvokeLua2Cs(L, target, argStart, ctx);
```

With default parameters, the Invoke path writes Bind-cached default slots for missing trailing formals.

Virtual calls: `MetadataUtil::ResolveInvokeMethod(ctx->method, target, ctx->sealed)` inside `InvokeLua2Cs`.

## 6. Constructor overload

Type `SMT.__call` uses the same `MethodGroups` / Resolver mechanism; ctx comes from `.ctor` overload set (`TypeBinding::ctorGroups`); argStart skips type-table `this` (static construction has no this).

Mono Phase 3: `ConstructorEmitter` replaced `ConstructorNotReady`; currently **first-wins by arity**; full better-member Resolver still pending.

## 7. Full-signature keys, aliases, `register_method`, and Resolver

Spec:

| Source | Name-collision policy |
|--------|----------------------|
| Bind-time default name + `[LuaAlias]` | **Allowed**; aggregate into `MethodGroups` by final name |
| Multiple bind-time candidates with same name | Default name → dispatch; **each candidate** also gets full-signature key `Name(Types…)` → direct |
| Runtime `register_method` | **Forbidden** to occupy existing method / overload / full-signature key names; only empty slots get direct (short name + colon) |

| Mechanism | Implementation landing |
|-----------|------------------------|
| Single candidate → direct closure | `MetaBinding::CreateDirectMethodClosureRef` |
| Multi candidate → dispatch | `CreateMethodDispatchClosureRef` → Resolver |
| Full-signature keys | Bind-time write one direct key per candidate |
| `[LuaAlias]` | Bind-time merge into `MethodGroups` for that final name |
| `register_method` | Name exists → error; else write method map / index table (direct closure) |

Alias keys are O(1) direct only when that final name has **exactly one** candidate; bind-time collisions go through Resolver. Full-signature keys are always direct for their candidate.

## 8. Known limits (code status)

| Item | Status |
|------|--------|
| `byref` parameters | `FIXME: handle byref` in `GetConversionKind`; currently only lightuserdata Identity |
| Static generic methods | `InvokeMethodDirectGeneric` → explicit error |
| `[LuaMarshalAs(ParamsTable)]` | (Removed; `params` is single-slot same as szarray) |

When implementing or fixing, update spec tests and Mono Emit in sync.

## 9. Mono alignment plan

Phase 3 Emit will generate for multi-overload methods:

1. dispatch Lua/C# closure (captures `MethodGroups`-equivalent structure);
2. managed `MethodOverloadResolver.Resolve` (mirror `ConversionKind` enum and compare rules);
3. Jump to **that overload's dedicated** Emit bridge (not `Method.Invoke`).

Acceptance: same Lua call selects the same overload as Il2Cpp (including tie-break).

## 10. Related files

| File | Responsibility |
|------|----------------|
| `marshal/MethodOverloadResolver.cpp/.h` | Resolve, GetConversionKind |
| `marshal/MarshalDefs.h` | MethodGroups, ConversionKind |
| `mt/MetaBinding.cpp` | Build groups, dispatch closure |
| `bridge/MethodBridge.cpp` | InvokeLua2Cs |
| `Editor/CppCodeGen/AotMethodAnalyzer.cs` | Build-time overload metadata order |

Spec details: [../../spec/04-METHOD-OVERLOAD.md](/docs/spec/04-METHOD-OVERLOAD/)
