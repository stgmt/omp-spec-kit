# Spec Authoring Workflow Schema

## Status and conventions

Schema version is `1`. This is a planned contract, not an implemented API. JSON names below are normative. Unknown fields fail closed unless a future schema explicitly marks an extension map. Hashes are lowercase 64-character SHA-256 hex. Timestamps are RFC 3339 UTC. Canonical node IDs use `<spec-slug>:<local-id>`; document paths are root-relative POSIX-form strings even on Windows.

## Common scalars

```text
SchemaVersion = 1
RequestId = non-empty UUID or 128-bit collision-resistant caller id
ProposalId = non-empty opaque id derived from canonical proposal hash
TransactionId = non-empty opaque id
SpecSlug = lowercase kebab-case, 1..80 characters
CandidateId = lowercase ASCII letter/digit/hyphen, 1..80 characters, no leading/trailing hyphen
DocumentName = one canonical document filename
Sha256 = /^[0-9a-f]{64}$/
CanonicalId = <spec-slug>:<local-id>, exactly one ':' separator
Reason = trimmed non-empty UTF-8 string, max 1000 bytes
ActorRef = opaque authenticated subject reference, max 256 bytes
RecoveryAuthorizationRef = opaque host-issued authorization bound to actor, reason digest, transaction, root fingerprint, target spec, recovery mode, selected retained generation or root-contained rebaseline candidate fingerprint, maximum 15 documents, expected blocked-current/journal/retained-assessment hashes, and expiry; max 512 bytes
TransactionState = PREPARING | PREPARED | COMMITTING | COMMITTED | ROLLING_BACK | ROLLED_BACK | RECOVERING | RECOVERY_REQUIRED | REBASELINING | REBASELINED | FAILED_PREPARE
RecoveryMode = retained | rebaseline
```

Canonical `DocumentName` values are `README.md`, `USER_STORIES.md`, `USE_CASES.md`, `RESEARCH.md`, `REQUIREMENTS.md`, `FR.md`, `NFR.md`, `ACCEPTANCE_CRITERIA.md`, `DESIGN.md`, `TASKS.md`, `FILE_CHANGES.md`, `CHANGELOG.md`, `<spec-slug>.feature`, `FIXTURES.md`, and `<spec-slug>_SCHEMA.md`. No hidden or arbitrary filename is accepted.

## Common records

### AuthoringContext

| Field | Type | Required | Rule |
|---|---|---:|---|
| `schemaVersion` | `1` | yes | exact |
| `requestId` | `RequestId` | yes | idempotency authority |
| `actor` | `ActorRef` | yes | authenticated by host |
| `reason` | `Reason` | yes | audit reason |
| `repositoryRoot` | string | yes | explicit absolute root input; never inferred from plugin cache or CWD |
| `baseSnapshotHash` | `Sha256` | required for propose, review, apply, and task-status proposal requests | immutable kernel snapshot; retained recovery uses its selected snapshot hash; rebaseline uses explicit blocked-current and candidate snapshot hashes |
| `policyVersion` | string | yes | exact authoring policy version |

### ExpectedDocument

| Field | Type | Required | Rule |
|---|---|---:|---|
| `doc` | `DocumentName` | yes | unique per request |
| `expectedHash` | `Sha256` | yes | hash of current bytes |
| `expectedSectionHash` | `Sha256` | no | required for section-addressed mutation |

### SelectedRecoveryDocument

| Field | Type | Required | Rule |
|---|---|---:|---|
| `doc` | `DocumentName` | yes | unique and in canonical document order |
| `selectedHash` | `Sha256` | yes | exact retained bytes for the selected generation |

### CandidateRecoveryDocument

| Field | Type | Required | Rule |
|---|---|---:|---|
| `doc` | `DocumentName` | yes | unique, canonically ordered, and the entire candidate generation |
| `candidateHash` | `Sha256` | yes | exact bytes read from the authorized candidate source; no bytes appear in the request |

### Finding

| Field | Type | Required |
|---|---|---:|
| `code` | stable string | yes |
| `severity` | `error\|warning\|info` | yes |
| `lane` | `request\|path\|parse\|identity\|form\|anchor\|traceability\|status\|conformance\|transaction\|recovery\|audit\|mutation\|eligibility` | yes |
| `doc` | `DocumentName` | no |
| `canonicalId` | `CanonicalId` | no |
| `location` | `{startLine,startColumn,endLine,endColumn}` | no |
| `message` | safe string | yes |
| `evidenceRefs` | string[] | yes |
| `nextAction` | safe string | yes |

### MandatoryEvidenceEnvelope

