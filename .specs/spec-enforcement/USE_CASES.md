# Use Cases

## UC-1: Allow an authoring transaction

**Primary actor:** Agent using the sanctioned spec mutation door.

**Precondition:** The existing extension receives a `tool_call` event.

**Flow:**
1. The handler reads the exact hook-visible tool name.
2. The name equals `propose_patch` or `apply_proposed_patch`.
3. The handler returns ALLOW `AUTHORING_TOOL_ALLOWED` before target containment.

**Postcondition:** The authoring MCP operation continues and remains responsible for validation and atomicity.

**Related:** [FR-2](FR.md#fr-2-exact-two-name-authoring-allowlist), [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-only-the-two-exact-authoring-names-bypass-path-denial), `@feature2`

## UC-2: Block a direct spec write

**Primary actor:** Agent invoking a non-allowlisted direct mutator.

**Precondition:** The call supplies a target that resolves to the canonical `.specs` root or a descendant.

**Flow:**
1. Exact authoring-name comparison fails.
2. The resolver normalizes and resolves the target.
3. Component-boundary containment classifies it as `SPEC`.
4. The handler returns BLOCK `RAW_SPEC_WRITE` with a bounded repository-relative redirect.

**Postcondition:** The raw mutator does not execute.

**Related:** [FR-3](FR.md#fr-3-filesystem-backed-containment), [FR-4](FR.md#fr-4-closed-path-policy-decision), [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-path-policy-matrix-is-closed), `@feature4`

## UC-3: Allow a proven non-spec write

**Primary actor:** Agent invoking a non-allowlisted direct mutator.

**Precondition:** Every mutation target can be proven outside the canonical `.specs` root.

**Flow:**
1. The resolver canonicalizes each target.
2. Exact component comparison proves every target is outside `.specs`.
3. The handler returns ALLOW `NON_SPEC_ALLOWED`.

**Postcondition:** The direct non-spec mutation proceeds unchanged.

**Related:** [FR-4](FR.md#fr-4-closed-path-policy-decision), [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-path-policy-matrix-is-closed), `@feature4`

## UC-4: Block indeterminate containment

**Primary actor:** Agent whose direct mutator target cannot be resolved safely.

**Precondition:** Path syntax, filesystem access, link resolution, reparse handling, or nearest-existing-ancestor resolution cannot prove containment.

**Flow:**
1. Exact authoring-name comparison fails.
2. Resolution returns `INDETERMINATE` with a closed code.
3. The handler returns BLOCK `TARGET_INDETERMINATE`.
4. The reason omits absolute paths and raw operating-system errors.

**Postcondition:** Uncertainty cannot become a write bypass.

**Related:** [FR-3](FR.md#fr-3-filesystem-backed-containment), [FR-5](FR.md#fr-5-bounded-visible-and-stateless-results), [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-containment-covers-path-and-filesystem-boundaries), `@feature3`, `@feature5`

## UC-5: Load the installed policy

**Primary actor:** Plugin maintainer.

**Precondition:** The built plugin is installed without source files or ambient modules.

**Flow:**
1. The existing extension factory imports the bundled registration function.
2. The function registers one `tool_call` handler.
3. Captured allowlist and path fixtures are replayed.

**Postcondition:** Installed results equal reviewed ground truth and no second extension entry exists.

**Related:** [FR-1](FR.md#fr-1-current-tool-call-registration), [FR-6](FR.md#fr-6-single-factory-installed-delivery), [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-installed-artifact-uses-one-factory), `@feature1`, `@feature6`
