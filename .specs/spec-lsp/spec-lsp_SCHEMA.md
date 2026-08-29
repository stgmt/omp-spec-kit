# spec-lsp Schema

This document defines the closed current profile `spec-lsp-read@1` and the separately gated future profile `spec-lsp-step@1`. The product state is `SPECIFIED`: no release record is implied by this document or by Gherkin text. The agent-facing spec API is MCP only; the LSP server is an editor or MCP-internal transport over the shared kernel.

Every object below is closed: unknown keys, missing required keys, unknown enum members and duplicate set members are invalid. `Sha256` is exactly 64 lowercase hexadecimal characters. Paths are UTF-8 repository-relative POSIX paths with no empty, `.`, `..`, absolute, drive, NUL, symlink, junction or reparse escape component.

## Profile and bounds

```ts
type LspProfile = "spec-lsp-read@1" | "spec-lsp-step@1";
type Sha256 = string;
type Rfc3339Utc = string; // exact YYYY-MM-DDTHH:mm:ss(.fraction)?Z, valid UTC instant

const LSP_LIMITS = {
  diagnosticScalars: 2_048,
  hoverScalars: 4_096,
  completionItems: 200,
  cancellationItems: 1_024,
  cancellationMilliseconds: 10,
  warmQueryP95Milliseconds: 25,
  warmQuerySamples: 100,
  coldBuildP95Milliseconds: 2_000,
  lspBundleBytes: 1_048_576,
  lspBundleGzipBytes: 358_400,
  combinedRuntimeBytes: 3_145_728,
  combinedRuntimeGzipBytes: 1_048_576,
  peakIncrementalRssBytes: 134_217_728,
} as const;
```

The 150 ms incremental-rebuild value is deliberately absent from the pass/fail constants. didSave latency is recorded but has no threshold until a separately accepted kernel incremental profile exists.

## Current initialize contract

`spec-lsp-read@1` advertises exactly:

- `textDocumentSync` for contained `.specs/**/*.md` and `.specs/**/*.feature` documents;
- `definitionProvider`;
- `referencesProvider`;
- `completionProvider`;
- `hoverProvider`;
- `documentSymbolProvider`;
- `positionEncoding: "utf-32"` when the client offers UTF-32, otherwise the negotiated/default `"utf-16"`.

`codeActionProvider`, `renameProvider`, workspace mutation and `workspace/applyEdit` are absent. A direct `textDocument/codeAction` request returns `[]` and performs zero writes, proposal changes or status transitions.

The client supplies the explicit repository root. The server canonicalizes it and accepts it only when it contains `.specs/` and neither the root nor an indexed descendant escapes through traversal, symlink, junction or reparse indirection. A routed document outside the contained `.specs/**` set returns that method's empty result and publishes no diagnostics.

## Positions, spans and availability

```ts
interface LspSpecPositionV1 {
  schemaVersion: "spec-lsp-position@1";
  documentUri: string;
  line0: number;
  character0: number;
  positionEncoding: "utf-32" | "utf-16";
  kernelFingerprint: Sha256;
}

interface SpecLspAvailabilityStatusV1 {
  schemaVersion: "spec-lsp-availability@1";
  profile: "spec-lsp-read@1";
  state: "READY" | "KERNEL_NOT_READY" | "KERNEL_BUILD_FAILED" | "ROOT_REFUSED";
  kernelFingerprint: Sha256 | null;
  reasonCode: "NONE" | "GRAPH_ABSENT" | "GRAPH_INVALID" | "ROOT_OUTSIDE_REPOSITORY" | "ROOT_ESCAPE";
  message: string;
}
```

`line0` and `character0` are zero-based coordinates in the negotiated `positionEncoding`. Kernel lines and Unicode-scalar columns are converted exactly once: line minus one; scalar column minus one; for UTF-16, the adapter reads the exact source line and counts UTF-16 code units through that scalar boundary; for UTF-32, the zero-based scalar column is already the protocol unit. A client position is converted by the inverse rule before a kernel lookup. Non-BMP fixtures are mandatory. `SpecLspAvailabilityStatusV1` is emitted through the custom `spec/status` notification and initialization status channel; it is never encoded as an LSP diagnostic. When state is not `READY`, every semantic request returns its empty result and diagnostic publication is empty.

## Diagnostics

```ts
interface LspDiagnosticProjectionV1 {
  schemaVersion: "spec-lsp-diagnostic@1";
  kernelFingerprint: Sha256;
  code: string;
  severity: 1 | 2 | 3;
  relativePath: string;
  startLine0: number;
  startCharacter0: number;
  endLine0: number;
  endCharacter0: number;
  message: string;
  related: {
    relativePath: string;
    startLine0: number;
    startCharacter0: number;
    endLine0: number;
    endCharacter0: number;
    message: string;
  }[];
}
```

