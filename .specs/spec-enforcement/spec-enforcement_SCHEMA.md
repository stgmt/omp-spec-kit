# spec-enforcement_SCHEMA

Versioned public schemas for the spec-enforcement specification. Schema version: `spec-enforcement@1`. All fields are mandatory unless marked optional. Object key order in canonical serialization is lexicographic.

## Hook decision contracts

### tool_call result (enforcement mode)

```ts
interface EnforcementBlockResult {
  block: true;
  reason: string;           // ≤ 4 KiB UTF-8; actionable redirect text
}
```

The `reason` field SHALL contain:
- The matched tool name (`write`, `edit`, or `bash`).
- The target path (repository-relative, normalized to `/`).
- The redirect destination (authoring door command or API endpoint).
- No stack traces, absolute paths, environment values, or credentials.

### tool_result addition (informational mode)

```ts
interface DiagnosticAddition {
  type: "text";
  text: string;             // ≤ 2 KiB UTF-8; kernel findings summary
}
```

Appended to the existing `content` array of a `tool_result` event. Original content is preserved; the addition is always the last element.

### context message injection

```ts
interface CensusMessage {
  role: "system";
  content: [{ type: "text"; text: string }];  // ≤ 4 KiB UTF-8
}
```

Appended to the `messages` array of a `context` event deep copy. Injected at most once per session.

## Mode enumeration

```ts
type EnforcementMode = "informational" | "enforcement" | "degraded";
```

- `informational`: kernel available, cumulative gate not accepted. Diagnostics injected; no blocking.
- `enforcement`: kernel available, cumulative gate accepted. Spec writes blocked/redirected.
- `degraded`: kernel unavailable. Explicit diagnostic messages; no diagnostics or blocking.

## Diagnostic record

```ts
interface EnforcementDiagnostic {
  schemaVersion: "spec-enforcement@1";
  code: EnforcementDiagnosticCode;
  message: string;          // ≤ 1,024 Unicode scalar values
  component: string;        // "kernel" | "gate" | "handler" | "match"
  timestamp?: number;       // milliseconds since epoch; optional for determinism
}

type EnforcementDiagnosticCode =
  | "KERNEL_UNAVAILABLE"
  | "KERNEL_VERSION_MISMATCH"
  | "KERNEL_QUERY_FAILED"
  | "GATE_STATUS_UNKNOWN"
  | "HANDLER_EXCEPTION"
  | "MATCH_TIMEOUT"
  | "DIAGNOSTIC_RENDER_FAILED"
  | "CENSUS_RENDER_FAILED"
  | "BLOCK_RENDER_FAILED"
  | "HOOK_LOAD_FAILED";
```

Diagnostic records are stored in session-local state only. Maximum 50 records per session; ring-evict oldest when exceeded.

## Block reason format

```text
[spec-enforcement] <tool-name> to <repository-relative-path> blocked.
Redirect: <authoring-door-command-or-api>
Reason: <policy-violation-description>
```

Total bytes ≤ 4 KiB UTF-8. No truncation policy needed because the format is bounded by construction.

## Census summary format

```text
[spec-enforcement] Corpus census:
  Specs: <count>
  Documents: <total-count> (<per-document-type-breakdown>)
  Diagnostics: <severity-summary>
  Kernel: <version> | unavailable
```

Total bytes ≤ 4 KiB UTF-8. When kernel is unavailable, the census states "unavailable" and omits counts.

## Release evidence manifest

```ts
interface SpecEnforcementReleaseEvidence {
  schemaVersion: "spec-enforcement-release@1";
  candidateVersion: string;       // semver
  candidateSha256: string;        // artifact hash
  targetStage: "authoring";
  evidenceProfile: "spec-enforcement-v1";
  checks: ReleaseCheckRecord[];   // one per mandatory check
  evaluatedAt: number;            // milliseconds since epoch
  evaluatorVersion: string;
}

interface ReleaseCheckRecord {
  checkId: string;                // e.g. "CHK-FR1-01"
  requirementId: string;          // e.g. "FR-1"
  status: "PASS" | "FAIL";
  evidenceHash: string;           // SHA-256 of evidence bytes
  evidenceBytes: number;          // byte count of evidence
  artifactSha256: string;         // must match candidateSha256
  notes?: string;                 // ≤ 1,024 Unicode scalar values
}
```

Mandatory checks map to FR-1 through FR-10. Eligibility requires exactly one PASS record per mandatory check with matching `artifactSha256`. Missing, extra, duplicate, failed, stale, mismatched, or unbound records fail closed.
