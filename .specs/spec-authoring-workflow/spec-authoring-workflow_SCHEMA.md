# Specification Authoring Workflow Schema

This schema defines one pure Proposal operation and one mutating Apply operation for exactly one spec. Unknown fields and variants fail closed.

## Public tool names

```text
AuthoringToolName = "propose_patch" | "apply_proposed_patch"
AUTHORING_TOOL_NAMES = ["propose_patch", "apply_proposed_patch"]
```

`AUTHORING_TOOL_NAMES` is the single source for MCP registration and the current-host `.specs/**` path-policy allowlist. Internal helper compilers are ordinary functions, not tools or manifest entries.

## Scalars

```text
Sha256        = 64 lowercase hexadecimal characters
RequestId     = non-empty opaque string, max 128 bytes
ProposalId    = non-empty opaque string, max 128 bytes
SpecSlug      = canonical root-relative spec slug
RelativeDoc   = one canonical document path below that spec
Reason        = non-empty UTF-8 text, max 512 bytes
Finding       = { code, severity, document?, location?, message, repair? }
DocumentHash  = { document: RelativeDoc, sha256: Sha256 }
```

Absolute paths, raw document content, credentials, environment values, and stack traces are forbidden in safe diagnostics.

## Internal edit operations

Helpers compile to this closed union; callers may submit the generic form to `propose_patch`.

```text
EditOperation =
  | { kind: "replace_document", document, content }
  | { kind: "replace_section", document, heading, content, expectedSectionSha256? }
  | { kind: "insert_after_heading", document, heading, text, expectedSectionSha256? }
  | { kind: "append_to_section", document, heading, text, expectedSectionSha256? }
  | { kind: "rename_heading", document, heading, newHeading, expectedSectionSha256? }
  | { kind: "insert_at_eof", document, text, expectedDocumentSha256? }
  | { kind: "replace_in_section", document, heading, oldText, newText,
      replaceAll: boolean, expectedSectionSha256? }
```

Operations are normalized by document, source span, and original request order. Overlapping writes, duplicate whole-document targets, mixed specs, missing selectors, or ambiguous anchors are invalid.

## Pure proposal request and result

```text
ProposePatchRequest = {
  requestId: RequestId,
  repositoryRootFingerprint: Sha256,
  spec: SpecSlug,
  reason: Reason,
  operations: EditOperation[]
}

DocumentPreview = {
  document: RelativeDoc,
  beforeSha256: Sha256,
  afterSha256: Sha256,
  unifiedDiff: string,
  diffTruncated: false
}

Proposal = {
  proposalId: ProposalId,
  proposalSha256: Sha256,
  spec: SpecSlug,
  baseSnapshotSha256: Sha256,
  normalizedOperations: EditOperation[],
  documents: DocumentPreview[],
  affectedNodeIds: string[],
  findings: Finding[],
  complete: true
}

ProposalResult =
  | { ok: true, requestId: RequestId, proposal: Proposal }
  | { ok: false, requestId: RequestId, error: AuthoringError }
```

Proposal identity hashes the canonical request, base snapshot, normalized operations, complete previews, after-hashes, and ordered findings. Equal inputs produce equal identity. Proposal creation is pure: no target, journal, review, or transaction write is permitted. A preview that cannot fit configured bounds returns an error rather than `complete: false`.

## Apply request and result

```text
ApplyProposedPatchRequest = {
  requestId: RequestId,
  proposalId: ProposalId,
  proposalSha256: Sha256,
  expectedDocuments: DocumentHash[],
  reason: Reason,
  actorRef?: string
}

ChangedDocument = {
  document: RelativeDoc,
  beforeSha256: Sha256,
  afterSha256: Sha256
}

MutationReceipt = {
  requestId: RequestId,
  proposalId: ProposalId,
  outcome: "COMMITTED",
  reason: Reason,
  actorRef?: string,
  changedDocuments: ChangedDocument[],
  findings: Finding[]
}

ApplyResult =
  | { ok: true, receipt: MutationReceipt }
  | { ok: false, requestId: RequestId, proposalId?: ProposalId,
      error: AuthoringError }
```