Every kernel finding for one document maps to exactly one row with the same code and semantic span. Severity mapping is closed: kernel `ERROR` → LSP `1` (Error), `WARNING` → `2` (Warning), and `INFO` → `3` (Information); LSP Hint `4` is never synthesized. `message` is at most 2,048 Unicode scalar values. Related rows are bounded by the kernel finding's own bounded related inventory. Ordering is kernel order. The adapter defines no diagnostic code, rule, severity override or filter.

## Definition and references

```ts
interface LspLocationProjectionV1 {
  schemaVersion: "spec-lsp-location@1";
  canonicalId: string;
  relativePath: string;
  startLine0: number;
  startCharacter0: number;
  endLine0: number;
  endCharacter0: number;
}
```

Definition and references return native LSP `Location[]` rendered one-to-one from these closed projections. Definition returns one unambiguous location or every candidate for an ambiguous bare ID; it never elects a candidate. References return all kernel occurrence/backlink locations and include the declaration exactly when `includeDeclaration` is true. Results use kernel canonical order.

## Completion

```ts
interface CompletionProjectionV1 {
  schemaVersion: "spec-lsp-completion@1";
  kernelFingerprint: Sha256;
  items: {
    canonicalId: string;
    nodeKind: string;
    detail: string;
    insertText: string;
  }[];
  truncated: boolean;
}
```

Items are a prefix-filtered, canonical-order subset of registered kernel IDs/aliases. At most 200 rows are returned. `truncated` is true exactly when admissible matches exceeded that bound.

## Hover

```ts
type HoverProjectionV1 =
  | {
      schemaVersion: "spec-lsp-hover@1";
      kind: "empty";
      canonicalId: null;
      content: null;
    }
  | {
      schemaVersion: "spec-lsp-hover@1";
      kind: "spec-node";
      canonicalId: string;
      content: {
        title: string;
        nodeKind: string;
        body: string;
        authoredStatus: string | null;
        taskStatus: string | null;
        truncated: boolean;
      };
    }
  | {
      schemaVersion: "spec-lsp-hover@1";
      kind: "scenario";
      canonicalId: string;
      content: {
        featureName: string;
        scenarioName: string;
        scenarioKeyword: string;
        tags: string[];
        stepTexts: string[];
        truncated: boolean;
      };
    };
```

The projection is rendered deterministically into native LSP `Hover.contents`. The rendered content is at most 4,096 Unicode scalar values; `truncated` is true exactly when rendering omitted stored text. `result`, `provenance`, `freshness`, run IDs, evidence hashes and trace data are invalid fields, not nullable placeholders.

## Document symbols

```ts
interface DocumentSymbolProjectionV1 {
  schemaVersion: "spec-lsp-document-symbol@1";
  kernelFingerprint: Sha256;
  symbols: {
    canonicalId: string;
    name: string;
    symbolKind: number;
    range: [number, number, number, number];
    selectionRange: [number, number, number, number];
    parentCanonicalId: string | null;
  }[];
}
```

Rows are exact kernel nodes/headings in source order. `range` tuples are `[startLine0,startCharacter0,endLine0,endCharacter0]`. No adapter-only synthetic symbol is permitted.

## Normalized adapter parity

```ts
type LspKernelProjectionItemV1 =
  | { kind:"diagnostic"; code:string; severity:1|2|3; relativePath:string; scalarRange0:[number,number,number,number]; message:string; related:{relativePath:string;scalarRange0:[number,number,number,number];message:string}[] }
  | { kind:"location"; canonicalId:string; relativePath:string; scalarRange0:[number,number,number,number] };

interface LspKernelProjectionV1 {
  schemaVersion: "lsp-kernel-projection@1";
  operation: "diagnostics" | "definition" | "references";
  corpusFingerprint: Sha256;
  kernelFingerprint: Sha256;
  items: LspKernelProjectionItemV1[];
}
```

CHK-FR8-01 converts both kernel and LSP answers to this carrier, normalizes both sides to zero-based Unicode-scalar spans (independent of negotiated LSP encoding), converts file URIs to repository-relative paths, and sorts by kernel canonical order. It removes only JSON-RPC ID, server name, request timing and URI transport syntax. It does not remove, rewrite or reorder semantic items. Canonical JSON bytes of the two normalized carriers must be identical.

## Rebuild and concurrency

The current profile performs the existing bounded full kernel snapshot rebuild on in-scope didSave. The shared OMP broker may have concurrent clients, but one completed immutable kernel snapshot is published atomically; requests observe either the prior or next complete fingerprint, never a partial graph. The adapter holds no mutation lock and stores no second persistent graph. Cancellation is checked at least every 1,024 processed items or 10 ms of monotonic time, whichever occurs first.

