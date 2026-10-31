# Research

## Scope

This research asks only whether the current OMP hook can block a call before execution and what filesystem work is required to decide whether a target is inside `.specs`.

## Confirmed findings

### RF-1: Current `tool_call` is sufficient

Pinned OMP v17.3.7 exposes a pre-execution `tool_call` event with the tool name and input and accepts a blocking result with a reason. The existing extension can therefore apply this policy without a host change. Source authority: installed `pi-coding-agent@17.3.7` at commit `8500092296621a6826b7136e840f8a59ea338958`, especially `src/extensibility/hooks/tool-wrapper.ts` and `src/extensibility/shared-events.ts`; the repository pin is recorded in `docs/omp-v17.3.7-contract.md`.

**Decision:** register only `tool_call` in the existing extension factory.

### RF-2: Name equality is the complete authoring exception

The requested product boundary has exactly one public mutation operation: `spec_patch`. The hook-visible name is compared by exact string equality before path resolution. Prefixes, suffixes, case changes, qualified lookalikes, and embedded names are not matches.

**Decision:** keep one single-string constant; do not add another identity or discovery mechanism.

### RF-3: Lexical matching is insufficient

Separator differences, dot segments, Windows case rules, `.specs2`, symlinks, junctions/reparse points, and new targets can make a string prefix answer wrong.

**Decision:** normalize path syntax, anchor relative paths to the canonical project root, use component boundaries, inspect existing components with `lstat` and `realpath`, handle POSIX links and Windows reparse points, and resolve a new target through its nearest existing ancestor.

### RF-4: Three outcomes are enough

For a non-allowlisted direct mutator, the only useful containment classes are `SPEC`, `NON_SPEC`, and `INDETERMINATE`. These yield one of two allowed outcomes or two blocking outcomes. Multiple targets are conservative: any `INDETERMINATE` blocks; otherwise any `SPEC` blocks; only all `NON_SPEC` allows.

**Decision:** use the closed matrix in [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md#ac-41-path-policy-matrix-is-closed).

### RF-5: Installed reachability matters

A separate extension entry would duplicate lifecycle and packaging. The existing `src/v0.1/extension.js` is the product entrypoint and `scripts/build-plugin.mjs` owns its built payload.

**Decision:** import one registration function into the existing factory and prove the installed artifact without ambient dependencies.

## Risks

| Risk | Consequence | Required treatment |
|---|---|---|
| `.specs2` matches as a prefix | Valid non-spec write is blocked | Compare path components, not substrings |
| Windows case or separator drift | Spec target is missed | Case-fold on Windows and normalize both separators |
| `..` or `.` changes location | Lexical target differs from canonical target | Remove dot segments before comparison |
| Link or reparse target changes containment | Raw spec write bypasses the root | Use filesystem-backed resolution; unresolved state blocks |
| New leaf does not exist | `realpath` cannot resolve the full target | Resolve nearest existing ancestor and append normalized suffix |
| Error text leaks workstation data | Sensitive path disclosure | Emit only repository-relative targets when known and closed error codes |
| Near-miss authoring name | Raw call bypasses path checks | Exact case-sensitive equality only |

## Fixture rule

Executable fixture bytes must come from the real OMP event producer or a real POSIX/Windows filesystem tree. Synthetic mutations may create one-fault negatives only after a real base capture exists. Every fixture keeps producer/version, capture method, date, hash, byte count, license disposition, trimming note, and reviewed ground truth as defined in [FIXTURES.md](FIXTURES.md).

## OMP hook grounding

The pinned OMP tool wrapper emits tool_call before execution and documents fail-closed behavior for hook errors and timeouts. The implementation must verify the exact installed source lines and probe namespaced MCP inputs before treating those observations as release evidence.

## Consolidation ledger

The six original access-enforcement requirements, six acceptance criteria, six scenarios, schema, fixtures, and planned files are retained. One additional requirement and scenario cover non-MCP reads, searches, enumeration, shell, and unknown-tool access. The broader scope is a deliberate product-level expansion, not a claim that the runtime is already shipped.