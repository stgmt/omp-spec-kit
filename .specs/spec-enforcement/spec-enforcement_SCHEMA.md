# spec-enforcement_SCHEMA

Current contract version is `spec-enforcement@2`. It classifies every host-visible tool by effect, delegates filesystem truth to an I/O-capable resolver, permits only the exact accepted `omp-spec-kit` authoring MCP authority, and keeps product delivery separate from capability eligibility.

## Modes

```ts
type EnforcementMode = "informational" | "enforcement" | "degraded";
```

- `informational`: kernel available, `SPEC_ENFORCEMENT` product capability not accepted; never blocks.
- `enforcement`: same-candidate product capability and authoring authority accepted; every tool is classified.
- `degraded`: product/authority binding unavailable or capability not safely initializable; visible diagnostic, no delivery claim. Kernel-only failure does not downgrade accepted write enforcement.

A live tool-registry mismatch while already in accepted enforcement mode does not create a bypass: unknown/changed tools take the conservative `UNKNOWN` policy.

`Sha256` is an exact lowercase 64-hex string.

## Canonical bytes and digests

`enforcement-canonical-json@1` is UTF-8 JSON with lexicographically sorted object keys, NFC strings, POSIX-relative paths, base-10 integers, schema-declared array order, and no undefined/non-finite values. `registrySha256`, authority `manifestSha256`, installed snapshot hash, check-receipt subject hash and release `evidenceFingerprint` are SHA-256 over those canonical bytes with the hash field itself omitted. Entries/tools/checks use their declared canonical order; evidence documents sort by `(kind,path)`, refs by `(path,sha256)`, blockers by check order/code/path. Every digest below uses this algorithm unless an external attestation explicitly names another.

## Tool effect registry

```ts
type ToolEffect =
  | "READ_ONLY"
  | "MAY_WRITE_TARGETS"
  | "SPEC_AUTHORING_AUTHORITY"
  | "UNKNOWN";

type TargetExtractor =
  | {kind:"NONE";exhaustive:true;inputSchemaSha256:Sha256}
  | {kind:"JSON_POINTERS";pointers:[string,...string[]];exhaustive:true;inputSchemaSha256:Sha256}
  | {kind:"COMMAND_EFFECTS";pointer:string;grammarVersion:"command-effects@1";exhaustive:true;inputSchemaSha256:Sha256};

type ToolAuthority = "NONE" | "omp-spec-kit:spec-authoring-workflow@1" | "omp-spec-kit:spec-authoring-workflow@2";

interface ToolEffectRegistryEntry {
  toolName: string;
  effect: Exclude<ToolEffect, "UNKNOWN">;
  targetExtractor: TargetExtractor;
  authority: ToolAuthority;
}

interface ToolEffectRegistryManifestV2 {
  schemaVersion: "tool-effect-registry@1";
  ompVersion: string;
  ompCommit: string;
  candidateArtifactSha256: string;
  entries: ToolEffectRegistryEntry[]; // unique toolName, canonical order
  registrySha256: string;
}
```

Registry invariants:

- Every entry's `inputSchemaSha256` equals the schema extracted during the candidate build into the installed registry snapshot; both manifest/snapshot hashes are recomputed. Current OMP hook input cannot prove live provider identity.
- `READ_ONLY` uses `NONE`/`NONE`; `SPEC_AUTHORING_AUTHORITY` uses `NONE` plus an exact accepted authority request.
- `MAY_WRITE_TARGETS` uses a non-empty exhaustive extractor/`NONE` authority and MUST produce at least one raw target. Zero targets is `TARGET_EXTRACTION_INCOMPLETE`/UNKNOWN, never vacuous ALLOW.
- Missing/changed name, schema digest, input shape, dynamic/incomplete target, or host-authenticated authority field classifies UNKNOWN.
- Classification is pure: it receives the complete live call/authority identity and extracts candidates but makes no filesystem claim.

`COMMAND_EFFECTS` is a versioned command grammar, not a substring/regex allowlist. Unsupported quoting, substitution, redirection, shell syntax, or computed target returns `complete:false` and therefore `UNKNOWN`.

## Authoring authority

