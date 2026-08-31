# Plan Gate Schema

The contract version is `plan-gate-manual@1`. It defines one pure function over caller-supplied strings.

## Request and result

```ts
interface ValidateExactPlanRequest {
  content: string;
  sourceUri?: string;
  expectedSha256?: string; // lowercase 64-character hex
  requestText?: string;
}

type PlanValidationStatus = "VALID" | "INVALID" | "UNAVAILABLE";
type PlanFindingSeverity = "ERROR" | "WARNING" | "DIAGNOSTIC";

type PlanFindingCode =
  | "INVALID_REQUEST"
  | "INPUT_TOO_LARGE"
  | "INPUT_MISMATCH"
  | "VALIDATOR_FAILURE"
  | "MISSING_OBJECTIVE"
  | "MISSING_APPROACH"
  | "MISSING_FILE_ACTIONS"
  | "INVALID_FILE_ACTION"
  | "MISSING_VERIFICATION"
  | "MISSING_ASSUMPTIONS"
  | "MISSING_DESTRUCTIVE_IMPACT"
  | "DUPLICATE_SEMANTIC_SECTION"
  | "REQUEST_ALIGNMENT_WARNING";

interface PlanFinding {
  code: PlanFindingCode;
  severity: PlanFindingSeverity;
  line?: number; // 1-based; absent for request-level diagnostics
  message: string;
  hint: string;
}

interface ValidateExactPlanResult {
  status: PlanValidationStatus;
  contentSha256: string;
  findings: PlanFinding[];
  omittedCount: number;
}

declare function validateExactPlan(
  request: ValidateExactPlanRequest,
): ValidateExactPlanResult;
```

`sourceUri` is display metadata only. It is never opened, normalized into a filesystem path, or returned in a diagnostic. SHA-256 covers the UTF-8 bytes produced from the original `content`; newline normalization is used only by the parser.

## Hard bounds

| Field | Maximum | Failure |
|---|---:|---|
| `content` | 1 MiB UTF-8 | `UNAVAILABLE` / `INPUT_TOO_LARGE` |
| `requestText` | 64 KiB UTF-8 | `UNAVAILABLE` / `INPUT_TOO_LARGE` |
| `sourceUri` | 2,048 UTF-8 bytes | `UNAVAILABLE` / `INVALID_REQUEST` |
| returned findings | 50 complete rows | remaining rows counted in `omittedCount` |
| code | 64 UTF-8 bytes | implementation invariant |
| message | 240 UTF-8 bytes | bounded before return |
| hint | 240 UTF-8 bytes | bounded before return |

Invalid request shape, including a malformed expected digest, returns `UNAVAILABLE` / `INVALID_REQUEST`. A valid expected digest that differs from the computed digest returns `UNAVAILABLE` / `INPUT_MISMATCH`. These request-level exits return one diagnostic and `omittedCount: 0`.

## Semantic section model

The parser recognizes ATX Markdown headings. Heading text is Unicode-lowercased, surrounding whitespace is trimmed, and trailing Markdown punctuation is removed before matching this closed alias table:

| Semantic field | Accepted heading text |
|---|---|
| Objective | `Objective`, `Context` |
| Approach | `Approach` |
| Files and actions | `Critical files`, `File Changes` |
| Verification | `Verification`, `Verification Plan` |
| Assumptions | `Assumptions` |
| Destructive impact | `Impact Analysis`, `Destructive Impact` |

Order is irrelevant. Unrecognized headings are allowed. A second heading for the same semantic field emits `DUPLICATE_SEMANTIC_SECTION` at the second heading and the first block remains authoritative.

Objective, approach, verification, and assumptions must contain non-whitespace text. `Assumptions` may explicitly contain `None`. Files and actions must contain at least one valid entry in either form:

```md
- `relative/path.js` — modify

| Path | Action |
|---|---|
| `relative/path.js` | modify |
```

A path must be repository-relative after `/` separator normalization and must not be empty, absolute, drive-qualified, or contain a `..` segment. Actions are exactly `create`, `modify`, `delete`, `move`, `rename`, `replace`, or `overwrite`. Invalid rows emit `INVALID_FILE_ACTION` at their line. At least one `delete`, `move`, `rename`, `replace`, or `overwrite` action makes destructive-impact disclosure mandatory.

Verification must name at least one executable command in backticks or one observable prefixed `Observe:`. Assumptions remain explicit even when there are none.

## Optional request alignment

When `requestText` is present, both it and the combined objective/approach text are Unicode-lowercased and tokenized with `\p{L}` and `\p{N}` runs. Tokens shorter than four code points are discarded. If the two resulting sets are non-empty and disjoint, emit `REQUEST_ALIGNMENT_WARNING`. Empty token sets do not emit a warning. This phase never emits an error.

## Status and ordering

1. Request-shape, size, digest mismatch, or caught internal failure returns `UNAVAILABLE` with one `DIAGNOSTIC`.
2. Otherwise, one or more `ERROR` findings returns `INVALID`.
3. Otherwise, the result is `VALID`; warnings may remain.
4. Document-level findings without a line sort first by code. Line findings sort by line, then code. The first 50 are returned and `omittedCount` equals the remaining count.

The function retains no data between calls and performs no I/O. Identical requests produce byte-identical serialized results on supported runtimes.

## OMP exact selected-plan event

The automatic profile consumes one blocking plan_approval_requested event after native resolution and before TUI or ACP approval. The event carries planFilePath, title, planContent, and planSha256. A mismatch, handler error, timeout, or cancellation keeps plan mode active and prevents approval UI.