`MandatoryAuthoringRequirementId` is the closed union `spec-authoring-workflow:FR-1 | spec-authoring-workflow:FR-2 | spec-authoring-workflow:FR-3 | spec-authoring-workflow:FR-4 | spec-authoring-workflow:FR-5 | spec-authoring-workflow:FR-6 | spec-authoring-workflow:FR-7 | spec-authoring-workflow:FR-8 | spec-authoring-workflow:FR-9 | spec-authoring-workflow:FR-10 | spec-authoring-workflow:FR-11 | spec-authoring-workflow:FR-12 | spec-kernel:FR-14 | plugin-distribution:FR-13`. `MandatoryEvidenceState` is the closed union `ACCEPTED | FAILED | MISSING | STALE | REVOKED | MISMATCH | UNVERIFIABLE`.

| Field | Type | Required | Rule |
|---|---|---:|---|
| `schemaVersion` | literal `authoring-mandatory-evidence@1` | yes | exact |
| `requirementId` | `MandatoryAuthoringRequirementId` | yes | qualified; kernel appears once per target stage |
| `state` | `MandatoryEvidenceState` | yes | only `ACCEPTED` can satisfy FR-13 |
| `producerResultSchema` | non-empty version string | yes | kernel entries must be `kernel-release-eligibility@1` |
| `eligible` | boolean or null | yes | exact kernel producer result for kernel entries; null for other producers |
| `targetStage` | `"v0.2" \| "v0.3" \| null` | yes | non-null only for kernel entries |
| `evidenceProfile` | `"kernel-v0.2" \| "kernel-v0.3" \| null` | yes | non-null only for kernel entries and must match `targetStage` |
| `candidateVersion` | non-empty version string | yes | producer candidate version |
| `productRevision` | non-empty string | yes | same authoring evaluation revision |
| `artifactLineageId` | non-empty opaque string | yes | same lineage for every mandatory entry |
| `artifactSha256` | `Sha256` | yes | artifact actually evaluated by the producer |
| `v02ParentArtifactSha256` | `Sha256 \| null` | yes | kernel v0.3 only; null otherwise |
| `kernelSnapshotHash` | `Sha256 \| null` | yes | current snapshot binding where applicable |
| `policyVersion` | non-empty string | yes | exact producer/authoring policy binding |
| `hostIdentity` | non-empty opaque string | yes | supported host binding |
| `evaluatedAt` | RFC 3339 UTC | yes | producer evaluation time |
| `validUntil` | RFC 3339 UTC | yes | evaluation is stale after this instant |
| `revokedAt` | RFC 3339 UTC or null | yes | non-null never satisfies the gate |
| `evidenceFingerprint` | `Sha256` | yes | immutable producer-result identity |

For `mandatoryEvidence`, the exact accepted multiset is fifteen envelopes: one for each authoring FR-1 through FR-12, one `plugin-distribution:FR-13`, and two `spec-kernel:FR-14` entries distinguished by target stage. The v0.2 kernel entry must contain the exact accepted producer result `targetStage:"v0.2"`, `evidenceProfile:"kernel-v0.2"`, `eligible:true`, artifact hash `A`, and `v02ParentArtifactSha256:null`. The v0.3 kernel entry must contain the exact accepted producer result `targetStage:"v0.3"`, `evidenceProfile:"kernel-v0.3"`, `eligible:true`, artifact hash `B`, and `v02ParentArtifactSha256:A`. The two evidence fingerprints are distinct. `A` and `B` may differ; hash equality is not required. Both kernel entries share `productRevision` and `artifactLineageId`; the v0.3 entry, distribution entry, and all authoring FR entries bind to the current built release candidate, current kernel snapshot where applicable, authoring policy, and supported host.

Every satisfying entry has `state:"ACCEPTED"`, `evaluatedAt <= evaluationTime <= validUntil`, and `revokedAt:null`. The evaluator rejects missing or unqualified kernel stage/profile fields, more or fewer than one entry for either stage, duplicate fingerprints, v0.3 substituted for v0.2, non-eligible/stale/revoked results, product-revision or lineage mismatch, and `v03.v02ParentArtifactSha256 != v02.artifactSha256`. It never elects a winner from duplicates and never requires the legitimate predecessor artifact hash `A` to equal current artifact hash `B`.

### UnsatisfiedEvidence

Exact fields are `{ requirementId:MandatoryAuthoringRequirementId, targetStage:"v0.2"|"v0.3"|null, code:"MISSING"|"DUPLICATE"|"UNQUALIFIED_KERNEL_PROFILE"|"WRONG_TARGET_STAGE"|"NOT_ACCEPTED"|"STALE"|"REVOKED"|"VERSION_MISMATCH"|"REVISION_MISMATCH"|"LINEAGE_MISMATCH"|"PARENT_HASH_MISMATCH"|"CURRENT_ARTIFACT_MISMATCH"|"SNAPSHOT_MISMATCH"|"POLICY_MISMATCH"|"HOST_MISMATCH"|"FINGERPRINT_COLLISION", evidenceFingerprints:Sha256[], expectedArtifactSha256:Sha256|null, observedArtifactSha256:Sha256|null, nextAction:string }`. Entries sort by qualified requirement ID, then target stage with v0.2 before v0.3 and null last, then code. A missing stage is reported as `spec-kernel:FR-14` plus that exact `targetStage`, never as an undifferentiated kernel count.