```ts
type AuthoringFacadeV1 =
  | "propose_spec_change"
  | "apply_spec_change"
  | "propose_patch"
  | "apply_proposed_patch"
  | "apply_spec_transaction"
  | "append_to_section"
  | "insert_after_heading"
  | "insert_at_eof"
  | "replace_in_section"
  | "amend_requirement"
  | "add_acceptance_criterion"
  | "add_phase"
  | "set_entity_status"
  | "set_requirement_metadata"
  | "propose_requirement_contract"
  | "propose_spec_repairs"
  | "apply_spec_repairs";

type AuthoringFacadeV2 =
  | "set_spec_status"
  | "create_spec"
  | "archive_spec"
  | "delete_spec_doc"
  | "rename_spec_doc"
  | "add_backlog_task"
  | "register_incident_backlog";

type AuthoringFacadeV1Tuple = [
  "propose_spec_change","apply_spec_change","propose_patch","apply_proposed_patch",
  "apply_spec_transaction","append_to_section","insert_after_heading","insert_at_eof",
  "replace_in_section","amend_requirement","add_acceptance_criterion","add_phase",
  "set_entity_status","set_requirement_metadata","propose_requirement_contract",
  "propose_spec_repairs","apply_spec_repairs"
];
type AuthoringFacadeV2Tuple = [
  "set_spec_status","create_spec","archive_spec","delete_spec_doc",
  "rename_spec_doc","add_backlog_task","register_incident_backlog"
];
type AuthoringAuthorityManifestV2 =
  | {schemaVersion:"spec-authoring-authority@1";serverId:"omp-spec-kit";profile:"spec-authoring-workflow@1";candidateArtifactSha256:Sha256;toolNames:AuthoringFacadeV1Tuple;serviceRequestSchemaSha256:Sha256;manifestSha256:Sha256}
  | {schemaVersion:"spec-authoring-authority@2";serverId:"omp-spec-kit";profile:"spec-authoring-workflow@2";candidateArtifactSha256:Sha256;baseV1ManifestSha256:Sha256;toolNames:AuthoringFacadeV2Tuple;serviceRequestSchemaSha256:Sha256;manifestSha256:Sha256};

A V2 capability is additive: its exact seven-name manifest references the exact
accepted V1 manifest; neither tuple may be a subset/mix/reordered list.

## Host authority ABI and pure classification

Pinned OMP v17.3.7 `ToolCallEvent` supplies only `toolName` and `input`; it cannot authenticate provider/server/schema identity. Therefore accepted enforcement is `DEFERRED_HOST_ABI` until a later pinned host emits this non-model-controlled envelope:

```ts
interface HostToolAuthorityAbiV1 {
  schemaVersion:"tool-call-authority-abi@1";
  ompVersion:string;
  ompCommit:string;
  eventName:"tool_call";
  providerKind:"mcp"|"extension"|"builtin";
  serverId:string|null;
  toolName:string;
  inputSchemaSha256:Sha256;
  registrySnapshotSha256:Sha256;
  sourceReceiptSha256:Sha256; // source + behavior proof for the exact host artifact
}
interface InstalledToolRegistrySnapshotV2 {
  schemaVersion:"installed-tool-registry@2";
  candidateArtifactSha256:Sha256;
  effectRegistrySha256:Sha256;
  authoringManifestSha256:Sha256;
  tools:{toolName:string;providerKind:"mcp"|"extension"|"builtin";serverId:string|null;inputSchemaSha256:Sha256}[];
  sha256:Sha256;
}
interface ToolClassificationRequestV2 {
  schemaVersion:"tool-classification-request@2";
  registry:ToolEffectRegistryManifestV2;
  installedRegistry:InstalledToolRegistrySnapshotV2;
  hookCall:{toolName:string;input:unknown};
  hostAuthority:HostToolAuthorityAbiV1|null;
  authoringManifests:AuthoringAuthorityManifestV2[];
}

