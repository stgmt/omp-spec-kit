# Functional Requirements

All identities use `spec-enforcement:<local-id>`. Gherkin scenarios specify future behavior and are not execution evidence.

## FR-1: Current tool call registration

The existing `omp-spec-kit` extension factory SHALL register exactly one pre-execution `tool_call` handler for this capability. It SHALL register no other event for enforcement and SHALL not create a second extension entry or background component.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-only-tool-call-is-registered)

**Scenario:** `@feature1` / `SCEN-current-tool-call-registration`

## FR-2: Exact two-name authoring allowlist

The handler SHALL compare the hook-visible tool name by exact case-sensitive equality before target resolution. Only `propose_patch` and `apply_proposed_patch` SHALL return ALLOW `AUTHORING_TOOL_ALLOWED` at this step. Prefix, suffix, case, qualification, or embedded-name variants SHALL continue to the direct-mutation path policy.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-only-the-two-exact-authoring-names-bypass-path-denial)

**Scenario:** `@feature2` / `SCEN-exact-authoring-allowlist`

## FR-3: Filesystem-backed containment

For each non-allowlisted direct mutation target, the resolver SHALL normalize `/` and `\`, remove dot segments, anchor relative paths to the canonical project root, compare path components with Windows case-insensitivity and POSIX case-sensitivity, and treat `.specs2` and similar names as outside `.specs`. Existing components SHALL be inspected with `lstat` and `realpath`; POSIX symlinks and Windows reparse points SHALL be resolved or produce `INDETERMINATE`. A new target SHALL be resolved through its nearest existing ancestor and normalized remaining suffix. The result SHALL be exactly `SPEC`, `NON_SPEC`, or `INDETERMINATE` with a closed code.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-containment-covers-path-and-filesystem-boundaries)

**Scenario:** `@feature3` / `SCEN-filesystem-containment`

## FR-4: Closed path-policy decision

For a non-allowlisted direct mutator, the canonical `.specs` root or any descendant SHALL BLOCK with `RAW_SPEC_WRITE`; targets proven outside SHALL ALLOW with `NON_SPEC_ALLOWED`; and any indeterminate target SHALL BLOCK with `TARGET_INDETERMINATE`. For multiple targets, any indeterminate target takes precedence, then any spec target; ALLOW requires every target to be proven outside.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-path-policy-matrix-is-closed)

**Scenario:** `@feature4` / `SCEN-closed-path-policy`

## FR-5: Bounded visible and stateless results

A blocked call SHALL return one deterministic reason no larger than 512 UTF-8 bytes. When known, it SHALL name only the normalized repository-relative target and SHALL direct the caller to `propose_patch` followed by `apply_proposed_patch`. It SHALL omit absolute paths, environment values, credentials, stack traces, and raw operating-system errors. The capability SHALL create no files, logs, counters, caches, network calls, subprocesses, credential reads, or alternate tools.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-blocks-are-bounded-visible-and-stateless)

**Scenario:** `@feature5` / `SCEN-bounded-stateless-block`

## FR-6: Single-factory installed delivery

The decision, resolver, and registration modules SHALL ship in the existing bundled plugin artifact and execute without the source checkout, ambient `node_modules`, downloads, native addons, or unresolved imports. `src/v0.1/extension.js` SHALL remain the only extension factory and SHALL call the registration function once.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-installed-artifact-uses-one-factory)

**Scenario:** `@feature6` / `SCEN-single-factory-installed-policy`
