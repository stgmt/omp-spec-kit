# Acceptance criteria

## FR-1 — Current shipped baseline

### AC-1.1 — Current release proof

**WHEN** the current product status is rendered **THEN** it SHALL show exactly one SHIPPED row for `omp-spec-kit@omp-spec-kit` v0.3.2, SHALL name the v0.2 graph/query kernel and eight working read-only MCP tools, and SHALL link `docs/validation/release-status-v0.3.2.json`.

**Scenario:** `@feature1`, `SCEN-current-release-proof`.

## FR-2 — One-product identity

### AC-2.1 — Single product identity

**WHEN** the installed product is inspected **THEN** exactly one marketplace entry, one plugin package, and one extension SHALL use the `omp-spec-kit@omp-spec-kit` identity and no competing specification writer SHALL exist.

**Scenario:** `@feature2`, `SCEN-one-product-identity`.

## FR-3 — Proof before shipped

### AC-3.1 — Missing proof is not shipped

**WHEN** an outcome lacks current observable proof for its exact released identity **THEN** it SHALL remain NEXT or LATER and SHALL NOT be labeled SHIPPED.

**Scenario:** `@feature3`, `SCEN-missing-proof-is-not-shipped`.

### AC-3.2 — Unexecuted text is not proof

**WHEN** only a specification, task state, Gherkin scenario, historical receipt, or sibling progress exists **THEN** the outcome SHALL NOT be labeled SHIPPED.

**Scenario:** `@feature3`, `SCEN-unexecuted-text-is-not-proof`.

## FR-4 — Next safe authoring outcome

### AC-4.1 — Bounded public mutation surface

**WHEN** the public mutation inventory is inspected **THEN** it SHALL contain exactly `propose_patch` and `apply_proposed_patch`; every helper SHALL remain internal.

**Scenario:** `@feature4`, `SCEN-authoring-tools-are-bounded`.

### AC-4.2 — Direct spec write policy

**WHEN** a `tool_call` can write **THEN** the policy SHALL check the exact allowlist `{propose_patch, apply_proposed_patch}` first; an allowlisted call may reach atomic contained authoring, every other call targeting canonical `.specs/**` SHALL be refused, and real-path/link/reparse escapes or unresolved targets SHALL fail closed with a bounded reason.

**Scenario:** `@feature4`, `SCEN-direct-spec-write-is-refused`.

## FR-5 — Plain later outcomes

### AC-5.1 — Three-bucket roadmap

**WHEN** the roadmap is read **THEN** its only public buckets SHALL be SHIPPED, NEXT, and LATER; it SHALL contain one SHIPPED v0.3.2 row, one NEXT safe-authoring row, and plain LATER outcomes for expanded reads, editor navigation, evidence queries, impact reporting, and manual exact-content plan validation.

**Scenario:** `@feature5`, `SCEN-roadmap-has-three-buckets`.