## Future step profile

`spec-lsp-step@1` is ineligible until `kernel-step-bindings@1` and `spec-kernel:CHK-FR15-01` pass. Then CHK-FR7-02 must prove:

- one-to-one `STEP_UNDEFINED` / `STEP_AMBIGUOUS` diagnostic projection;
- definition from a Gherkin step to the kernel `STEP_BINDING` target through `BINDS_STEP`;
- zero adapter-side pattern parsing, matching or step-source scanning.

The future profile retains every current read-profile requirement. It has no relation to CHK-FR12-01, which remains the current-profile absence proof.

## Release evidence

Canonical release JSON uses UTF-8, lexicographically sorted object keys, NFC strings, POSIX-relative paths, and schema-declared array order. Every evidence reference resolves to one unique contained `LspEvidenceDocumentV1`; the evaluator re-hashes bytes before parsing.

```ts
type LspCurrentCheckId =
  | "CHK-FR1-01" | "CHK-FR2-01" | "CHK-FR3-01" | "CHK-FR4-01"
  | "CHK-FR5-01" | "CHK-FR6-01" | "CHK-FR7-01" | "CHK-FR8-01"
  | "CHK-FR9-01" | "CHK-FR10-01" | "CHK-FR11-01" | "CHK-FR12-01"
  | "CHK-FR9-02" | "CHK-FR11-02" | "CHK-FR9-03"
  | "CHK-FR10-02" | "CHK-FR10-03" | "CHK-FR11-03"
  | "CHK-FR3-02";

type LspReleaseBlockerCode =
  | "RECORD_MISSING" | "RECORD_EXTRA" | "RECORD_DUPLICATE" | "RECORD_FAILED"
  | "RECORD_STALE" | "RECORD_REVOKED" | "CANDIDATE_MISMATCH" | "KERNEL_MISMATCH"
  | "CORPUS_MISMATCH" | "EVIDENCE_DOCUMENT_MISSING" | "EVIDENCE_HASH_MISMATCH"
  | "KERNEL_BASELINE_INELIGIBLE" | "READ_PROFILE_INELIGIBLE" | "STEP_PROFILE_INELIGIBLE"
  | "PROFILE_PREREQUISITE_MISSING";

interface LspEvidenceDocumentV1 { path:string; bytesBase64:string; sha256:Sha256 }
interface LspEvidenceRefV1 { path:string; sha256:Sha256; claim:string }

interface KernelBaselineAdmissionV1 {
  schemaVersion: "spec-lsp-kernel-baseline-admission@1";
  result: KernelReleaseEligibility; // exact spec-kernel SCHEMA-13 type, unmodified
  kernelFingerprint: Sha256;
  validUntil: Rfc3339Utc;
  revokedAt: Rfc3339Utc | null;
}

interface LspCheckRecordV1 {
  schemaVersion: "spec-lsp-check@1";
  checkId: LspCurrentCheckId;
  status: "PASS" | "FAIL";
  candidateArtifactSha256: Sha256;
  kernelBaselineSha256: Sha256;
  kernelFingerprint: Sha256;
  corpusFingerprint: Sha256;
  evidence: LspEvidenceRefV1[];
  producer: string;
  observedAt: Rfc3339Utc;
  validUntil: Rfc3339Utc;
  revokedAt: Rfc3339Utc | null;
}

interface LspReadReleaseManifestV1 {
  schemaVersion: "spec-lsp-release@1";
  profile: "spec-lsp-read@1";
  candidateRevision: string;
  candidateArtifactSha256: Sha256;
  kernelBaselineSha256: Sha256;
  kernelFingerprint: Sha256;
  corpusFingerprint: Sha256;
  evaluationTime: Rfc3339Utc;
  kernelBaseline: KernelBaselineAdmissionV1;
  evidenceDocuments: LspEvidenceDocumentV1[];
  records: LspCheckRecordV1[];
}

interface LspReadEligibilityResultV1 {
  schemaVersion: "spec-lsp-release-eligibility@1";
  profile: "spec-lsp-read@1";
  candidateRevision: string;
  candidateArtifactSha256: Sha256;
  kernelBaselineSha256: Sha256;
  kernelFingerprint: Sha256;
  corpusFingerprint: Sha256;
  evaluationTime: Rfc3339Utc;
  eligible: boolean;
  admittedCheckIds: LspCurrentCheckId[];
  blockers: { code:LspReleaseBlockerCode; checkId:LspCurrentCheckId|null; detail:string }[];
  evidenceFingerprint: Sha256;
}
```