interface ToolClassificationV2 {
  schemaVersion: "tool-classification@2";
  toolName: string;
  effect: ToolEffect;
  authority: ToolAuthority;
  rawTargets: string[];
  complete: boolean;
  registrySha256: Sha256;
  installedRegistrySha256: Sha256;
  code: "CLASSIFIED" | "UNKNOWN_TOOL" | "INPUT_SHAPE_MISMATCH" | "TARGET_EXTRACTION_INCOMPLETE" | "AUTHORITY_MISMATCH" | "AUTHORITY_ABI_UNAVAILABLE";
}
```

At `session_start`, the adapter may re-hash the candidate-bundled static registry/authoring manifests, but that proves expected package bytes only. It SHALL NOT call that a live host registry. In enforcement mode every call requires a hostAuthority envelope whose tool name/schema/snapshot match the installed snapshot. `SPEC_AUTHORING_AUTHORITY` additionally requires `providerKind:"mcp"`, `serverId:"omp-spec-kit"`, exact accepted @1 or additive @2 manifest membership, candidate hash and service-schema hash. Null/mismatched authority returns UNKNOWN/AUTHORITY_ABI_UNAVAILABLE or AUTHORITY_MISMATCH and conservatively blocks. On pinned v17.3.7 activation is impossible; informational/degraded mode remains non-blocking and honest.

## Filesystem-backed target resolution

```ts
interface TargetResolutionRequestV2 {
  schemaVersion: "spec-target-resolution@1";
  projectRoot: string;
  rawTargets: [string, ...string[]];
  maxTargets: number;       // <= 64
  deadlineMs: number;       // <= 5,000
}

type TargetClass = "SPEC" | "NON_SPEC" | "INDETERMINATE";

interface ResolvedTargetV2 {
  inputOrdinal: number;
  repositoryRelativePath: string | null;
  classification: TargetClass;
  code:
    | "UNDER_SPECS"
    | "OUTSIDE_SPECS"
    | "OUTSIDE_PROJECT"
    | "TRAVERSAL_REFUSED"
    | "SYMLINK_REFUSED"
    | "REPARSE_POINT_REFUSED"
    | "ANCESTOR_UNRESOLVED"
    | "FILESYSTEM_ERROR";
}

interface TargetResolutionResultV2 {
  schemaVersion: "spec-target-resolution-result@1";
  complete: boolean;
  targets: ResolvedTargetV2[];
  diagnostic: EnforcementDiagnosticV2 | null;
}
```

The resolver performs lexical normalization, canonical project-root resolution, lstat/realpath checks, Windows reparse-point/POSIX symlink refusal, and nearest-existing-ancestor resolution for a target that does not yet exist. It emits repository-relative paths only. Any unresolved target makes the result incomplete; the decision cannot treat it as non-spec.

## Decision contract

```ts
type EnforcementDecisionCode =
  | "KNOWN_READ_ONLY"
  | "AUTHORING_AUTHORITY_ALLOWED"
  | "PROVEN_NON_SPEC_TARGETS"
  | "RAW_SPEC_WRITE"
  | "TARGET_INDETERMINATE"
  | "AUTHORITY_MISMATCH";

interface EnforcementDecisionV2 {
  schemaVersion: "spec-enforcement-decision@2";
  decision: "ALLOW" | "BLOCK";
  code: EnforcementDecisionCode;
  toolName: string;
  effect: ToolEffect;
  targets: ResolvedTargetV2[];
  redirectAuthority: "omp-spec-kit:spec-authoring-workflow" | null;
  reason: string | null; // required for BLOCK, <= 4 KiB UTF-8
}

interface EnforcementBlockResult {
  block: true;
  reason: string;
}
```

In `enforcement` mode:

1. exact accepted `SPEC_AUTHORING_AUTHORITY` -> ALLOW;
2. known `READ_ONLY` -> ALLOW;
3. exhaustive writer with every target `NON_SPEC` -> ALLOW;
4. any `SPEC` target -> BLOCK `RAW_SPEC_WRITE` with the qualified authoring MCP redirect;
5. `UNKNOWN`, incomplete extraction, authority mismatch, containment ambiguity, resolver failure, or mixed incomplete result -> BLOCK `TARGET_INDETERMINATE`/`AUTHORITY_MISMATCH`.

Informational mode never blocks. It may render the would-block decision as a diagnostic but cannot call it enforced.

## Diagnostic and context records

```ts
type EnforcementDiagnosticCode =
  | "KERNEL_UNAVAILABLE"
  | "KERNEL_VERSION_MISMATCH"
  | "KERNEL_QUERY_FAILED"
  | "PRODUCT_GATE_UNAVAILABLE"
  | "PRODUCT_CANDIDATE_MISMATCH"
  | "AUTHORING_AUTHORITY_MISMATCH"
  | "TOOL_REGISTRY_MISMATCH"
  | "TARGET_INDETERMINATE"
  | "HANDLER_EXCEPTION"
  | "HANDLER_TIMEOUT"
  | "DIAGNOSTIC_RENDER_FAILED"
  | "CENSUS_RENDER_FAILED"
  | "HOOK_LOAD_FAILED";