Apply accepts no `operations`, `content`, or replacement bytes. The expected document set must equal the Proposal changed-document set. Equal terminal replay by `requestId` returns the same outcome without another commit; reuse with different input is `CONFLICT`.

## Error family

```text
AuthoringError = {
  code:
    | "INVALID_REQUEST"
    | "PATH_FORBIDDEN"
    | "CONFLICT"
    | "VALIDATION_FAILED"
    | "WRITE_FAILED"
    | "RECOVERY_REQUIRED"
    | "INTERNAL_ERROR",
  message: string,
  retryable: boolean,
  findings: Finding[],
  currentDocuments?: DocumentHash[],
  nextAction: string
}
```

- `INVALID_REQUEST`: malformed, unknown, mixed-spec, duplicate/overlapping, or over-bound input.
- `PATH_FORBIDDEN`: lexical, containment, linked/reparse, unsupported-document, or path-identity failure.
- `CONFLICT`: stale/mismatched Proposal or document hashes, lock timeout, path switch, or request-ID reuse.
- `VALIDATION_FAILED`: resulting-spec kernel/form/trace/anchor/link findings or unavailable mandatory validator.
- `WRITE_FAILED`: a write fault ended with the complete old generation restored.
- `RECOVERY_REQUIRED`: neither complete old nor complete new generation can be proven; next action names manual VCS/backup restore for the relative spec.
- `INTERNAL_ERROR`: unexpected failure mapped without stack, secret, body, or unrelated path disclosure.

## Path-policy decision

```text
if toolName in AUTHORING_TOOL_NAMES:
    route to the named handler
else if call is mutating and any resolved target is under canonical .specs/**:
    deny before execution
else:
    continue normal host policy
```

The allowlist decision does not bypass handler containment. `propose_patch` remains non-mutating; `apply_proposed_patch` independently validates every target.

## Apply algorithm

1. Acquire the one-spec exclusive lock within the configured bound.
2. Re-resolve root/spec/targets and reject link/reparse or identity drift.
3. Resolve the immutable Proposal and verify its hash and complete preview.
4. Require exact expected-document set and compare every current hash.
5. Rebuild the exact result from normalized operations.
6. Run the complete kernel/form/trace/anchor/link validator set.
7. Stage a complete same-filesystem generation and hash every file.
8. Recheck containment and CAS immediately before swap.
9. Replace the generation atomically for coordinated readers.
10. Return `MutationReceipt`; cleanup may not alter committed bytes.

Internal rollback may select only a complete hash-valid old or new generation. If neither is provable, stop with `RECOVERY_REQUIRED`; no public recovery request/result/state exists.

## Bounds and conservation

Implementation constants SHALL bound operations, documents, input bytes, diff bytes, findings, diagnostic bytes, and lock wait. Refusal reports observed and allowed counts. All ordering is stable. Untouched bytes, encoding, EOL style, and final-newline state are conserved; apply hashes equal the Proposal after-hashes.

## OMP 18 authoring destination

The complete authoring destination contains these proposal-first facades: propose_spec_change, apply_spec_change, propose_patch, apply_proposed_patch, apply_spec_transaction, append_to_section, insert_after_heading, insert_at_eof, replace_in_section, amend_requirement, add_acceptance_criterion, add_phase, set_entity_status, set_spec_status, set_requirement_metadata, propose_requirement_contract, propose_spec_repairs, apply_spec_repairs, delete_spec_doc, rename_spec_doc, create_spec, archive_spec, add_backlog_task, and register_incident_backlog.

Only the central proposal/apply transaction path may write bytes. Facades compile validated operations into a proposal; apply requires exact proposal and document hashes, explicit approval, containment, the one exclusive lock, and rollback. The destination activates only with the accepted OMP authority profile.