## Edit operation union

Every operation has `opId` (unique within request), `doc`, and `expectedHash`.

### replace_document

```json
{"kind":"replace_document","opId":"op-1","doc":"FR.md","expectedHash":"<sha256>","content":"<complete UTF-8 document>"}
```

`content` may be empty only when the canonical document schema permits it; deletion is not supported.

### replace_section

```json
{"kind":"replace_section","opId":"op-2","doc":"FR.md","expectedHash":"<sha256>","heading":{"canonicalId":"sample:FR-2"},"expectedSectionHash":"<sha256>","content":"<complete section body excluding heading>"}
```

### insert_after_heading

```json
{"kind":"insert_after_heading","opId":"op-3","doc":"FR.md","expectedHash":"<sha256>","heading":{"canonicalId":"sample:FR-2"},"expectedSectionHash":"<sha256>","content":"<UTF-8 insertion>"}
```

### append_to_section

```json
{"kind":"append_to_section","opId":"op-4","doc":"TASKS.md","expectedHash":"<sha256>","heading":{"text":"Deferred tasks","anchor":"deferred-tasks"},"expectedSectionHash":"<sha256>","content":"<UTF-8 append>"}
```

Heading selector must contain either one `canonicalId` or both exact `text` and kernel-generated `anchor`, never both forms.

### rename_heading

```json
{"kind":"rename_heading","opId":"op-5","doc":"FR.md","expectedHash":"<sha256>","heading":{"canonicalId":"sample:FR-2"},"expectedSectionHash":"<sha256>","newText":"FR-2: Revised title","rewriteInbound":true}
```

`rewriteInbound` must be `true` when the generated slug changes. The service expands inbound rewrites; callers may not provide a partial link list.

## Closed request union

### GetAuthoringStatusRequest

```json
{"operation":"get_authoring_status","schemaVersion":1,"requestId":"...","actor":"...","reason":"inspect readiness","repositoryRoot":"...","spec":"sample","policyVersion":"authoring-1"}
```

Read-only; no snapshot/hash required.

### ProposePatchRequest

```json
{"operation":"propose_patch","context":"AuthoringContext","operations":["EditOperation"],"limits":{"maxDocuments":15,"maxOperations":100,"maxDiffBytes":1048576,"maxDiffLines":20000,"maxFindings":1000},"requireFullPreview":true}
```

All limit values are positive integers and may only reduce server maxima.

### ReviewProposalRequest

```json
{"operation":"review_proposal","context":"AuthoringContext","proposalId":"...","proposalHash":"<sha256>","fullPreviewHash":"<sha256>","completePreviewReviewed":true}
```

The authenticated caller explicitly attests that it reviewed the complete untruncated proposal identified by `proposalId`, `proposalHash`, and `fullPreviewHash`. The request transitions only `VALIDATED→REVIEWED`; it writes no repository or transaction material. It accepts either a normal patch proposal or a `rebaseline_recovery_proposal` whose kind and bound transaction/hash identities are part of `proposalHash`. A truncated/bound-exceeded, expired, cancelled, rejected, stale, hash-mismatched, or already applying proposal refuses. There is no review override for truncation; the caller must create a fresh complete proposal.

### ApplyTransactionRequest

```json
{"operation":"apply_transaction","context":"AuthoringContext","proposalId":"...","proposalHash":"<sha256>","expectedDocuments":["ExpectedDocument"],"auditSink":null}
```

`apply_transaction` accepts no `operations`, `limits`, preview body, or replacement content. It resolves an explicitly `REVIEWED`, unexpired proposal, requires exact ID/hash identity, and requires `expectedDocuments` to match every and only proposal target with each current expected hash plus `context.baseSnapshotHash`; omission, addition, duplication, or mismatch refuses. It rechecks proposal identity and all hashes before staging and swap. It SHALL NOT create a proposal, mark it reviewed, or synthesize and commit a preview in this call. The complete canonical proposal envelope plus its host-authenticated review attestation may be supplied only through a host-resolved content-addressed reference; its hashes must match. `auditSink`, when non-null, is a host-resolved opaque sink ID, never a command/path/URL supplied for execution.

### ProposeTaskStatusRequest

```json
{"operation":"propose_task_status","context":"AuthoringContext","taskId":"sample:TASK-12","from":"in-progress","to":"done","tasksDocument":{"doc":"TASKS.md","expectedHash":"<sha256>"},"evidenceRefs":["artifact:..."]}
```

`evidenceRefs` is required and non-empty for `to: done`; for other transitions it may be empty. The reducer derives a normal read-only proposal. Applying the status change requires a separate `review_proposal` followed by `apply_transaction`; this request cannot mutate `TASKS.md`.

### CancelProposalRequest