interface EnforcementDiagnosticV2 {
  schemaVersion: "spec-enforcement-diagnostic@2";
  code: EnforcementDiagnosticCode;
  message: string;       // <= 1,024 Unicode scalar values
  component: "kernel" | "product-gate" | "registry" | "authority" | "resolver" | "handler";
  repositoryRelativePath: string | null;
}

interface KernelFindingAdditionV2 {
  type: "text";
  source: "spec-kernel:FR-6";
  text: string;          // <= 2 KiB UTF-8
}

interface CensusMessageV2 {
  role: "system";
  content: [{ type: "text"; text: string }]; // <= 4 KiB UTF-8
}
```

Kernel findings and enforcement-policy diagnostics are distinct. A policy diagnostic cannot be labeled `spec-kernel:FR-6` or claim spec conformance. Records are session-local only, at most 50 records/64 KiB with oldest-first eviction.

## Session gate binding

```ts
interface EnforcementSessionBindingV2 {
  schemaVersion: "spec-enforcement-session@2";
  mode: EnforcementMode;
  productCandidateSha256: Sha256;
  productCapability: "SPEC_ENFORCEMENT";
  productCapabilityEvidenceSha256: Sha256;
  authoringAuthorityManifestSha256: Sha256;
  toolRegistryManifestSha256: Sha256;
  installedRegistrySha256: Sha256;
  hostAuthorityAbiEvidenceSha256: Sha256 | null;
  registryMatchesCandidate: boolean;
  hostAuthorityAvailable: boolean;
  kernelAvailable: boolean;
}
```

Product/candidate/authority/installed-registry mismatch prevents activation. An accepted host authority ABI receipt is mandatory; without it state is `DEFERRED_HOST_ABI`. In accepted enforcement, snapshot/event mismatch makes unmatched tools UNKNOWN and kernel unavailability disables only kernel finding/census projection; raw-write classification remains active. Before product acceptance, informational/degraded behavior never claims enforcement.

## Release evidence

```ts
type EnforcementCandidateCheckId =
  | "CHK-FR1-01" | "CHK-FR2-01" | "CHK-FR2-02" | "CHK-FR3-01"
  | "CHK-FR4-01" | "CHK-FR5-01" | "CHK-FR6-01" | "CHK-FR7-01"
  | "CHK-FR8-01" | "CHK-FR9-01" | "CHK-FR10-01" | "CHK-FR10-02";
