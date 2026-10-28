# Acceptance Criteria

## AC-1.1 — spec_patch supports generateBlastRadius intent

**Given:** omp-spec-kit MCP server is running
**When:** Agent calls `spec_patch` with `intent: "generateBlastRadius"`
**Then:** The intent is recognized and does not return INVALID_REQUEST
**And:** The intent schema includes optional `baselineCommit` and `generateBlastRadius` fields

## AC-2.1 — Generator produces BLAST_RADIUS.md with correct structure

**Given:** blast-radius-generator skill is invoked with repository path and git diff
**When:** Generator runs ripgrep with hardcoded omp-spec-kit patterns
**Then:** Generator returns BLAST_RADIUS.md content with 11 sections
**And:** Each section includes: pattern, occurrences count, files count, top locations
**And:** Format matches presentation-reels BLAST_RADIUS.md template

## AC-2.2 — Generator handles missing FILE_CHANGES.md

**Given:** blast-radius-generator skill is invoked
**When:** FILE_CHANGES.md does not exist in the spec
**Then:** Generator uses git diff directly (HEAD~1 vs HEAD)
**And:** No error is thrown

## AC-3.1 — Reviewer validates completeness

**Given:** blast-radius-reviewer skill is invoked with BLAST_RADIUS.md draft and git diff
**When:** Changed files are not mentioned in the draft
**Then:** Reviewer returns NEEDS_REVISION
**And:** Comments include missing files with severity "blocking"

## AC-3.2 — Reviewer validates accuracy

**Given:** blast-radius-reviewer skill is invoked with BLAST_RADIUS.md draft
**When:** Patterns match too many unrelated files (broad patterns)
**Then:** Reviewer returns NEEDS_REVISION
**And:** Comments suggest narrowing patterns with severity "warning"

## AC-4.1 — Supervisor implements retry policy

**Given:** BlastRadiusWorkflow is running
**When:** Reviewer returns NEEDS_REVISION and retryCount < 2
**Then:** Workflow routes back to generator with reviewer comments
**And:** retryCount is incremented
**When:** Reviewer returns NEEDS_REVISION and retryCount >= 2
**Then:** Workflow ends with failure and reviewer comments

## AC-5.1 — Automatic generation enabled by default

**Given:** Agent calls `spec_patch` with `intent: "patch"` and operations
**When:** `generateBlastRadius` parameter is not provided
**Then:** BlastRadiusWorkflow is invoked after successful patch
**When:** Agent calls `spec_patch` with `generateBlastRadius: false`
**Then:** BlastRadiusWorkflow is not invoked

## AC-6.1 — Hardcoded patterns for omp-spec-kit

**Given:** blast-radius-generator skill is invoked
**When:** No pattern config is provided
**Then:** Generator uses hardcoded omp-spec-kit patterns
**And:** Patterns include: authoring surface, kernel surface, MCP contracts, service layer, test surface, plugin payload, skills, tests, documentation, workflows, release

## AC-7.1 — BLAST_RADIUS.md tracked as separate document

**Given:** BlastRadiusWorkflow completes successfully
**When:** BLAST_RADIUS.md is saved via spec_patch
**Then:** The document is listed in `spec_documents(action: "list")` for the spec
**And:** FILE_CHANGES.md includes the new document
