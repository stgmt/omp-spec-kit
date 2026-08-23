# plan-gate_SCHEMA

Versioned public schemas for the plan-gate specification. Schema version: `plan-gate@1`. All fields are mandatory unless marked optional. Object key order in canonical serialization is lexicographic.

## Validation input

```ts
interface PlanValidationInput {
  schemaVersion: "plan-gate@1";
  planText: string;              // UTF-8, ≤ 2 MiB bytes
  planFileName: string;          // "<slug>-plan.md", session-relative
  promptCache: PromptEntry[];    // ≤ 10 entries, newest last
  projectRoot: string;           // containment root for spec reads
  limits: GateLimits;
}
```

## Limits

```ts
interface GateLimits {
  maxPlanBytes: number;            // hard 2 MiB
  maxSiblingFiles: number;         // hard 20
  maxSiblingAggregateBytes: number;// hard 8 MiB
  maxFileChangeRows: number;       // hard 500
  maxSpecReferences: number;       // hard 50
  maxSpecDocsPerSpec: number;      // hard 5
  maxSpecDocBytes: number;         // hard 512 KiB per referenced spec document
  maxSpecAggregateBytes: number;   // hard 2 MiB across all spec reads in one run
  maxReasonBytes: number;          // hard 16 KiB
  runDeadlineMs: number;           // hard 60000
}
```

## Error model

```ts
type GatePhase =
  | "duplicate" | "structure" | "extracted-requirements"
  | "grounding" | "cross-reference" | "spec-reference";

type GateErrorCode =
  | "DUPLICATE_PLAN"
  | "SECTION_MISSING" | "SECTION_ORDER" | "SUMMARY_EMPTY"
  | "INVENTORY_SUBSECTION_MISSING" | "INVENTORY_NA_WITHOUT_REASON"
  | "REQUIREMENTS_SUBSECTION_MISSING" | "REQUIREMENTS_ORDER"
  | "TODO_MALFORMED"
  | "VERIFICATION_NO_COMMANDS"
  | "FILE_CHANGE_ABSOLUTE_PATH" | "FILE_CHANGE_INVALID_ACTION" | "FILE_CHANGE_REASON_EMPTY"
  | "IMPACT_ANALYSIS_MISSING"
  | "EXTRACTED_REQUIREMENTS_MISSING" | "EXTRACTED_REQUIREMENTS_UNDERCOUNT"
  | "GROUNDING_BELOW_THRESHOLD"
  | "CROSS_REF_BELOW_THRESHOLD"
  | "SPEC_REF_MISSING" | "SPEC_REF_SLUG_NOT_FOUND" | "SPEC_REF_ID_NOT_FOUND";

interface PlanValidationError {
  phase: GatePhase;
  code: GateErrorCode;
  line: number;            // 1-based; 0 only when no line applies
  message: string;         // ≤ 1024 Unicode scalar values
  hint: string;            // ≤ 1024 Unicode scalar values
}
```

Errors are ordered by `phase` (pipeline order), then `line`, then `code`.

## Validation result

```ts
interface PlanValidationResult {
  schemaVersion: "plan-gate@1";
  blocked: boolean;                 // true only with errors.length > 0
  errors: PlanValidationError[];    // blocking errors, ordered
  advisories: PlanAdvisory[];       // never participate in `blocked`
  phasesRun: GatePhase[];           // in execution order
  phasesSkipped: GatePhase[];       // e.g. spec-reference when not applicable
  deterministicFingerprint: string; // sha256 over normalized input identity
}

interface PlanAdvisory {
  code: string;     // closed advisory code set (phase-4-class)
  line: number;
  message: string;  // ≤ 1024 Unicode scalar values
}
```

## Deny rendering envelope

```ts
interface DenyReason {
  errors: PlanValidationError[];   // always rendered complete
  templateExcerptBytes: number;    // ≤ 8192
  promptExcerpts: string[];        // ≤ 5 entries, each ≤ 4096 bytes
  totalBytes: number;              // ≤ 16384
  truncated: boolean;              // explicit marker
  truncationOrder: ["prompts", "template"]; // errors never truncated
}
```

## Prompt cache entry

```ts
interface PromptEntry {
  sessionId: string;
  capturedAt: number;   // ms epoch, cache-internal only
  text: string;         // trimmed ≤ 4 KiB
}
```

Cache file: JSON array of `PromptEntry`, ≤ 10 entries, ≤ 64 KiB total, stored only at `<session-local-plan-dir>/.plan-prompts.json`. Malformed JSON ⇒ degrade-open skip.

## Diagnostic record

```ts
interface GateDiagnostic {
  code: "FAULT_HANDLER_EXCEPTION" | "FAULT_PLAN_ABSENT" | "FAULT_PLAN_OVERSIZE"
      | "FAULT_CACHE_MALFORMED" | "FAULT_SUBSYSTEM" | "FAULT_TEMPLATE_MISSING"
      | "FAULT_DEADLINE" | "FAULT_CONTAINMENT";
  message: string;               // ≤ 1024 Unicode scalar values, no absolute paths
  sessionRelativePath?: string;  // optional, session-relative only
  at: number;                    // ms epoch, diagnostic-internal only
}
```

Ring buffer: ≤ 100 records or 256 KiB per session, oldest evicted first, stored in the session-local plan directory only.

## Injection message

```ts
interface PlanModeInjection {
  skeleton: string[];      // ten section names, pipeline order
  specObligation: string;  // one sentence, ≤ 256 chars
  templatePointer: string; // bundled resource name, not a filesystem path
  totalBytes: number;      // ≤ 2048
}
```

## Release evidence manifest

```ts
interface PlanGateReleaseManifest {
  schemaVersion: "plan-gate-release@1";
  targetStage: "gate-v1";
  evidenceProfile: "plan-gate-v1";
  candidateVersion: string;       // semver of the child artifact
  candidateSha256: string;
  records: PlanGateEvidenceRecord[];
}

interface PlanGateEvidenceRecord {
  checkId:
    | "CHK-FR1-01" | "CHK-FR2-01" | "CHK-FR3-01" | "CHK-FR4-01"
    | "CHK-FR5-01" | "CHK-FR6-01" | "CHK-FR7-01" | "CHK-FR8-01"
    | "CHK-FR9-01" | "CHK-FR10-01" | "CHK-FR11-01" | "CHK-FR12-01";
  status: "PASS";               // any other status fails closed
  evidenceSha256: string;       // recomputed from supplied bytes
  artifactSha256: string;       // must equal manifest candidate
  runtimePin: string;           // OMP version/commit for probe records
}
```

Eligibility rules: closed stage/profile pair only; exactly one PASS record per mandatory check CHK-FR1-01 through CHK-FR12-01; all records bound to the same candidate artifact; probe records (`CHK-FR1-01`) must carry the runtime pin matching the pinned contract; structural specification text and unexecuted scenario files are not admissible evidence bytes. `CHK-FR13-01` (the release conjunction itself) is verified by TASK-10 review evidence and is deliberately not a member of the conjunction it governs; a manifest record carrying `CHK-FR13-01` SHALL be rejected as extra.
