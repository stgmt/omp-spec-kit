# Design

## Components

```text
existing src/v0.1/extension.js
  -> registerSpecEnforcement(api)
       -> api.on("tool_call", handler)
            -> exact two-name check
            -> resolveTargets(projectRoot, rawTargets)
            -> decide(resolutions)
            -> allow or bounded block reason
```

Only three small root-source modules are planned:

- `src/enforcement/register.js`: registers one handler in the existing factory and adapts current direct-mutator target inputs.
- `src/enforcement/resolve-targets.js`: performs filesystem-backed canonical containment.
- `src/enforcement/decision.js`: owns the two-name constant, decision precedence, four public codes, and bounded reason.

## Decision order

1. Read `toolName` and current mutation targets from the `tool_call` adapter.
2. If `toolName === "propose_patch" || toolName === "apply_proposed_patch"`, return ALLOW `AUTHORING_TOOL_ALLOWED` immediately.
3. For a non-allowlisted direct mutator, resolve every target.
4. If any target is `INDETERMINATE`, return BLOCK `TARGET_INDETERMINATE`.
5. Otherwise, if any target is `SPEC`, return BLOCK `RAW_SPEC_WRITE`.
6. Otherwise, return ALLOW `NON_SPEC_ALLOWED`.

There is no other state or branch.

## Containment algorithm

1. Canonicalize the project root and `<projectRoot>/.specs` once for the call.
2. Normalize both separator forms and remove `.` and `..` segments without substring matching.
3. Anchor relative inputs to the canonical project root; retain absolute inputs for canonical comparison.
4. Walk existing components with `lstat`. Resolve symbolic links and Windows reparse points with `realpath`; an unreadable or unstable component is `INDETERMINATE`.
5. For a new leaf, locate the nearest existing ancestor, resolve it, and append the normalized missing suffix.
6. Compare components using POSIX case sensitivity or Windows case-insensitivity.
7. Equality with `.specs` or a descendant component sequence is `SPEC`; `.specs2`, `x.specs`, and sibling roots are `NON_SPEC`.

The resolver does not infer safety from a tool name. The decision module does not claim filesystem truth without a resolver result.

## Block reason

Canonical form:

```text
<CODE>: direct specification write blocked for <repo-relative-target-or-unknown>. Use propose_patch, then apply_proposed_patch.
```

The formatter preserves the code and redirect when truncating to 512 UTF-8 bytes. It never renders an absolute path or raw exception.

## Decisions

### DEC-1: Use current tool_call only

The event already supports pre-execution block/reason behavior. Additional lifecycle events are unnecessary.

### DEC-2: Exact two-name exception

The public mutation surface is two names. Exact equality is simpler and testable; a near miss follows normal containment.

### DEC-3: Filesystem truth belongs to one resolver

Path safety depends on canonical filesystem state, including links, reparse points, and not-yet-created leaves. Lexical prefix checks are insufficient.

### DEC-4: Uncertainty blocks

The policy exists to prevent raw spec writes. A failed containment proof cannot safely allow the call.

### DEC-5: Reuse the existing extension factory

One registration path avoids an unreachable or divergent second entrypoint and matches the shipped build layout.

## Non-goals

- Spec validation, proposal review, compare-and-swap, commit, or rollback; the authoring MCP owns them.
- Additional public mutation operations.
- Diagnostics unrelated to one block decision.
- Persistent audit or telemetry.
- A standalone extension or parallel runtime path.
