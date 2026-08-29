# Functional requirements

All requirement keywords `SHALL`, `SHALL NOT`, `SHOULD`, and `MAY` are normative. Status `Specified` means the requirement is written; it does not claim implementation or passing evidence.

## FR-1 — Specification-first public init

The product SHALL begin as a specification-only repository containing reviewed product contracts, provenance, migration decisions, and public policies. Until an installable payload is independently proven, the repository SHALL prominently state that no plugin, marketplace catalog, release, or runtime capability is available. Public init SHALL NOT contain an install command, marketplace catalog, plugin package, or release badge that implies otherwise.

- **Stage:** Public init
- **Priority:** Must
- **Status:** Specified
- **Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-non-installable-init), [AC-1.2](ACCEPTANCE_CRITERIA.md#ac-12-premature-payload-refusal)
- **Scenario trace:** `@feature1`; `SCEN-specification-only-init`; `SCEN-premature-installable-artifact`.
- **Stories/use cases:** US-1; UC-4.

## FR-2 — Immutable source freeze

Every imported upstream file SHALL come only from one immutable source commit via Git-object bytes. The import authority SHALL record source repository, commit, source path, target path, SHA-256, disposition, import status, and license status for every inventoried path. Unmanifested bytes, dirty-worktree bytes, missing paths, and hash mismatches SHALL fail the source-freeze gate. Copied upstream documents SHALL remain byte-preserved reference material and SHALL NOT become the target product source of truth.

- **Stage:** Public init
- **Priority:** Must
- **Status:** Specified
- **Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-reproducible-source-freeze), [AC-2.2](ACCEPTANCE_CRITERIA.md#ac-22-source-mismatch-refusal)
- **Scenario trace:** `@feature2`; `SCEN-pinned-source-export`; `SCEN-mismatched-imported-byte`.
- **Stories/use cases:** US-2; UC-1.

## FR-3 — Redistribution-license gate

Before public publication, every copied upstream item SHALL have an accepted redistribution basis tied to the exact frozen bytes. A new repository root license SHALL govern only repository-owned material and SHALL NOT relabel imported content. Any unknown, ambiguous, or unresolved imported-material license status SHALL keep publication blocked until an authorized reviewer records sufficient evidence or the affected bytes are removed/replaced.

- **Stage:** Public init
- **Priority:** Must
- **Status:** Delivered baseline evidence exists through v0.3.2; future/changed imports still fail closed on license/provenance.
- **Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-unresolved-license-blocks-publication), [AC-3.2](ACCEPTANCE_CRITERIA.md#ac-32-root-license-does-not-cure-import-gap)
- **Scenario trace:** `@feature3`; `SCEN-unresolved-import-license`; `SCEN-root-license-import-separation`.
- **Stories/use cases:** US-3; UC-2.

## FR-4 — Clean public export and secret gate

The candidate public tree SHALL be assembled from an explicit allowlist of repository-owned paths and manifest-approved imported bytes. It SHALL exclude inherited Git history, credentials, tokens, `.env` material, user configuration/state, logs, caches, temporary files, mutable test evidence, and assets lacking provenance or redistribution approval. The complete candidate tree/history SHALL receive a secret scan and public-diff review; any unresolved finding or unknown path SHALL fail closed before remote creation or push.

- **Stage:** Public init and every release
- **Priority:** Must
- **Status:** Specified
- **Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-prohibited-public-path-refusal), [AC-4.2](ACCEPTANCE_CRITERIA.md#ac-42-secret-finding-refusal)
- **Scenario trace:** `@feature4`; `SCEN-prohibited-state-path`; `SCEN-unresolved-secret-finding`.
- **Stories/use cases:** US-4; UC-3.

## FR-5 — One-product identity

The repository SHALL represent one product named `omp-spec-kit`. When distribution is delivered, its canonical installed identity SHALL be `omp-spec-kit@omp-spec-kit` and SHALL satisfy `plugin-distribution:FR-1`: one standalone OMP marketplace, exactly one plugin package, and exactly one extension entry. Later kernel, MCP, guidance, proposal, and mutation capabilities SHALL evolve within that same product identity and SHALL NOT create a second marketplace entry, plugin package, extension control plane, or competing source of truth.

- **Stage:** All
- **Priority:** Must
- **Status:** Delivered one-product distribution at v0.3.2; sibling capabilities remain independently gated.
- **Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-single-product-cardinality), [AC-5.2](ACCEPTANCE_CRITERIA.md#ac-52-identity-continuity-across-stages)
- **Scenario trace:** `@feature5`; `SCEN-single-product-identity`; `SCEN-second-control-plane-refusal`.
- **Stories/use cases:** US-5; UC-5.
- **Canonical dependency:** `plugin-distribution:FR-1`.

## FR-6 — Evidence-gated release stages

The product baseline SHALL advance only through `PUBLIC_INIT → V0_1_READONLY_INVENTORY → V0_2_READONLY_KERNEL → V0_3_READONLY_MCP`. Post-v0.3 capabilities are a dependency DAG, not additional positions in one linear sequence. Each capability has its own state and exact aggregate; accepting one capability SHALL NOT imply a sibling capability.

Baseline gates remain:

1. v0.1.0: accepted historical `distribution-release-eligibility@1` governed by the then-current `plugin-distribution:FR-13` profile.
2. v0.2: accepted candidate-applicable distribution profile plus `spec-kernel:FR-14` `targetStage:"v0.2"` bound to the v0.2 candidate.
3. v0.3: accepted candidate-applicable distribution profile plus current-candidate `targetStage:"v0.3"` kernel result and its exact linked, active v0.2 predecessor.

Historical v0.1–v0.3.2 receipts retain their recorded @1 identities. Any new
candidate evaluated after the contract repair SHALL use
`distribution-release-eligibility@2`; the product evaluator, not the
distribution evaluator, composes that result with baseline/capability/MRI
aggregates. The unversioned qualified owner remains `plugin-distribution:FR-13`,
but every evidence reference also carries its schema/profile version.

Capability gates are:

- generator reads: delivered v0.3 baseline plus `spec-kernel:CHK-FR16-01` and `spec-kernel:CHK-FR17-01`;
- LSP: delivered v0.3 baseline plus complete `spec-lsp:FR-12`; editor/MCP-internal only;
- evidence MCP: delivered v0.3 baseline plus `spec-evidence:FR-13` and `spec-evidence:FR-14`;
- capability graph/impact: delivered v0.3 baseline plus `spec-capability:FR-9`; overlay additionally binds evidence as that profile defines;
- authoring MCP and spec enforcement: one joint boundary requiring delivered v0.3, evidence FR-13/14, authoring FR-13/14, `spec-enforcement:FR-1`/`FR-11`, and host-authority check `spec-enforcement:CHK-FR1-01`; neither row may deliver alone;
- automatic plan gate: delivered v0.3 plus `plan-gate:FR-13` and `plan-gate:CHK-HOST-ABI-01`.

Every current aggregate SHALL bind to the evaluated candidate. Historical, different-lineage, unlinked, stale, revoked, member-subset or structural-only evidence SHALL NOT satisfy any baseline or capability gate.

- **Stage:** All
- **Priority:** Must
- **Status:** Specified
- **Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-stage-cannot-advance-with-missing-evidence), [AC-6.2](ACCEPTANCE_CRITERIA.md#ac-62-baseline-and-capability-gates-cannot-be-bypassed)
- **Scenario trace:** `@feature6`; `SCEN-incomplete-aggregate-remains-planned`; `SCEN-owning-aggregate-cannot-be-bypassed`.
- **Stories/use cases:** US-6; UC-5.

## FR-7 — Honest public status and claims

Every public status SHALL identify baseline/capability, conservative state, revision/current artifact/lineage, typed evidence roles, timestamp, blockers and next gates. Allowed states are `SPEC_ONLY`, `PLANNED`, `SPECIFIED`, `DEFERRED`, `DEFERRED_HOST_ABI`, `BLOCKED`, and `DELIVERED`; only the exact complete aggregate may produce DELIVERED.

- **Stage:** All
- **Priority:** Must
- **Status:** Specified
- **Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-fail-closed-status), [AC-7.2](ACCEPTANCE_CRITERIA.md#ac-72-bdd-text-is-not-execution-evidence)
- **Scenario trace:** `@feature7`; `SCEN-status-fails-closed`; `SCEN-unexecuted-bdd-not-evidence`.
- **Stories/use cases:** US-1, US-6; UC-6.

## FR-8 — Manager-readable roadmap and boundaries

Public product documentation SHALL distinguish current delivery, planned stages, deferred scope, blockers, and stage exit evidence in manager-readable language. It SHALL link each delegated contract to its canonical owning spec rather than duplicating internals: distribution to `plugin-distribution`, read-only inventory/kernel/query to `spec-kernel`, editor/LSP diagnostics to `spec-lsp`, evidence evaluation to `spec-evidence`, and authoring/mutation to `spec-authoring-workflow`. The roadmap SHALL keep advisor, hooks, dashboards, backlog, persistence, repair, model judging, proxy, context/memory, auto-commit, and generic dev-pomogator harness machinery outside the public-init/v0.1.0 boundary. The roadmap SHALL NOT call v0.3 “not the 46-tool door”; v0.3 is the first slice of the generator-port MCP door.

- **Stage:** All
- **Priority:** Should
- **Status:** Specified
- **Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-roadmap-separates-state), [AC-8.2](ACCEPTANCE_CRITERIA.md#ac-82-canonical-boundary-links)
- **Scenario trace:** `@feature8`; `SCEN-roadmap-separates-states`; `SCEN-canonical-owner-delegation`.
- **Stories/use cases:** US-7; UC-4, UC-5.

## FR-9 — Generator-port MCP destination

The product destination SHALL be the generator-port MCP door. The agent-facing specification API SHALL be MCP only; host `lsp` is not a spec tool. The eight SCHEMA-11 MCP names proven in v0.3 SHALL remain the first slice of that door: growing MCP SHALL NOT delete them, and documents that mention the eight-tool registry SHALL call it the first slice or v0.3 candidate identity rather than the destination. Every row in the closed 46-name census SHALL have an owner spec and a stage; silent DROP of a census row is forbidden. Schema v1 of authoring omitting a name is later, not DROP. Distinguish the dropped dev-pomogator backlog dashboard from later MCP `add_backlog_task`. The canonical census table is [spec-generator-port.md](../../docs/decisions/spec-generator-port.md).

- **Stage:** All
- **Priority:** Must
- **Status:** Specified
- **Acceptance:** [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-census-owned-mcp-only-first-slice)
- **Scenario trace:** `@feature9`; `SCEN-generator-port-destination`.
- **Stories/use cases:** US-8; UC-7.
- **Canonical dependency:** [spec-generator-port.md](../../docs/decisions/spec-generator-port.md); `spec-kernel:FR-16`; `spec-kernel:FR-17`; `spec-lsp:FR-1`; `spec-evidence`; `spec-authoring-workflow`.
