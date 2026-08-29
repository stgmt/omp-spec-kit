# User Stories

### User Story 1: Active-project MCP results (Priority: P1)

As an OMP user, I want the installed MCP plugin to read the project from which I started OMP, so that its answers describe my specifications rather than an empty plugin folder.
**Требование:** [FR-1](FR.md#fr-1-active-project-mcp-root).

**Why:** A successful-looking empty result makes the product untrustworthy and hides a release defect from the person who needs the data.

**Independent Test:** `SCEN-mri-active-project-root` installs the built package in project-a with no root override and proves that `spec_overview` returns project-a data but excludes package-decoy and project-b data.

**Acceptance Scenarios:**

Given project-a, project-b, and the package folder each contain distinct `.specs` fixtures
When a fresh OMP process discovers the installed v0.3.2 MCP server from project-a without `OMP_SPEC_KIT_ROOT`
Then every returned envelope describes project-a and contains neither package-decoy nor project-b identifiers

Given a caller explicitly supplies a validated absolute `OMP_SPEC_KIT_ROOT`
When the server starts from a different current directory
Then it reads only that explicit root and does not reinterpret a bare environment-variable name as a path

---

### User Story 2: Standards-compliant MCP failures (Priority: P1)

As an MCP client integrator, I want malformed requests to receive a terminal protocol response, so that my client does not wait indefinitely for an answer.
**Требование:** [FR-2](FR.md#fr-2-terminal-json-rpc-protocol-responses).

**Why:** Silent protocol drops look like network hangs and are materially harder to diagnose than a precise JSON-RPC error.

**Independent Test:** `SCEN-mri-terminal-json-rpc` sends raw newline-delimited JSON-RPC frames to the built server and checks response count, id, code, and complete stdout framing.

**Acceptance Scenarios:**

Given a running installed server
When a request with `jsonrpc: "1.0"` and id `7` is sent
Then the server emits exactly one JSON-RPC `-32600` response with id `7`

Given a running installed server
When malformed JSON, an unknown method, or an unknown tool is sent
Then the server emits exactly one JSON-RPC `-32700`, `-32601`, or `-32602` response with the required id and no non-protocol stdout

---

### User Story 3: Evidence-bound release (Priority: P1)

As a release maintainer, I want publishing to consume the exact archive that verification inspected, so that a green check cannot release different or unproven bytes.
**Требование:** [FR-3](FR.md#fr-3-installed-package-all-tool-parity), [FR-4](FR.md#fr-4-candidate-bound-lifecycle-eligibility), [FR-5](FR.md#fr-5-artifact-only-publication).

**Why:** A version label or successful workflow job is not evidence that the delivered package, tag, lifecycle, and release assets agree.

**Independent Test:** `SCEN-mri-artifact-mismatch-refusal`, `SCEN-mri-public-eligibility-separation`, and the bound v0.3.2 release-status digests jointly prove that verified candidate identity is preserved through publication.

**Acceptance Scenarios:**

Given a v0.3.2 candidate has all current required receipts and a matching peeled tag commit
When the evaluator checks its archive and receipt digests
Then it marks the candidate eligible and publish consumes that same archive

Given any candidate identity or required post-0.1 lifecycle receipt differs or is absent
When release eligibility runs
Then it blocks publication with a specific reason

---

### User Story 4: Honest public release status (Priority: P2)

As an existing user, I want the v0.3.0 issue and v0.3.2 fix described plainly, so that I know whether to upgrade and do not rely on stale claims.
**Требование:** [FR-6](FR.md#fr-6-honest-release-communication).

**Why:** Documentation is the operational interface for installation and recovery; stale release notes create support cost and bad decisions.

**Independent Test:** `SCEN-mri-public-communication-proof` validates generated v0.3.2 notes and documentation against the verified candidate version/evidence and checks the v0.3.0 advisory target.

**Acceptance Scenarios:**

Given v0.3.0 remains historically published
When a user opens its release page or advisory
Then it is marked superseded for the MCP root defect and directs the user to v0.3.2

Given v0.3.2 has passed all release gates
When public notes are rendered
Then they name the current version, MCP surface, evidence status, and fresh-session requirement without v0.1-only claims

---

### User Story 5: Proven upgrade and rollback (Priority: P1)

As a release maintainer, I want v0.3.2 eligibility to require observed upgrade and rollback receipts, so that a release cannot be called recoverable from a job summary alone.

**Требование:** [FR-4](FR.md#fr-4-candidate-bound-lifecycle-eligibility).

**Why:** The prior release deferred the exact cross-version behavior this patch must prove.

**Independent Test:** `SCEN-mri-lifecycle-receipt-refusal` rejects a missing, foreign, or mismatched upgrade/rollback receipt before eligibility.

**Acceptance Scenarios:**

Given an evidence record is missing upgrade or rollback
When candidate eligibility is evaluated
Then it is ineligible with a lifecycle blocking reason

---

### User Story 6: One verified archive reaches users (Priority: P1)

As a release maintainer, I want publish to recheck the downloaded candidate archive, so that it cannot rebuild or substitute bytes after verification.

**Требование:** [FR-5](FR.md#fr-5-artifact-only-publication).

**Why:** A tag and a successful job do not prove which archive reached users.

**Independent Test:** `SCEN-mri-artifact-mismatch-refusal` tampers with the archive and observes release eligibility fail before release mutation.

**Acceptance Scenarios:**

Given a verified candidate archive exists
When its bytes differ at publish verification
Then publish is refused without a release mutation
