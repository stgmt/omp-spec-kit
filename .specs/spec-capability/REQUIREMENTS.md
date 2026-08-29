# Requirements Matrix

## Functional traceability

| Requirement | Subject | Acceptance | Scenario | Task | Status |
|---|---|---|---|---|---|
| [FR-1](FR.md#fr-1-per-owning-spec-capability-nodes) | Capability nodes | [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-capability-nodes-are-parsed-from-capabilitiesmd) | `@feature1` / SCEN-capability-node-parsing | TASK-1 | Specified |
| [FR-2](FR.md#fr-2-derivesfrom-declarations-and-edge-grammar) | Derivation edges | [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-derivesfrom-edges-follow-the-closed-endpoint-matrix) | `@feature2` / SCEN-derives-from-edge-resolution | TASK-1 | Specified |
| [FR-3](FR.md#fr-3-capability-conformance-findings) | Conformance | [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-conformance-findings-use-closed-codes-and-severities) | `@feature3` / SCEN-capability-conformance-findings | TASK-2 | Specified |
| [FR-4](FR.md#fr-4-requirements-of-capability-query) | requirementsOf | [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-requirementsof-returns-live-deterministic-bounded-results) | `@feature4` / SCEN-requirements-of-capability-query | TASK-3 | Specified |
| [FR-5](FR.md#fr-5-capabilities-of-spec-query) | capabilitiesOf | [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-capabilitiesof-returns-declared-capabilities) | `@feature5` / SCEN-capabilities-of-spec-query | TASK-3 | Specified |
| [FR-6](FR.md#fr-6-graph-only-impact-and-evidence-overlay) | Impact/overlay | [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-graph-impact-and-evidence-invalidation-are-separated) | `@feature6` / SCEN-get-impact-query | TASK-4 | Specified |
| [FR-7](FR.md#fr-7-determinism-and-canonical-identity) | Identity | [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-capability-identity-is-deterministic-and-fail-closed), [AC-7.2](ACCEPTANCE_CRITERIA.md#ac-72-canonical-id-grammar-and-cross-reference-resolution) | `@feature7` / SCEN-capability-determinism-and-identity | TASK-1 | Specified |
| [FR-8](FR.md#fr-8-mcp-only-parity-discipline) | MCP parity | [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-mcp-projections-map-one-to-one-without-added-semantics) | `@feature8` / SCEN-capability-projection-parity | TASK-5 | Specified |
| [FR-9](FR.md#fr-9-capability-release-eligibility) | Release aggregate | [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-release-gate-is-a-closed-conjunction) | `@feature9` / SCEN-capability-release-conjunction | TASK-6 | Specified |
| [FR-10](FR.md#fr-10-boundary-enforcement) | Boundary | [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-non-goals-are-enforced-as-schema-absence) | `@feature10` / SCEN-capability-non-goals-enforced | TASK-7 | Specified |

## Contract checks

| Check | Contract | Trace | Task | Evidence | State |
|---|---|---|---|---|---|
| CHK-FR1-01 | Owning-spec CAPABILITIES produces qualified nodes; root/bare/frontmatter forms reject | FR-1, AC-1.1, `SCEN-capability-node-parsing` | TASK-1 | Parser/source fixture | Not recorded |
| CHK-FR2-01 | Qualified Covers produces permitted requirement→capability/child→parent DERIVES_FROM; Requirement remains REFS | FR-2, AC-2.1, `SCEN-derives-from-edge-resolution` | TASK-1 | Edge matrix | Not recorded |
| CHK-FR3-01 | Capability diagnostics are exact and duplicates use kernel DUPLICATE_DEFINITION | FR-3, AC-3.1, `SCEN-capability-conformance-findings` | TASK-2 | Conformance matrix | Not recorded |
| CHK-FR4-01 | requirementsOf exact args/data/bounds/order/errors hold | FR-4, AC-4.1, `SCEN-requirements-of-capability-query` | TASK-3 | Query matrix | Not recorded |
| CHK-FR5-01 | capabilitiesOf deduplicates/inheritance/lifecycle with exact bounds | FR-5, AC-5.1, `SCEN-capabilities-of-spec-query` | TASK-3 | Query matrix | Not recorded |
| CHK-FR6-01 | Graph-only getImpact returns typed structural/semantic IDs and no producer IDs | FR-6, AC-6.1, `SCEN-get-impact-query` | TASK-4 | Graph impact matrix | Not recorded |
| CHK-FR6-02 | Overlay compares complete current/evidence bindings and returns stale/unaffected/indeterminate proof | FR-6, AC-6.1, `SCEN-get-impact-query` | TASK-4 | Evidence overlay matrix | Not recorded |
| CHK-FR7-01 | Qualified identity is deterministic and duplicate-safe | FR-7, AC-7.1, AC-7.2, `SCEN-capability-determinism-and-identity` | TASK-1 | Property/duplicate matrix | Not recorded |
| CHK-FR8-01 | Graph MCP names map three graph envelopes one-to-one with no OMP/LSP agent surface | FR-8, AC-8.1, `SCEN-capability-projection-parity` | TASK-5 | Graph MCP registry/parity | Not recorded |
| CHK-FR8-02 | Overlay MCP adds invalidate_evidence only in overlay profile and maps one-to-one | FR-8, AC-8.1, `SCEN-capability-projection-parity` | TASK-5 | Overlay MCP registry/parity | Not recorded |
| CHK-FR9-01 | Graph/overlay profile membership, baseline/evidence bytes and closed eligibility blockers are exact | FR-9, AC-9.1, `SCEN-capability-release-conjunction` | TASK-6 | Manifest/evaluator one-fault matrix | Not recorded |
| CHK-FR10-01 | Forbidden root singleton/frontmatter/mutation/direct-I/O/second-agent concepts are absent | FR-10, AC-10.1, `SCEN-capability-non-goals-enforced` | TASK-7 | Schema/bundle inventory | Not recorded |
| CHK-NFR-PERF-01 | Build/query/impact p95 limits hold | NFR-PERF-1 | `SCEN-capability-release-conjunction` | TASK-8 | Raw benchmark samples | Not recorded |
| CHK-NFR-SIZE-01 | Bundle and response byte limits/paging hold | NFR-SIZE-1 | `SCEN-capability-release-conjunction` | TASK-8 | Artifact/response measurements | Not recorded |
| CHK-NFR-MEM-01 | Incremental RSS bound holds | NFR-MEM-1 | `SCEN-capability-release-conjunction` | TASK-8 | Memory observations | Not recorded |
| CHK-NFR-SEC-01 | Containment/redaction/MCP-only surface hold | NFR-SEC-1 | `SCEN-capability-non-goals-enforced` | TASK-7, TASK-8 | Cross-platform security matrix | Not recorded |
| CHK-NFR-REL-01 | Determinism/conservation/release all-not-any hold | NFR-REL-1 | `SCEN-capability-release-conjunction` | TASK-6, TASK-8 | Permutation/negative matrix | Not recorded |
| CHK-NFR-USE-01 | Diagnostics carry bounded actionable context | NFR-USE-1 | `SCEN-capability-conformance-findings` | TASK-2, TASK-8 | Diagnostic golden | Not recorded |

## Non-functional traceability

| NFR | Related requirements | Tasks | Verification obligation |
|---|---|---|---|
| [NFR-PERF-1](NFR.md#nfr-perf-1-capability-build-and-query-latency) | FR-4, FR-5, FR-6 | TASK-3, TASK-4, TASK-8 | Query/impact p95 and cursor-chain measurements |
| [NFR-SIZE-1](NFR.md#nfr-size-1-extended-bundle-size) | FR-4, FR-5, FR-6, FR-8 | TASK-5, TASK-8 | Bundle/response bytes and item-boundary paging |
| [NFR-MEM-1](NFR.md#nfr-mem-1-extended-memory-bound) | FR-1, FR-4, FR-6 | TASK-1, TASK-4, TASK-8 | Peak incremental RSS |
| [NFR-SEC-1](NFR.md#nfr-sec-1-containment) | FR-1, FR-2, FR-8, FR-10 | TASK-1, TASK-5, TASK-7, TASK-8 | Containment/redaction and agent-surface audit |
| [NFR-REL-1](NFR.md#nfr-rel-1-determinism-and-fail-closed) | FR-2, FR-7, FR-9 | TASK-1, TASK-6, TASK-8 | Permutation/conservation/release matrices |
| [NFR-USE-1](NFR.md#nfr-use-1-actionable-bounded-diagnostics) | FR-3 | TASK-2, TASK-8 | Diagnostic golden comparison |