```json
{"operation":"cancel_proposal","schemaVersion":1,"requestId":"...","actor":"...","reason":"...","repositoryRoot":"...","spec":"sample","policyVersion":"authoring-1","proposalId":"...","proposalHash":"<sha256>"}
```

Cancellation is read/control-only and does not mutate spec documents.

### RecoverTransactionRequest

```json
{"operation":"recover_transaction","context":"AuthoringContext","transactionId":"...","authorizationRef":"<host-issued>","selectedGeneration":"original","selectedSnapshotHash":"<sha256>","selectedDocuments":[{"doc":"FR.md","selectedHash":"<sha256>"}]}
```

The authenticated host authorization SHALL be unexpired and bound to the same actor, reason digest, transaction, root fingerprint, target spec, recovery mode `retained`, selected generation/hash inventory, and at most the canonical 15 documents. `selectedGeneration` is exactly `original|result`; `selectedDocuments` SHALL be the complete retained generation inventory, unique, canonically ordered, and contain hashes only. Replacement content, partial/mixed generation selection, arbitrary paths, more than 15 documents, authorization older than the host policy bound, or a selection not matching complete retained transaction material fails closed. Recovery acquires the exclusive lease, transitions `RECOVERY_REQUIRED→RECOVERING`, reruns containment and every mandatory validator on the selected bytes, audits actor/reason and hashes, and reaches `ROLLED_BACK` for original or `COMMITTED` for result. If neither retained generation is complete and valid, this operation returns `RECOVERY_SELECTION_INVALID` and directs the authorized operator to the bounded rebaseline flow below.

### ProposeRebaselineRecoveryRequest

```json
{"operation":"propose_rebaseline_recovery","context":"AuthoringContext","transactionId":"...","authorizationRef":"<host-issued>","candidateRootRelativePath":"recovery-candidates/<candidate-id>/<spec-slug>","expectedCurrentSnapshotHash":"<sha256>","expectedCurrentDocuments":["ExpectedDocument"],"expectedJournalHash":"<sha256>","expectedRetainedAssessmentHash":"<sha256>","candidateSnapshotHash":"<sha256>","candidateDocuments":["CandidateRecoveryDocument"],"limits":{"maxDocuments":15,"maxDiffBytes":1048576,"maxDiffLines":20000,"maxFindings":1000},"requireFullPreview":true}
```

This is the only request that may propose replacement of a `RECOVERY_REQUIRED` target when the hash-bound retained assessment proves neither original nor result is complete and valid. The candidate locator is root-relative, POSIX-form, confined to `recovery-candidates/<candidate-id>/<spec-slug>`, and every component SHALL be ordinary and unlinked; the service neither creates, changes, nor deletes candidate bytes. `expectedCurrentDocuments` and `candidateDocuments` SHALL each be the complete, unique, canonically ordered inventory of at most 15 canonical documents, making the proposal's before/after hashes exhaustive. The authorization SHALL be unexpired and bound to actor, reason digest, transaction, canonical root fingerprint, target spec, recovery mode `rebaseline`, candidate path/fingerprint, complete candidate inventory, expected blocked-current snapshot/document hashes, exact retained journal hash (or the coordinator's canonical missing-journal marker hash), retained-assessment hash, document/time bounds, and expiry. Under the exclusive lease the service compares all bound hashes, revalidates that neither retained original nor retained result is complete and valid regardless of corrupt or incomplete retained directory presence, reruns containment, link closure, and every mandatory validator over candidate bytes, and returns a complete untruncated dry-run proposal with full pre/post snapshot and document hashes. It writes no target, journal, candidate, recovery, or audit-history byte.

### ApplyRebaselineRecoveryRequest

```json
{"operation":"apply_rebaseline_recovery","context":"AuthoringContext","transactionId":"...","authorizationRef":"<host-issued>","proposalId":"...","proposalHash":"<sha256>","expectedCurrentSnapshotHash":"<sha256>","expectedCurrentDocuments":["ExpectedDocument"],"expectedJournalHash":"<sha256>","expectedRetainedAssessmentHash":"<sha256>","candidateSnapshotHash":"<sha256>","candidateDocuments":["CandidateRecoveryDocument"],"auditSink":null}
```

`apply_rebaseline_recovery` accepts neither document bytes nor an unreviewed/synthesized proposal. It resolves a separately `REVIEWED`, unexpired `rebaseline_recovery_proposal`, reacquires the exclusive lease, and rechecks authorization, proposal/full-preview identity, blocked-current snapshot/documents, journal or missing-marker hash, no-survivor assessment, candidate snapshot/documents, root containment, symlink/reparse absence, link closure, every validator, audit-chain head, and transaction ownership. Only an exact match may transition the proposal `REVIEWED→APPLYING→COMMITTED` while atomically installing the proposed candidate generation through transaction states `RECOVERY_REQUIRED→REBASELINING→REBASELINED`. A pre-apply drift marks the proposal `STALE`; a failure after `APPLYING` marks it `ROLLED_BACK` while the transaction returns to `RECOVERY_REQUIRED`. Every mismatch, leak/link, validation, audit, or concurrency failure exposes no candidate bytes, preserves all target/journal/recovery/candidate/history bytes, and appends only a redacted refusal event.

