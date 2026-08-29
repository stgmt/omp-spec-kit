# Requirements Index

## Traceability Matrix

| ID | Name | Linked AC | Scenario | Status |
|----|------|-----------|----------|--------|
| [FR-1](FR.md#fr-1-active-project-mcp-root) | Active-project MCP root | [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-active-project-wins-over-package-cwd) | SCEN-mri-active-project-root, SCEN-mri-executable-launcher-archive, SCEN-mri-active-project-manager-receipt, SCEN-mri-missing-payload-refusal | Delivered v0.3.2; contract revalidation In Progress |
| [FR-2](FR.md#fr-2-terminal-json-rpc-protocol-responses) | Terminal JSON-RPC protocol responses | [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-invalid-frames-are-terminal-and-framed) | SCEN-mri-terminal-json-rpc, SCEN-mri-malformed-json-recovery | Delivered v0.3.2; contract revalidation In Progress |
| [FR-3](FR.md#fr-3-installed-package-all-tool-parity) | Installed-package all-tool parity | [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-the-packaged-mcp-surface-is-complete-and-immutable) | SCEN-mri-all-tool-parity, SCEN-mri-active-project-manager-receipt, SCEN-mri-missing-payload-refusal | Delivered v0.3.2; contract revalidation In Progress |
| [FR-4](FR.md#fr-4-candidate-bound-lifecycle-eligibility) | Candidate-bound lifecycle eligibility | [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-candidate-evidence-is-complete-and-bound) | SCEN-mri-public-eligibility-separation, SCEN-mri-meta-only-evidence-refusal, SCEN-mri-semantic-cucumber-mutations, SCEN-mri-credential-mutation-refusal, SCEN-mri-synthetic-distribution-refusal, SCEN-mri-self-attested-distribution-refusal, SCEN-mri-unverified-attestation-refusal, SCEN-mri-symlinked-evidence-refusal, SCEN-mri-lifecycle-receipt-refusal | Delivered v0.3.2; contract revalidation In Progress |
| [FR-5](FR.md#fr-5-artifact-only-publication) | Artifact-only publication | [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-publish-consumes-the-verified-artifact-only) | SCEN-mri-artifact-mismatch-refusal | Delivered v0.3.2; contract revalidation In Progress |
| [FR-6](FR.md#fr-6-honest-release-communication) | Honest release communication | [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-public-status-tells-users-the-truth) | SCEN-mri-public-communication-proof | Delivered v0.3.2; contract revalidation In Progress |

## Functional Requirements

- FR-1 through FR-6 in [FR.md](FR.md).

## Non-Functional Requirements

- [Performance](NFR.md#performance), [Security](NFR.md#security), [Reliability](NFR.md#reliability), and [Usability](NFR.md#usability).

## Acceptance Criteria

- AC-1.1 through AC-6.1 in [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md).

The public v0.3.2 release remains delivered. The CHK status below tracks revalidation of this amended contract and can therefore be In Progress without retracting the bounded public release record.

## Verification Matrix (CHK)

| CHK-ID | Requirement | Traces To (FR+SC) | Verification Method | Status | Notes |
|--------|-------------|-------------------|---------------------|--------|-------|
| CHK-FR1-01 | Active/default, valid absolute override, and package-root refusal through package launcher | FR-1, AC-1.1, UC-1, SCEN-mri-active-project-root, SCEN-mri-active-project-manager-receipt, SCEN-mri-executable-launcher-archive | BDD scenario | In Progress | `MRI001_01`; manager discovery, launcher and candidate identities are bound by `release-status-v0.3.2.json`. |
| CHK-FR1-02 | Invalid root override retains active project | FR-1, AC-1.1, UC-1, SCEN-mri-active-project-root | BDD scenario | In Progress | `MRI001_01`; the release evidence binds the active-project launcher behavior. |
| CHK-FR2-01 | Identified invalid request, unknown method and unknown tool return -32600/-32601/-32602 | FR-2, AC-2.1, UC-2, SCEN-mri-terminal-json-rpc | BDD scenario | In Progress | `MRI001_04`; Docker BDD receipt digest is captured in the release-status record. |
| CHK-FR2-02 | Malformed JSON is framed and recovery succeeds | FR-2, AC-2.1, UC-2, SCEN-mri-malformed-json-recovery | BDD scenario | In Progress | `MRI001_04`; malformed-frame recovery is part of the bound Docker BDD receipt. |
| CHK-FR3-01 | All eight first-slice tools equal direct service envelopes | FR-3, AC-3.1, UC-3, SCEN-mri-all-tool-parity, SCEN-mri-active-project-manager-receipt | BDD scenario | In Progress | `MRI001_01`, `MRI001_04`; eight tools are release identity, not destination ceiling. |
| CHK-FR3-02 | Isolated payload has no source or ambient dependency | FR-3, AC-3.1, UC-3, SCEN-mri-active-project-manager-receipt, SCEN-mri-missing-payload-refusal | BDD scenario | In Progress | `MRI001_01`; package/archive digests and discovery receipt identity are captured. |
| CHK-FR4-01 | Complete candidate binds required evidence identities | FR-4, AC-4.1, UC-4, SCEN-mri-public-eligibility-separation, SCEN-mri-meta-only-evidence-refusal, SCEN-mri-credential-mutation-refusal, SCEN-mri-synthetic-distribution-refusal, SCEN-mri-self-attested-distribution-refusal, SCEN-mri-unverified-attestation-refusal, SCEN-mri-symlinked-evidence-refusal | Integration test | In Progress | `MRI001_02`, `MRI001_05`; candidate/evidence@3 identities are captured; all 18 IDs and 40 source-derived pickle executions are mandatory; bounded historical positive readback is distinguished from local negative evaluation. |
| CHK-FR4-02 | Missing transition or foreign identity fails eligibility | FR-4, AC-4.1, UC-4, SCEN-mri-semantic-cucumber-mutations, SCEN-mri-lifecycle-receipt-refusal | BDD scenario | In Progress | `MRI001_02`; exact semantic and lifecycle one-fault receipts, including every mandatory MRI scenario execution, are revalidated before Verified. |
| CHK-FR5-01 | Future publish contract forbids rebuild; bounded v0.3.2 readback proves one exact published asset identity | FR-5, AC-5.1, UC-5, SCEN-mri-artifact-mismatch-refusal | Integration test | In Progress | `MRI001_05`, `MRI001_06`; public asset SHA equals the candidate archive SHA. |
| CHK-FR5-02 | Existing mismatched asset fails closed | FR-5, AC-5.1, UC-5, SCEN-mri-artifact-mismatch-refusal | Integration test | In Progress | `MRI001_06`; release workflow identity and immutable published asset digests are captured. |
| CHK-FR6-01 | Captured published release notes plus local guidance/advisory have current bounded claims | FR-6, AC-6.1, UC-5, SCEN-mri-public-communication-proof | Manual review | In Progress | `MRI001_07`; release URL and candidate-derived public metadata are captured. |

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
- In Progress: 11
- Draft: 0
- Blocked: 0
