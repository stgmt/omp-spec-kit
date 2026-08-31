# Requirements Index

## Traceability Matrix

| ID | Acceptance | Scenarios | Check | Task | Product state |
|---|---|---|---|---|---|
| [FR-1](FR.md#fr-1-active-project-installed-behavior) | [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-active-project-and-contained-override) | `SCEN-mri-active-project-root` | CHK-FR1-01 | MRI001_01 | SHIPPED |
| [FR-2](FR.md#fr-2-terminal-protocol-errors-and-recovery) | [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-one-error-and-process-recovery) | `SCEN-mri-terminal-json-rpc`, `SCEN-mri-malformed-json-recovery` | CHK-FR2-01 | MRI001_02 | SHIPPED |
| [FR-3](FR.md#fr-3-historical-eight-tool-installed-surface) | [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-eight-installed-handlers-and-zero-writes) | `SCEN-mri-all-tool-parity` | CHK-FR3-01 | MRI001_01 | SHIPPED |
| [FR-4](FR.md#fr-4-one-real-candidate-run) | [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-unfiltered-run-and-observed-lifecycle) | `SCEN-mri-meta-only-evidence-refusal` | CHK-FR4-01 | MRI001_03 | NEXT |
| [FR-5](FR.md#fr-5-contained-deterministic-candidate-and-same-byte-publication) | [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-publish-only-the-attested-candidate-bytes) | `SCEN-mri-artifact-mismatch-refusal`, `SCEN-mri-executable-launcher-archive`, `SCEN-mri-symlinked-evidence-refusal` | CHK-FR5-01 | MRI001_04 | NEXT |
| [FR-6](FR.md#fr-6-public-guidance-and-immutable-v032-evidence) | [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-public-history-remains-honest) | `SCEN-mri-public-communication-proof` | CHK-FR6-01 | MRI001_05 | SHIPPED |
| [FR-7](FR.md#fr-7-response-source-identity-and-root-consistency) | [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-response-source-identity-and-root-consistency) | `SCEN-mri-response-provenance`, `SCEN-mri-extension-root-consistency` | CHK-FR7-01 | MRI001_07 | NEXT |

## Verification Matrix

| CHK-ID | Requirement | Traces To | Verification Method | Status | Notes |
|---|---|---|---|---|---|
| CHK-FR1-01 | Installed active-project selection and contained override | FR-1, AC-1.1, @feature1 | BDD scenario | Verified | SCEN-mri-active-project-root; MRI001_01 |
| CHK-FR2-01 | Terminal errors and same-process recovery | FR-2, AC-2.1, @feature2 | BDD scenario | Verified | SCEN-mri-terminal-json-rpc, SCEN-mri-malformed-json-recovery; MRI001_02 |
| CHK-FR3-01 | Exact historical eight installed handlers and zero writes | FR-3, AC-3.1, @feature3 | BDD scenario | Verified | SCEN-mri-all-tool-parity; MRI001_01 |
| CHK-FR4-01 | Successful unfiltered real-producer run plus observed install and lifecycle | FR-4, AC-4.1, @feature4 | Integration test | Draft | SCEN-mri-meta-only-evidence-refusal; MRI001_03 |
| CHK-FR5-01 | Contained deterministic archive, attestation, and same-digest publication | FR-5, AC-5.1, @feature5 | Integration test | Draft | SCEN-mri-artifact-mismatch-refusal, SCEN-mri-executable-launcher-archive, SCEN-mri-symlinked-evidence-refusal; MRI001_04 |
| CHK-FR6-01 | Immutable v0.3.2 evidence and public guidance agree | FR-6, AC-6.1, @feature6 | Manual review | Verified | SCEN-mri-public-communication-proof; MRI001_05 |
| CHK-FR7-01 | Installed result provenance and one-root extension consistency | FR-7, AC-7.1, @feature7 | BDD scenario | Draft | SCEN-mri-response-provenance, SCEN-mri-extension-root-consistency; MRI001_07 |

Checks are evidence links, not a release counter. Candidate acceptance uses current run results and byte identities, never CHK status totals or `.progress.json`.