No `create_spec`, delete, archive, repair, backlog, phase/progress, arbitrary path, arbitrary command, raw-edit apply, same-call preview-and-commit, cross-spec request, direct recovery-byte upload, or history-erasure request exists in version 1. The fixed root-contained rebaseline candidate locator is not an arbitrary filesystem surface.

## Result union

Every response begins with:

| Field | Type | Required |
|---|---|---:|
| `ok` | boolean | yes |
| `schemaVersion` | `1` | yes |
| `requestId` | `RequestId` | yes |
| `lifecycle` | `DEFERRED\|ELIGIBLE\|IMPLEMENTED\|PROVEN` | yes |
| `audit` | `AuditEnvelope` | yes for terminal/refusal events; null only for pure status before actor authorization |

### AuthoringStatusResult

`ok: true`, `kind: "authoring_status"`, `state`, `productRevision`, `artifactLineageId`, `candidateArtifactIdentity`, `candidateArtifactSha256`, `installedArtifactIdentity|null`, `currentKernelSnapshotHash`, `policyVersion`, `hostIdentity`, `evaluationTime`, `implementationEvidence[]`, and `mandatoryEvidence: MandatoryEvidenceEnvelope[]`. `mandatoryEvidence` contains the exact fifteen-entry multiset: every qualified FR-1..FR-12 entry, current `plugin-distribution:FR-13`, one separately identified accepted `spec-kernel:FR-14` v0.2/kernel-v0.2 result, and one separately identified accepted v0.3/kernel-v0.3 result. `kernelProfileResults` is the exact projection `{ v02EvidenceFingerprint, v03EvidenceFingerprint, v02ArtifactSha256, v03ArtifactSha256, v03ParentArtifactSha256, lineageValid }`; its fingerprints resolve to the two distinct mandatory entries, `v03ParentArtifactSha256 == v02ArtifactSha256`, and `lineageValid` can be true even when the predecessor/current artifact hashes differ. The result also contains `unsatisfied: UnsatisfiedEvidence[]`, `decisionRequired[]`, `aggregation: "all"`, `registered:boolean`, and `nextAction`. Missing entries are reported, never omitted as if satisfied; duplicates do not elect a winner. Candidate implementation evidence may be present while `state: DEFERRED` and `registered: false`.

### ProposalResult

`ok: true`, `kind: "proposal"`, `proposalId`, `proposalHash`, `proposalState: VALIDATED`, `baseSnapshotHash`, `policyVersion`, `documents[]` (`doc`, `expectedHash`, `resultHash`, `eolStyle`), `operations[]`, complete untruncated `diffs[]` (`doc`, `unifiedDiff`, `truncated: false`, `omittedBytes: 0`, `omittedLines: 0`), `fullPreviewHash`, `affectedCanonicalIds[]`, `findings[]`, `createdAt`, `expiresAt`, `reviewRequired: true`, `reviewable: true`, `nextAction`. A proposal is never directly applicable until a separate matching review transition. If a complete preview exceeds bounds, `BOUND_EXCEEDED` is returned instead of a reviewable proposal.

### ReviewResult

`ok: true`, `kind: "proposal_review"`, `proposalId`, `proposalHash`, `proposalState: REVIEWED`, `fullPreviewHash`, `reviewedBy`, `reviewedAt`, `expiresAt`, `audit`, `nextAction`.

### ApplyResult

`ok: true`, `kind: "apply"`, non-null `proposalId`, `proposalHash`, `transactionId`, `transactionState: COMMITTED`, `baseSnapshotHash`, `resultSnapshotHash`, `documents[]` (`doc`, `beforeHash`, `afterHash`), `reviewedBy`, `reviewedAt`, `audit`, `committedAt`, `nextAction`. No synthesized preview is returned because the complete preview was reviewed before this request.

### StatusTransitionResult

`ok: true`, `kind: "status_transition"`, `taskId`, `previous`, `current`, `transactionId`, `beforeHash`, `afterHash`, `evidenceRefs`, `audit`, `nextAction`.

### RecoveryResult

`ok: true`, `kind: "recovery"`, `transactionId`, `selectedGeneration: original|result`, `transactionState: ROLLED_BACK|COMMITTED`, `selectedSnapshotHash`, complete `documents[]` (`doc`, `selectedHash`), `authorizedBy`, `recoveredAt`, `audit`, `nextAction`.

### RebaselineRecoveryProposalResult

