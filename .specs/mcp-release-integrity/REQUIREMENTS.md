# Requirements Index

## Traceability Matrix

| ID | Name | Linked AC | Scenario | Status |
|----|------|-----------|----------|--------|
| [FR-1](FR.md#fr-1-active-project-mcp-root) | Active-project MCP root | [AC-1](ACCEPTANCE_CRITERIA.md#ac-1-fr-1-active-project-wins-over-package-cwd) | SCEN-MRI-001, SCEN-MRI-012, SCEN-MRI-013 | Draft |
| [FR-2](FR.md#fr-2-terminal-json-rpc-protocol-responses) | Terminal JSON-RPC protocol responses | [AC-2](ACCEPTANCE_CRITERIA.md#ac-2-fr-2-invalid-frames-are-terminal-and-framed) | SCEN-MRI-002 | Draft |
| [FR-3](FR.md#fr-3-installed-package-all-tool-parity) | Installed-package all-tool parity | [AC-3](ACCEPTANCE_CRITERIA.md#ac-3-fr-3-the-packaged-mcp-surface-is-complete-and-immutable) | SCEN-MRI-003, SCEN-MRI-012, SCEN-MRI-013 | Draft |
| [FR-4](FR.md#fr-4-candidate-bound-lifecycle-eligibility) | Candidate-bound lifecycle eligibility | [AC-4](ACCEPTANCE_CRITERIA.md#ac-4-fr-4-candidate-evidence-is-complete-and-bound) | SCEN-MRI-004, SCEN-MRI-010, SCEN-MRI-011 | Draft |
| [FR-5](FR.md#fr-5-artifact-only-publication) | Artifact-only publication | [AC-5](ACCEPTANCE_CRITERIA.md#ac-5-fr-5-publish-consumes-the-verified-artifact-only) | SCEN-MRI-005 | Draft |
| [FR-6](FR.md#fr-6-honest-release-communication) | Honest release communication | [AC-6](ACCEPTANCE_CRITERIA.md#ac-6-fr-6-public-status-tells-users-the-truth) | SCEN-MRI-006 | Draft |

## Functional Requirements

- FR-1 through FR-6 in [FR.md](FR.md).

## Non-Functional Requirements

- [Performance](NFR.md#performance), [Security](NFR.md#security), [Reliability](NFR.md#reliability), and [Usability](NFR.md#usability).

## Acceptance Criteria

- AC-1 through AC-6 in [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md).

## Verification Matrix (CHK)

| CHK-ID | Requirement | Traces To (FR+SC) | Verification Method | Status | Notes |
|--------|-------------|-------------------|---------------------|--------|-------|
| CHK-FR1-01 | Active project root through package launcher | FR-1, AC-1, UC-1, SCEN-MRI-012 | BDD manager-handoff scenario | In Progress | Disposable pinned-Bun v17.3.7 host runs from project-a with isolated HOME/profile; its actual `MCPManager.getTools()` `spec_inventory` call must report bridge-projected text and returned/observed counts exactly equal to the direct project-a oracle. The intentionally distinct package-decoy inventory cardinality makes that equality evidence of decoy exclusion; the receipt must also prove provider, omitted `cwd`, and process/`pi-utils` roots at project-a. |
| CHK-FR1-02 | Invalid root override retains active project | FR-1, AC-1, UC-1 | BDD scenario | In Progress | Requires real discovered OMP server receipt. |
| CHK-FR2-01 | JSON-RPC 1.0 request returns -32600 | FR-2, AC-2, UC-2 | BDD scenario | In Progress | Covered by direct launcher only; retain until discovered runtime path passes. |
| CHK-FR2-02 | Malformed JSON is framed and recovery succeeds | FR-2, AC-2, UC-2 | BDD scenario | In Progress | P0: no malformed raw JSON frame is currently sent. |
| CHK-FR3-01 | All eight tools equal direct service envelopes | FR-3, AC-3, UC-3, SCEN-MRI-003, SCEN-MRI-012 | BDD scenarios | In Progress | The bounded manager receipt proves the connected target exposes eight tools with no errors and executes the manager-owned `spec_inventory` wrapper; SCEN-MRI-003 retains all-tool direct-service envelope parity. |
| CHK-FR3-02 | Isolated payload has no source or ambient dependency | FR-3, AC-3, UC-3, SCEN-MRI-012, SCEN-MRI-013 | BDD manager-handoff scenario | In Progress | Before enrollment, the copied payload must match the repository-built `dist/manifest.json`, every manifest-listed `dist/` hash, and the externally hashed POSIX launcher; a missing `.mcp.json` must stop at payload before enrollment. |
| CHK-FR4-01 | Complete candidate binds required evidence identities | FR-4, AC-4, UC-4, SCEN-MRI-010, SCEN-MRI-011 | BDD scenario | In Progress | Pending Docker BDD proof: provenance-verified real Cucumber bytes and the meta-only mutation must fail with `META_ONLY_STREAM`; no CHK is marked Verified before that run. |
| CHK-FR4-02 | Missing transition or foreign identity fails eligibility | FR-4, AC-4, UC-4, SCEN-MRI-011 | BDD scenario outline | In Progress | Pending Docker BDD proof: exact `CucumberEvidenceError` codes/messages cover missing pickle/test-case/start/step-finish/case-finish, failed terminal step, retry-only terminal path, duplicate `testCaseFinished`, duplicate `testRunFinished`, and malformed NDJSON. |
| CHK-FR5-01 | Publish reuses verified archive without rebuilding | FR-5, AC-5, UC-5 | Integration test | Blocked | Requires real v0.3.1 tag and lifecycle receipts; no public release run yet. |
| CHK-FR5-02 | Existing mismatched asset fails closed | FR-5, AC-5, UC-5 | Integration test | Blocked | Requires real release asset state; local evaluator proof is not publication proof. |
| CHK-FR6-01 | Candidate-derived notes and advisory have current claims | FR-6, AC-6, UC-5 | Integration test | In Progress | Advisory exists; generated-release proof depends on semantic Cucumber evidence. |

## Verification Process

### How CHKs are verified

1. Each CHK traces to a BDD scenario or integration check in the same candidate run.
2. A CHK becomes Verified only when its named scenario passes from an isolated package or candidate artifact.
3. A regression returns its CHK to Blocked with the failed command and receipt identifier recorded in Notes.

### Status lifecycle

`Draft` → `In Progress` → `Verified` → `Blocked`.

### Review cadence

- Requirements stop: all CHKs are Draft.
- Implementation: CHKs move to In Progress only after their BDD scenario is authored.
- Candidate verification: every CHK is Verified or explicitly Blocked; release publication requires no Blocked CHKs.

## Summary Counts

- Total CHKs: 11
- Verified: 0
- In Progress: 9
- Draft: 0
- Blocked: 2
