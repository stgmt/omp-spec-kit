# Tasks

All tasks are future implementation work. Scenario text does not satisfy Done When.

## TASK-1: Implement exact allowlist and decisions

**Status:** todo

**Estimate:** 1 day

**Owner:** Enforcement maintainer

**Depends On:** none

**Requirements:** [FR-2](FR.md#fr-2-exact-two-name-authoring-allowlist), [FR-4](FR.md#fr-4-closed-path-policy-decision), [FR-5](FR.md#fr-5-bounded-visible-and-stateless-results)

**Done When:**
- `decision.js` contains exactly the two authoring names and six public result codes.
- Name near misses follow the path matrix; multi-target precedence matches REQUIREMENTS.
- The 512-byte reason preserves code and redirect and contains no absolute or raw error data.
- CHK-FR2-01, CHK-FR4-01, and the output portion of CHK-FR5-01 pass against reviewed fixtures.

## TASK-2: Implement filesystem containment

**Status:** todo

**Estimate:** 2 days

**Owner:** Security maintainer

**Depends On:** none

**Requirements:** [FR-3](FR.md#fr-3-filesystem-backed-containment), [FR-4](FR.md#fr-4-closed-path-policy-decision)

**Done When:**
- `resolve-targets.js` handles separators, platform case, component boundaries, dot segments, canonical roots, `lstat`, `realpath`, POSIX links, Windows reparse points, and nearest existing ancestors.
- Existing, linked, external, traversal, `.specs2`, root, descendant, and new-target fixtures reconcile with reviewed ground truth.
- Filesystem errors and the 20-second deadline return `INDETERMINATE`.
- CHK-FR3-01 and the resolver portion of CHK-FR4-01 pass on POSIX and Windows.

## TASK-3: Register and bundle the policy

**Status:** todo

**Estimate:** 1 day

**Owner:** Extension maintainer

**Depends On:** TASK-1, TASK-2

**Requirements:** [FR-1](FR.md#fr-1-current-tool-call-registration), [FR-5](FR.md#fr-5-bounded-visible-and-stateless-results), [FR-6](FR.md#fr-6-single-factory-installed-delivery)

**Done When:**
- `register.js` registers one `tool_call` handler and `src/v0.1/extension.js` calls it once.
- No other event or extension entry is added.
- The build includes the three modules and loads without source checkout, ambient modules, downloads, native addons, or unresolved imports.
- Side-effect audit finds no files, logs, counters, caches, network, subprocess, credentials, or alternate tools.
- CHK-FR1-01, CHK-FR5-01, and CHK-FR6-01 pass.

## TASK-4: Capture and verify real policy fixtures

**Status:** todo

**Estimate:** 2 days

**Owner:** Independent reviewer

**Depends On:** TASK-3

**Requirements:** [FR-2](FR.md#fr-2-exact-two-name-authoring-allowlist), [FR-3](FR.md#fr-3-filesystem-backed-containment), [FR-4](FR.md#fr-4-closed-path-policy-decision), [FR-5](FR.md#fr-5-bounded-visible-and-stateless-results), [FR-6](FR.md#fr-6-single-factory-installed-delivery)

**Done When:**
- Real OMP call captures and real POSIX/Windows filesystem trees carry the complete FIXTURES manifest.
- One-fault name and path mutations cover every row in the allowlist and containment matrices.
- Source and installed artifact results reconcile element-for-element with ground truth.
- CHK-FR2-01 through CHK-FR6-01 have concrete proof paths.

## Task summary

| Task | Status | Owner | Primary output |
|---|---|---|---|
| TASK-1 | todo | Enforcement maintainer | Exact allowlist, decision, and reason |
| TASK-2 | todo | Security maintainer | Filesystem containment resolver |
| TASK-3 | todo | Extension maintainer | Existing-factory installed policy |
| TASK-4 | todo | Independent reviewer | Real cross-platform policy fixtures |

## TASK-5: Ground the pinned OMP tool-call contract

**Status:** todo

**Estimate:** 1 day

**Owner:** Runtime contract maintainer

**Depends On:** TASK-1, TASK-3

**Requirements:** [FR-1](FR.md#fr-1-current-tool-call-registration), [FR-6](FR.md#fr-6-single-factory-installed-delivery), [FR-7](FR.md#fr-7-non-mcp-read-and-execution-denial), [NFR-USE-2](NFR.md#nfr-use-2-cross-surface-agent-denial)

**Checks:** CHK-FR1-01, CHK-FR6-01, CHK-FR7-01, CHK-FR7-02

**Scenario:** @feature7 / SCEN-mcp-access-gate-non-mcp-spec-access

**Done When:** Exact event fields, tool variants, namespacing, authority ABI, timeout, exception, and error semantics are captured from the pinned runtime and positive/negative probes reconcile with the schema.

## TASK-6: Cover all non-MCP specification access paths

**Status:** todo

**Estimate:** 3 days

**Owner:** Security maintainer

**Depends On:** TASK-2, TASK-4, TASK-5

**Requirements:** [FR-3](FR.md#fr-3-filesystem-backed-containment), [FR-4](FR.md#fr-4-closed-path-policy-decision), [FR-5](FR.md#fr-5-bounded-visible-and-stateless-results), [FR-7](FR.md#fr-7-non-mcp-read-and-execution-denial), [FR-8](FR.md#fr-8-windows-read-selector-support), [FR-9](FR.md#fr-9-execution-payload-specification-guard-with-stated-limits), [NFR-USE-2](NFR.md#nfr-use-2-cross-surface-agent-denial)

**Checks:** CHK-FR3-01, CHK-FR4-01, CHK-FR5-01, CHK-FR7-01, CHK-FR7-02

**Scenario:** @feature7 / SCEN-mcp-access-gate-non-mcp-spec-access

**Done When:** Read, grep, glob, edit, write, bash, custom, traversal, link/reparse, ambiguity, special-path, empty-target, authority, and timeout cases are executed against real policy fixtures; MCP-authorized and proven non-spec calls are not over-blocked.