`ok: true`, `kind: "rebaseline_recovery_proposal"`, `proposalId`, `proposalHash`, `proposalState: VALIDATED`, `transactionId`, `expectedCurrentSnapshotHash`, complete `currentDocuments[]` (`doc`, `expectedHash`), `expectedJournalHash`, `expectedRetainedAssessmentHash`, `candidateSourceFingerprint`, `candidateSnapshotHash`, complete `documents[]` (`doc`, `beforeHash`, `afterHash`), complete untruncated `diffs[]`, `fullPreviewHash`, `findings[]`, `authorizedBy`, `reason`, `createdAt`, `expiresAt`, `reviewRequired: true`, `reviewable: true`, `audit`, `nextAction`. It contains no candidate bytes or path and never changes the blocked transaction.

### RebaselineRecoveryResult

`ok: true`, `kind: "rebaseline_recovery"`, `proposalId`, `proposalHash`, `proposalState: COMMITTED`, `transactionId`, `transactionState: REBASELINED`, `preRebaselineSnapshotHash`, `postRebaselineSnapshotHash`, `journalHash`, `retainedAssessmentHash`, `candidateSourceFingerprint`, complete `documents[]` (`doc`, `beforeHash`, `afterHash`), `authorizedBy`, `reviewedBy`, `reason`, `rebaselinedAt`, `historyPreserved: true`, `audit`, `nextAction`.

### CancelResult

`ok: true`, `kind: "cancel"`, `proposalId`, `proposalState: CANCELLED`, `audit`, `nextAction`.

### CommittedWithAuditExportFailureResult

`ok: true`, `kind: "committed_with_audit_export_failure"`, `transactionState: COMMITTED`, all `ApplyResult` hash fields, `auditExportError`, complete redacted `audit`, `retryable: true`, and sink retry instructions. It must never use `ok:false`, because user bytes committed.

### ErrorResult

`ok: false`, `kind: "error"`, `error` as defined below, `unsatisfiedEvidence: UnsatisfiedEvidence[]`, `transactionState` when a transaction started, `proposalState` when relevant, `currentSnapshotHash` and `currentDocuments[]` when safe/relevant, `journalHash` and `retainedAssessmentHash` for rebaseline refusals, `findings[]`, `audit`, and `nextAction`. Eligibility refusals identify `spec-kernel:FR-14` with `targetStage:"v0.2"` or `"v0.3"` rather than collapsing both profiles into one count. An error claiming rollback must use `transactionState: ROLLED_BACK`; uncertain or refused recovery/rebaseline uses `RECOVERY_REQUIRED` and never returns candidate content or path.

## Error schema and closed codes

`AuthoringError` fields: `code`, safe `message`, `retryable`, `phase`, `findings[]`, `unsatisfiedEvidence: UnsatisfiedEvidence[]`, optional `currentHashes`, optional `legalNextStates`, optional `correlationId`, and `nextAction`. It forbids stack traces, environment values, document bodies, diffs, backup bytes, credentials, and unrelated absolute paths. Kernel evidence errors may disclose only qualified requirement ID, target stage/profile, evidence fingerprints, and expected/observed artifact hashes needed to diagnose the gate; they never disclose evidence bytes.