type EnforcementRequirementId="spec-enforcement:FR-1"|"spec-enforcement:FR-2"|"spec-enforcement:FR-3"|"spec-enforcement:FR-4"|"spec-enforcement:FR-5"|"spec-enforcement:FR-6"|"spec-enforcement:FR-7"|"spec-enforcement:FR-8"|"spec-enforcement:FR-9"|"spec-enforcement:FR-10";
type EnforcementEvidenceKind="PRODUCT_BASELINE"|"AUTHORING_CAPABILITY"|"HOST_AUTHORITY_ABI"|"INSTALLED_REGISTRY"|"AUTHORITY_MANIFEST"|"CHECK_RECEIPT"|"ATTESTATION_BUNDLE"|"SIGSTORE_TRUST_ROOT"|"INDEPENDENT_REVIEW";
interface EnforcementSigstoreTrustRootV1 {schemaVersion:"spec-enforcement-sigstore-trust@1";tufRepository:"https://tuf-repo-cdn.sigstore.dev";tufRootVersion:number;tufRootJsonBase64:string;tufRootSha256:Sha256;fulcioRootCertificatesBase64:[string,...string[]];fulcioRootCertificateSha256:Sha256;rekorPublicKeyPemBase64:string;rekorPublicKeySha256:Sha256;validFrom:string;validUntil:string}
interface EnforcementAttestationBundleV1 {mediaType:"application/vnd.dev.sigstore.bundle+json;version=0.3";dsseEnvelope:{payloadType:"application/vnd.in-toto+json";payloadBase64:string;signatures:{keyid:string;sigBase64:string}[]};certificateChain:{certificatesBase64:[string,...string[]]};tlogEntries:[{logIndex:number;integratedTime:number;logId:string;inclusionPromiseBase64:string;inclusionProof:{checkpoint:string;hashes:string[];logIndex:number;rootHash:string;treeSize:number}} ,...{logIndex:number;integratedTime:number;logId:string;inclusionPromiseBase64:string;inclusionProof:{checkpoint:string;hashes:string[];logIndex:number;rootHash:string;treeSize:number}}[]]}
interface EnforcementAttestationPolicyV1 {schemaVersion:"spec-enforcement-attestation-policy@1";issuer:"https://token.actions.githubusercontent.com";repository:"stgmt/omp-spec-kit";signerWorkflow:"stgmt/omp-spec-kit/.github/workflows/spec-enforcement-evidence.yml";sourceRef:string;predicateType:"https://slsa.dev/provenance/v1";subjectSha256:Sha256;trustRootSha256:Sha256;verifierVersion:string}
interface EnforcementEvidenceDocumentV2 {kind:EnforcementEvidenceKind;path:string;bytes:Uint8Array;sha256:Sha256;candidateArtifactSha256:Sha256;producer:{kind:"docker-bdd"|"installed-runtime"|"source-probe"|"independent-review";name:string;version:string;runId:string;executedAt:string};subjectSha256:Sha256;validUntil:string;revokedAt:string|null}
interface ReleaseEvidenceRefV2 {path:string;sha256:Sha256;kind:EnforcementEvidenceKind}
interface EnforcementCheckReceiptV2 {schemaVersion:"spec-enforcement-check-receipt@2";checkId:EnforcementCandidateCheckId;requirementId:EnforcementRequirementId;outcome:"PASS"|"FAIL";candidateArtifactSha256:Sha256;ompVersion:string;ompCommit:string;installedRegistrySha256:Sha256;authorityManifestSha256:Sha256;subjectSha256:Sha256;observations:{id:string;outcome:"PASS"|"FAIL";summary:string;artifactSha256:Sha256}[];attestationBundleSha256:Sha256;executedAt:string;validUntil:string;revokedAt:string|null}
interface ReleaseCheckRecordV2 {checkId:EnforcementCandidateCheckId;requirementId:EnforcementRequirementId;receipt:ReleaseEvidenceRefV2}
interface SpecEnforcementReleaseEvidenceV2 {
  schemaVersion:"spec-enforcement-release@2";
  profile:"spec-enforcement@2";
  targetCapability:"SPEC_ENFORCEMENT";
  candidateVersion:string;
  candidateArtifactSha256:Sha256;
  productBaselineEvidence:ReleaseEvidenceRefV2;
  authoringCapabilityEvidence:ReleaseEvidenceRefV2;
  hostAuthorityAbi:{evidence:ReleaseEvidenceRefV2;parsed:HostToolAuthorityAbiV1};
  authoringAuthorityManifests:AuthoringAuthorityManifestV2[];
  toolRegistryManifest:ToolEffectRegistryManifestV2;
  installedRegistry:InstalledToolRegistrySnapshotV2;
  evidenceDocuments:EnforcementEvidenceDocumentV2[];
  checks:ReleaseCheckRecordV2[];
  attestationPolicy:EnforcementAttestationPolicyV1;
  sigstoreTrustRoot:{evidence:ReleaseEvidenceRefV2;parsed:EnforcementSigstoreTrustRootV1};
  evaluatorVersion:string;
}
type EnforcementEligibilityBlockerCode="BASELINE_MISSING"|"BASELINE_UNBOUND"|"AUTHORING_CAPABILITY_MISSING"|"HOST_AUTHORITY_ABI_MISSING"|"HOST_AUTHORITY_ABI_UNSUPPORTED"|"AUTHORITY_MANIFEST_MISMATCH"|"TOOL_REGISTRY_MISMATCH"|"INSTALLED_REGISTRY_UNBOUND"|"CHECK_MISSING"|"CHECK_EXTRA"|"CHECK_DUPLICATE"|"CHECK_FAILED"|"CHECK_STALE"|"CHECK_REVOKED"|"CHECK_MISMATCH"|"CHECK_UNVERIFIABLE"|"EVIDENCE_EMPTY"|"EVIDENCE_DOCUMENT_MISSING"|"EVIDENCE_HASH_MISMATCH"|"EVIDENCE_KIND_MISMATCH"|"ATTESTATION_INVALID"|"ARTIFACT_BINDING_MISMATCH";
interface SpecEnforcementEligibilityResultV2 {
  schemaVersion:"spec-enforcement-eligibility@2";
  eligible:boolean;
  targetCapability:"SPEC_ENFORCEMENT";
  candidateArtifactSha256:Sha256;
  installedRegistrySha256:Sha256|null;
  hostAuthorityAbiEvidenceSha256:Sha256|null;
  requiredCheckIds:EnforcementCandidateCheckId[];
  passedCheckIds:EnforcementCandidateCheckId[];
  blockers:{code:EnforcementEligibilityBlockerCode;checkId:EnforcementCandidateCheckId|null;evidencePath:string|null;message:string}[];
  evidenceFingerprint:Sha256;
}
```

The pure evaluator re-hashes every role-typed document and parses baseline, authoring eligibility, host ABI, registry/authority manifests and check receipts from those exact bytes. A check record cannot assert PASS: its referenced CHECK_RECEIPT document must parse to `EnforcementCheckReceiptV2`, map `CHK-FRN-*` only to `spec-enforcement:FR-N`, have `outcome:PASS`, nonempty unique passing observations, exact candidate/host/registry/authority binding, current validity/null revocation, and an ATTESTATION_BUNDLE that parses as `EnforcementAttestationBundleV1` and verifies over `subjectSha256` under the exact policy/trust root below. The evaluator base64-decodes TUF/Fulcio/Rekor trust bytes, requires their exact declared hashes, parses the TUF root and certificate/key formats, then the pure offline verifier validates DSSE signature, Fulcio chain/validity/Actions issuer, certificate workflow/repository/ref identity, in-toto subject+predicate, Rekor signed inclusion promise/proof/checkpoint and integrated time against the rehashed SIGSTORE_TRUST_ROOT document. Policy sourceRef is exact `refs/tags/<candidate version>`; bundle/policy/trust-root hashes bind the candidate. The TUF root signs/authenticates the retained Fulcio/Rekor material; hashes authenticate exact decoded bytes but never substitute for them. Key rotation is accepted only by a new trust-root document/schema whose TUF root version/hash is separately reviewed; unknown/expired roots fail `ATTESTATION_INVALID`. Self-signed/unlogged/wrong issuer/repo/workflow/ref/subject/predicate bundles fail. Independent-review checks additionally require an INDEPENDENT_REVIEW document from a distinct producer/run.

The host ABI receipt must prove a later pinned OMP source and behavior emits `tool-call-authority-abi@1`; v17.3.7 cannot satisfy it. The installed registry is generated from the candidate's actual registrations at build/package verification, hash-listed in the package manifest, and must equal registry/authority manifests and the host envelope. Exact V1 and optional additive V2 authority tuples are enforced.

The 12 candidate IDs are required in union order. `CHK-FR11-01` tests the evaluator one-fault matrix and is never a candidate record, avoiding self-reference. Documents sort by kind/path; check records use required order; refs/observations are canonical; blockers sort by check/code/path. `evidenceFingerprint` hashes canonical `{schemaVersion,profile,targetCapability,candidateVersion,candidateArtifactSha256,baseline/authoring/host refs,authority/registry/installed hashes,attestationPolicy,sigstoreTrustRoot,evidenceDocuments:[{kind,path,sha256,subjectSha256,candidateArtifactSha256,producer,validUntil,revokedAt}],checks}` with raw bytes/result excluded. Missing/extra/duplicate/failed/stale/revoked/mismatched/unverifiable/unbound/self-attested inputs fail closed. Only the product evaluator may mark delivery.