The current required set is exactly the twelve `CHK-FR1-01` through `CHK-FR12-01` IDs plus the seven listed NFR-bound IDs, each exactly once and in the declared order. The wrapper must contain an exact unmodified `KernelReleaseEligibility` with targetStage `v0.2`, evidenceProfile `kernel-v0.2`, `eligible:true`, matching `artifactSha256`, nonempty required/passed checks, empty blocking and a real kernel evidence fingerprint; wrapper validity/revocation and kernel fingerprint are LSP-local fields. Every PASS record is current only when `observedAt <= evaluationTime <= validUntil`, `revokedAt == null`, all candidate/kernel/corpus identities match, every PASS record has at least one evidence reference, and every reference resolves/re-hashes decoded base64 bytes. CHK-FR12-01 proves no cucumber server, step diagnostics, or oracle requirement.

`evidenceFingerprint` is SHA-256 of canonical JSON `{schemaVersion,profile,candidateRevision,candidateArtifactSha256,kernelBaselineSha256,kernelFingerprint,corpusFingerprint,evaluationTime,kernelBaseline,evidenceDocuments:[{path,sha256}],records}` with documents path-sorted, records in required-check order, and refs sorted by `(path,sha256,claim)`. Raw bytes and result fields are excluded. Missing/extra/duplicate/failed/stale/revoked/mismatched/unbound input yields deterministic sorted blockers; `eligible=true` requires all nineteen PASS rows, eligible baseline and zero blockers.

## Future step release

```ts
interface KernelStepAdmissionV1 {
  schemaVersion: "spec-lsp-kernel-step-admission@1";
  result: KernelCapabilityEligibilityV2; // exact spec-kernel SCHEMA-14 type, unmodified
  kernelBaselineSha256: Sha256;
  kernelFingerprint: Sha256;
  corpusFingerprint: Sha256;
  evidence: LspEvidenceRefV1[];
  validUntil: Rfc3339Utc;
  revokedAt: Rfc3339Utc | null;
}

interface LspStepCheckRecordV1 {
  schemaVersion: "spec-lsp-step-check@1";
  checkId: "CHK-FR7-02";
  status: "PASS" | "FAIL";
  candidateArtifactSha256: Sha256;
  kernelBaselineSha256: Sha256;
  kernelFingerprint: Sha256;
  corpusFingerprint: Sha256;
  evidence: LspEvidenceRefV1[];
  validUntil: Rfc3339Utc;
  revokedAt: Rfc3339Utc | null;
}

interface LspStepReleaseManifestV1 {
  schemaVersion: "spec-lsp-step-release@1";
  profile: "spec-lsp-step@1";
  candidateRevision: string;
  candidateArtifactSha256: Sha256;
  kernelBaselineSha256: Sha256;
  kernelFingerprint: Sha256;
  corpusFingerprint: Sha256;
  evaluationTime: Rfc3339Utc;
  readEligibility: { document:LspEvidenceDocumentV1; parsed:LspReadEligibilityResultV1 };
  kernelStepAdmission: KernelStepAdmissionV1;
  lspStepCheck: LspStepCheckRecordV1;
  evidenceDocuments: LspEvidenceDocumentV1[];
}

interface LspStepEligibilityResultV1 {
  schemaVersion: "spec-lsp-step-release-eligibility@1";
  profile: "spec-lsp-step@1";
  candidateRevision: string;
  candidateArtifactSha256: Sha256;
  kernelBaselineSha256: Sha256;
  kernelFingerprint: Sha256;
  corpusFingerprint: Sha256;
  evaluationTime: Rfc3339Utc;
  eligible: boolean;
  blockers: { code:LspReleaseBlockerCode; checkId:"CHK-FR7-02"|"spec-kernel:CHK-FR15-01"|null; detail:string }[];
  evidenceFingerprint: Sha256;
}
```

The evaluator decodes/re-hashes `readEligibility.document.bytesBase64`, requires it to parse byte-for-byte to the supplied `readEligibility.parsed`, and requires `parsed.eligible == true` plus exact candidate/kernel/corpus identity. Kernel admission must wrap an exact eligible `KernelCapabilityEligibilityV2` for profile `kernel-step-bindings@1` with required/passed checks `CHK-FR13-02`,`CHK-FR15-01`, matching candidate/baseline and empty blockers; it and the local step check must be unrevoked/unexpired and carry the same candidate/baseline/kernel/corpus tuple with nonempty rehashed evidence. Any mismatch, stale/revoked record, ineligible read/kernel result, or missing evidence produces an ineligible step result. The step result repeats explicit evaluationTime, and its fingerprint uses the same canonical algorithm over all identities plus evaluationTime, the read-result document hash, kernel/local records and evidence document hashes. Evidence from another candidate/corpus/kernel cannot replay.