| Code | Retryable | Meaning |
|---|---:|---|
| `DEFERRED_DEPENDENCY` | after evidence changes | lifecycle gate closed; `unsatisfiedEvidence[]` reports missing/unqualified/duplicate-stage/not-current/lineage causes |
| `DECISION_REQUIRED` | after owner decision | MP-1–MP-4 or future explicit decision unresolved |
| `INVALID_REQUEST` | no | schema/field/union violation |
| `INCOMPATIBLE_SCHEMA` | no | unsupported schema version |
| `REQUEST_ID_REUSE` | no | same request ID with different canonical hash |
| `ROOT_NOT_FOUND` | after correction | selected root missing |
| `ROOT_NOT_CANONICAL` | after correction | root identity ambiguous/invalid |
| `TARGET_OUTSIDE_ROOT` | no | confinement failure |
| `ABSOLUTE_PATH` | no | absolute/drive-relative/UNC/device input |
| `PATH_TRAVERSAL` | no | dot/dotdot/escape segment |
| `PATH_COLLISION` | after rename | case/Unicode normalized collision |
| `PATH_CHANGED` | yes, fresh proposal | component changed after check |
| `SYMLINK_COMPONENT` | after repository change | root/spec-directory/target contains link/junction/mount/reparse; reads and mutation unsupported |
| `UNSUPPORTED_DOCUMENT` | no | outside canonical document set |
| `CROSS_SPEC_TRANSACTION_UNSUPPORTED` | no | more than one spec targeted |
| `DUPLICATE_TARGET` | after request correction | duplicate/conflicting operation target |
| `HASH_MISMATCH` | yes, fresh proposal | document/base CAS mismatch |
| `PROPOSAL_STALE` | yes, fresh proposal | validated proposal base changed |
| `PROPOSAL_EXPIRED` | yes, fresh proposal | expiry passed |
| `PROPOSAL_NOT_APPLICABLE` | after correction | rejected/cancelled/truncated/not validated proposal |
| `PROPOSAL_NOT_REVIEWED` | after explicit review | proposal is validated but lacks matching review attestation |
| `ANCHOR_NOT_FOUND` | yes, fresh read | selector absent |
| `ANCHOR_AMBIGUOUS` | after content correction | multiple selector matches |
| `ANCHOR_COLLISION` | after rename correction | generated slug collision |
| `ANCHOR_EXTERNAL_INBOUND` | after scoped design change | inbound link outside same-spec transaction |
| `ANCHOR_INVENTORY_INCOMPLETE` | after kernel proof | link inventory not authoritative |
| `VALIDATION_FAILED` | after content correction | error finding present |
| `VALIDATOR_UNAVAILABLE` | after service recovery | mandatory lane absent |
| `SNAPSHOT_MISMATCH` | yes, fresh proposal | validators did not share snapshot |
| `ILLEGAL_TRANSITION` | after valid transition choice | status edge absent |
| `STATUS_GUARD_FAILED` | after trace/evidence changes | status guard unsatisfied |
| `TRANSACTION_BUSY` | yes | bounded lease timeout |
| `LOCK_OWNER_LIVE` | yes | unsafe stale takeover refused |
| `WRITE_FAILED` | yes after rollback | staging/commit filesystem failure |
| `ROLLBACK_FAILED` | no automated retry | restoration not proven |
| `RECOVERY_REQUIRED` | no mutation retry | manual/deterministic recovery required first |
| `RECOVERY_AUTHORIZATION_INVALID` | after new host authorization | authorization absent, expired, mismatched, or exceeds bound |
| `RECOVERY_SELECTION_INVALID` | after exact retained selection | selected generation/document hashes are partial, mixed, unknown, or contain bytes |
| `RECOVERY_VALIDATION_FAILED` | after retained generation repair | selected retained generation fails containment or mandatory validation |
| `REBASELINE_NOT_ALLOWED` | after retained recovery or no-survivor proof | a complete retained generation exists or no-survivor assessment is absent/mismatched |
| `REBASELINE_PROPOSAL_STALE` | yes, fresh dry-run | reviewed rebaseline proposal no longer matches current/journal/candidate/audit identities |
| `JOURNAL_HASH_MISMATCH` | after operator reinspection | retained journal or canonical missing-marker hash differs |
| `REBASELINE_CANDIDATE_INVALID` | after candidate correction and fresh proposal | candidate inventory/path/hash, link closure, or mandatory validation is invalid |
| `RECOVERY_HISTORY_CONFLICT` | after history/audit repair | audit-chain head or retained recovery history changed or would be erased |
| `AUDIT_SINK_FAILED` | yes | explicit sink failed before commit |
| `MUTATION_GATE_NOT_PROVEN` | after proof | critical mutation evidence absent/red |
| `BOUND_EXCEEDED` | after smaller fresh request | complete proposal exceeds document/operation/diff/finding bound and is not reviewable |
| `INTERNAL_ERROR` | depends on state | mapped safe internal failure |

## AuditEnvelope

| Field | Type | Required |
|---|---|---:|
| `schemaVersion` | `1` | yes |
| `eventId` | opaque id | yes |
| `eventType` | `PROPOSED\|REVIEWED\|REJECTED\|APPLY_STARTED\|COMMITTED\|ROLLED_BACK\|RECOVERY_STARTED\|RECOVERED\|RECOVERY_REQUIRED\|RECOVERY_REFUSED\|REBASELINE_PROPOSED\|REBASELINE_STARTED\|REBASELINED\|REBASELINE_REFUSED\|CANCELLED\|STATUS_CHANGED\|AUDIT_EXPORT_FAILED` | yes |
| `occurredAt` | RFC 3339 UTC | yes |
| `requestId` | RequestId | yes |
| `proposalId` | ProposalId/null | yes |
| `transactionId` | TransactionId/null | yes |
| `actor` | ActorRef | yes |
| `reason` | Reason | yes |
| `rootFingerprint` | Sha256 | yes |
| `artifactIdentity` | string | yes |
| `kernelSnapshotHash` | Sha256 | yes |
| `policyVersion` | string | yes |
| `operations` | `{opId,kind,doc,beforeHash,afterHash|null}[]` | yes |
| `reviewedProposalHash` | Sha256/null | yes |
| `selectedGeneration` | `original\|result\|null` | yes |
| `selectedSnapshotHash` | Sha256/null | yes |
| `recoveryMode` | `retained\|rebaseline\|null` | yes |
| `preRecoverySnapshotHash` | Sha256/null | yes |
| `postRecoverySnapshotHash` | Sha256/null | yes |
| `journalHash` | Sha256/null | yes |
| `retainedAssessmentHash` | Sha256/null | yes |
| `candidateSourceFingerprint` | Sha256/null | yes |
| `historyPreserved` | boolean/null | yes |
| `findingCodes` | string[] | yes |
| `outcome` | string enum matching event | yes |
| `rollbackRecoveryState` | transaction state/null | yes |
| `previousEventDigest` | Sha256/null | yes |
| `eventDigest` | Sha256 | yes |

