# Requirements Matrix

## Functional traceability

| Requirement | Subject | Acceptance criterion | Scenario tag | Story / Use case | Status |
|---|---|---|---|---|---|
| [FR-1](FR.md#fr-1-capability-node-and-document) | Capability node and document | [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-capability-nodes-are-parsed-from-capabilitiesmd) | `@feature1` | [US-1](USER_STORIES.md#us-1-product-meaning-anchor-above-specs), [UC-1](USE_CASES.md#uc-1-parse-capabilities-from-the-repository-level-document) | Specified |
| [FR-2](FR.md#fr-2-derivesfrom-edge-and-declaration-grammar) | DERIVES_FROM edge and declaration | [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-derivesfrom-edges-follow-closed-endpoint-matrix) | `@feature2` | [US-1](USER_STORIES.md#us-1-product-meaning-anchor-above-specs), [UC-2](USE_CASES.md#uc-2-declare-requirement-to-capability-derivation) | Specified |
| [FR-3](FR.md#fr-3-conformance-findings) | Conformance findings | [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-conformance-findings-use-closed-codes-and-severities) | `@feature3` | [US-2](USER_STORIES.md#us-2-capability-conformance-consumer) | Specified |
| [FR-4](FR.md#fr-4-requirements-of-capability-query) | Requirements-of query | [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-requirements-of-returns-live-deterministic-bounded-results) | `@feature4` | [US-4](USER_STORIES.md#us-4-derivation-query-user), [UC-3](USE_CASES.md#uc-3-query-live-requirements-of-a-capability) | Specified |
| [FR-5](FR.md#fr-5-capabilities-of-spec-query) | Capabilities-of query | [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-capabilities-of-returns-declared-capabilities) | `@feature5` | [US-4](USER_STORIES.md#us-4-derivation-query-user) | Specified |
| [FR-6](FR.md#fr-6-get-impact-query) | Get-impact query | [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-get-impact-returns-three-section-envelope) | `@feature6` | [US-3](USER_STORIES.md#us-3-change-impact-analyst), [UC-4](USE_CASES.md#uc-4-assess-change-impact-of-a-requirement-modification) | Specified |
| [FR-7](FR.md#fr-7-determinism-and-identity) | Determinism and identity | [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-capability-identity-is-deterministic-and-fail-closed) | `@feature7` | [US-1](USER_STORIES.md#us-1-product-meaning-anchor-above-specs), [UC-1](USE_CASES.md#uc-1-parse-capabilities-from-the-repository-level-document) | Specified |
| [FR-8](FR.md#fr-8-parity-discipline) | Projection parity | [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-projections-map-one-to-one-without-added-semantics) | `@feature8` | [US-5](USER_STORIES.md#us-5-kernel-extension-parity-reviewer) | Specified |
| [FR-9](FR.md#fr-9-release-eligibility-conjunction) | Release eligibility | [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-release-gate-is-a-closed-conjunction) | `@feature9` | [US-6](USER_STORIES.md#us-6-release-gate-evaluator), [UC-5](USE_CASES.md#uc-5-evaluate-capability-layer-release-eligibility) | Specified |
| [FR-10](FR.md#fr-10-non-goals-enforcement) | Non-goals enforcement | [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-non-goals-are-enforced-as-schema-absence) | `@feature10` | [US-5](USER_STORIES.md#us-5-kernel-extension-parity-reviewer) | Specified |

## Contract checks

| Check | Contract | Trace | Future evidence | State |
|---|---|---|---|---|
| CHK-FR1-01 | CAPABILITY nodes are parsed from CAPABILITIES.md with correct nesting and ID grammar | FR-1, AC-1.1, `@feature1` | Parser fixture test with nested capabilities and malformed headings | Not recorded |
| CHK-FR2-01 | DERIVES_FROM edges follow closed endpoint matrix; declarations resolve or produce typed diagnostics | FR-2, AC-2.1, `@feature2` | Edge resolution test with valid/forbidden/missing targets | Not recorded |
| CHK-FR3-01 | CAPABILITY_DANGLING fails closed; CAPABILITY_ORPHAN and SPEC_WITHOUT_CAPABILITY do not invalidate graph | FR-3, AC-3.1, `@feature3` | Diagnostic severity and graph validity test | Not recorded |
| CHK-FR4-01 | requirements_of returns live deterministic bounded results excluding archived requirements | FR-4, AC-4.1, `@feature4` | Query contract test with archived/live mix | Not recorded |
| CHK-FR5-01 | capabilities_of returns deduplicated declared capabilities for valid specs | FR-5, AC-5.1, `@feature5` | Query contract test with frontmatter and field declarations | Not recorded |
| CHK-FR6-01 | get_impact returns three-section envelope with structural, semantic_recheck, and invalidates | FR-6, AC-6.1, `@feature6` | Impact query contract test with two-hop scenarios | Not recorded |
| CHK-FR7-01 | Capability identity is deterministic across input orders; duplicates fail closed per spec-kernel:FR-4 | FR-7, AC-7.1, `@feature7` | Property test over permuted inputs plus duplicate fixture | Not recorded |
| CHK-FR8-01 | Extension and MCP projections return canonical envelopes without added semantics | FR-8, AC-8.1, `@feature8` | Projection parity comparison test | Not recorded |
| CHK-FR9-01 | Release eligibility requires all mandatory evidence; unknown/mismatched profiles fail closed | FR-9, AC-9.1, `@feature9` | Per-profile evidence manifest test | Not recorded |
| CHK-FR10-01 | Schema contains no ontology, SHACL, SKOS, version, or federation types | FR-10, AC-10.1, `@feature10` | Schema inspection test | Not recorded |

## Non-functional traceability

| NFR | Related requirements | Verification obligation |
|---|---|---|
| [NFR-PERF-1](NFR.md#nfr-perf-1-capability-build-and-query-latency) | FR-1, FR-4, FR-5, FR-6 | Pinned benchmark with capability extension, p95 samples |
| [NFR-SIZE-1](NFR.md#nfr-size-1-extended-bundle-size) | FR-1, FR-6 | Installed artifact delta measurement, impact response size |
| [NFR-MEM-1](NFR.md#nfr-mem-1-extended-memory-bound) | FR-1, FR-6 | Peak incremental RSS with capability indexes |
| [NFR-REL-1](NFR.md#nfr-rel-1-determinism-and-fail-closed) | FR-3, FR-7, FR-9 | Repeated canonical snapshot, diagnostic severity test |
| [NFR-SEC-1](NFR.md#nfr-sec-1-containment) | FR-1, FR-6 | Containment and path leak check |
| [NFR-USE-1](NFR.md#nfr-use-1-actionable-bounded-diagnostics) | FR-3 | Diagnostic format and remediation hint test |

## Global invariants

1. CAPABILITY nodes exist only from `.specs/CAPABILITIES.md`; no other document creates CAPABILITY definitions.
2. DERIVES_FROM edges follow the closed endpoint matrix: FR→CAPABILITY, NFR→CAPABILITY, CAPABILITY→CAPABILITY (nesting).
3. `definitionOccurrences = uniqueNodes + ambiguousCandidates + rejectedDefinitions` includes CAPABILITY occurrences.
4. CAPABILITY_DANGLING (ERROR) sets `graph.valid=false`; CAPABILITY_ORPHAN (WARNING) and SPEC_WITHOUT_CAPABILITY (INFO) do not.
5. Every DERIVES_FROM reference occurrence has exactly one resolved or unresolved outcome.
6. `get_impact` is a read-only pure function; it never mutates state or reimplments evidence freshness.
7. Projection parity: extension and MCP responses are byte-identical canonical envelopes after transport metadata removal.
8. Capability IDs follow `spec-kernel:FR-3` normalization; duplicates fail closed per `spec-kernel:FR-4`.
9. Non-goals are enforced as schema absence: no ontology, SHACL, SKOS, version fields, or federation types in `spec-capability@1`.
10. Release eligibility is the conjunction of all mandatory checks; partial evidence fails closed.
