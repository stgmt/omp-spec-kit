# User Stories

## User Story 1: Active-project answers

- **Priority:** P1
**Требование:** [FR-1](FR.md#fr-1-active-project-installed-behavior)
- **Why:** Empty package-local answers look valid while describing the wrong repository.
- **Independent Test:** `SCEN-mri-active-project-root` launches the installed package from project-a and excludes project-b and package decoys.
- **Acceptance Scenario:** Given distinct projects, when OMP starts from project-a, then every answer comes from project-a; a validated absolute override may select project-b.

## User Story 2: Recoverable protocol errors

- **Priority:** P1
**Требование:** [FR-2](FR.md#fr-2-terminal-protocol-errors-and-recovery)
- **Why:** A silent invalid frame makes clients wait indefinitely.
- **Independent Test:** `SCEN-mri-terminal-json-rpc` and `SCEN-mri-malformed-json-recovery` send raw frames and then a valid call on the same process.
- **Acceptance Scenario:** Given a running server, when an invalid request is sent, then one terminal JSON-RPC error is returned and the next valid call succeeds.

## User Story 3: Historical eight-tool package

- **Priority:** P1
**Требование:** [FR-3](FR.md#fr-3-historical-eight-tool-installed-surface)
- **Why:** A descriptor list does not prove installed handlers work.
- **Independent Test:** `SCEN-mri-all-tool-parity` calls every historical v0.3.2 MCP tool from an isolated package copy.
- **Acceptance Scenario:** Given no source checkout or ambient dependency ancestry, when all eight tools are called, then each returns a complete result for the pinned corpus and the corpus remains unchanged.

## User Story 4: One real candidate run

- **Priority:** P1
**Требование:** [FR-4](FR.md#fr-4-one-real-candidate-run)
- **Why:** Hand-authored receipts and job summaries can be green without exercising the release journey.
- **Independent Test:** A future candidate uses one unfiltered Docker Cucumber Message run plus fresh-session install, upgrade, rollback, and reinstall observations.
- **Acceptance Scenario:** Given a clean candidate, when the unfiltered profile runs, then every named observable group passes; scoped, failed, malformed, or meta-only output cannot replace the trusted run.

## User Story 5: Same verified bytes reach users

- **Priority:** P1
**Требование:** [FR-5](FR.md#fr-5-contained-deterministic-candidate-and-same-byte-publication)
- **Why:** Rebuilding during publication breaks the identity proven by verification.
- **Independent Test:** `SCEN-mri-artifact-mismatch-refusal`, `SCEN-mri-executable-launcher-archive`, and `SCEN-mri-symlinked-evidence-refusal` cover candidate identity, executable mode, containment, and mutation refusal.
- **Acceptance Scenario:** Given a verified archive, when publish downloads it, then its digest must still match; otherwise no release mutation occurs.

## User Story 6: Honest immutable history

- **Priority:** P2
**Требование:** [FR-6](FR.md#fr-6-public-guidance-and-immutable-v032-evidence)
- **Why:** Installation and recovery guidance is part of the operational product.
- **Independent Test:** `SCEN-mri-public-communication-proof` reads the bounded v0.3.2 record and public guidance.
- **Acceptance Scenario:** Given the public v0.3.2 record, when identities are reconciled, then release notes, archive identity, current guidance, and the v0.3.0 advisory agree without claiming a fresh rerun.


## User Story 7: Know which project produced an answer

- **Priority:** P1
**Требование:** [FR-7](FR.md#fr-7-response-source-identity-and-root-consistency)
- **Why:** A valid result from another project can look identical to a current-project result when the tool omits its source identity.
- **Independent Test:** `SCEN-mri-response-provenance` and `SCEN-mri-extension-root-consistency` run the installed stdio server and OMP extension with separate cwd and absolute-root inputs.
- **Acceptance Scenario:** Given an active project and an explicit project override, when the installed read surfaces return results, then every result names the server, carries one resolved/active root identity pair, and visibly marks a mismatch.