`reviewedProposalHash` is non-null for review/apply events. `selectedGeneration` and `selectedSnapshotHash` are non-null only for retained-generation recovery events. Rebaseline events set `recoveryMode: rebaseline`, complete pre/post, journal, retained-assessment, and candidate-source hashes, and `historyPreserved: true`; they never record the candidate path.

Forbidden audit fields: document `content`, unified `diff`, recovery authorization reference, secret/environment values, backup/stage/retained/candidate bytes, candidate source path, arbitrary headers/tokens, stack traces, and unrelated filesystem paths.

## State machines

### Eligibility

- While `DEFERRED`, implementation and isolated evidence production are permitted, but registration, exposed authoring actions, user-spec mutation, and release claims are forbidden.
- `DEFERRED → ELIGIBLE`: all fifteen mandatory envelopes are current and accepted: FR-1..FR-12, current `plugin-distribution:FR-13`, one `spec-kernel:FR-14` v0.2/kernel-v0.2 result, and one v0.3/kernel-v0.3 result. The kernel results are separately identified and non-revoked, share product revision/artifact lineage, and satisfy `v03.v02ParentArtifactSha256 == v02.artifactSha256`; the linked predecessor/current hashes may differ. Current-stage evidence is bound to the exact built release-candidate artifact/snapshot/policy/host, and MP-1–MP-4 are resolved.
- `ELIGIBLE → IMPLEMENTED`: the existing extension registers only the gated shared service for that same eligible artifact; no second authority exists.
- `IMPLEMENTED → PROVEN`: installed lifecycle, concurrency, rollback/recovery/rebaseline, security, and mutation gates are green for the exact artifact.
- `ELIGIBLE|IMPLEMENTED|PROVEN → DEFERRED`: any mandatory envelope becomes absent, stale, revoked, ambiguous, mismatched, red, unqualified, duplicated, wrong-target-stage, or cross-lineage; a v0.3 result never substitutes for v0.2. Actions unregister while implementation artifacts and honest evidence may remain.
- No other transition is legal.

### Proposal

- `CREATED → VALIDATED | REJECTED`
- `VALIDATED → REVIEWED | STALE | CANCELLED | EXPIRED`
- `REVIEWED → APPLYING | STALE | CANCELLED | EXPIRED`
- `APPLYING → COMMITTED | ROLLED_BACK`
- Terminal: `REJECTED`, `STALE`, `COMMITTED`, `ROLLED_BACK`, `CANCELLED`, `EXPIRED`.
Rebaseline proposals use the same proposal machine: successful atomic rebaseline leaves `proposalState: COMMITTED` and `transactionState: REBASELINED`; post-`APPLYING` refusal leaves `proposalState: ROLLED_BACK` and `transactionState: RECOVERY_REQUIRED`.

### Transaction

- `PREPARING → PREPARED | FAILED_PREPARE`
- `PREPARED → COMMITTING | ROLLING_BACK`
- `COMMITTING → COMMITTED | ROLLING_BACK | RECOVERING`
- `ROLLING_BACK → ROLLED_BACK | RECOVERY_REQUIRED`
- `RECOVERING → COMMITTED | ROLLED_BACK | RECOVERY_REQUIRED`
- `RECOVERY_REQUIRED → RECOVERING` only for a schema-valid authenticated bounded `recover_transaction` selecting a complete valid retained generation; failed authorization, hash, containment, or validation returns to `RECOVERY_REQUIRED`.
- `RECOVERY_REQUIRED → REBASELINING` only for a separately reviewed, unexpired, authenticated `apply_rebaseline_recovery` proposal after exact no-survivor, current, journal, candidate, containment/link/validation, audit-history, and lease rechecks.
- `REBASELINING → REBASELINED` only after one complete proposed generation is atomically visible and the history-preserving audit event is appended; any failure returns to `RECOVERY_REQUIRED`.
- Normal subsequent writes are allowed only after `COMMITTED`, `ROLLED_BACK`, `REBASELINED`, or `FAILED_PREPARE`; `RECOVERY_REQUIRED` and `REBASELINING` block reads/writes through the coordinator until resolved.

### Task status

- `todo → ready | blocked`
- `ready → in-progress | blocked | todo`
- `in-progress → blocked | done | ready`
- `blocked → todo | ready | in-progress`
- `done → in-progress`
- No implicit transition, self-transition, phase status, or other state exists.

## Canonicalization and digest rules

Canonical hashing uses UTF-8 JSON with lexicographically sorted object keys, array order preserved where semantically ordered, normalized path separators, exact content bytes represented by their SHA-256 rather than embedded, and time/transport fields excluded from proposal/request content hashes. Operations are sorted by canonical document order then caller `opId` only after rejecting conflicting targets. Findings are sorted by severity, lane, document, location, and code. These rules are versioned by `policyVersion`.
