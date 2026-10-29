# Tasks

## TASK-1 — Add generateBlastRadius intent to spec_patch

- **Status:** todo

**Implements:** FR-1

**Refs:** NFR-SEC-1

- **Done When:** `src/adapters/tool-contracts.js` includes `generateBlastRadius` variant in spec_patch with proper schema and description.

## TASK-2 — Implement blast-radius-generator skill

- **Status:** todo

**Implements:** FR-2, FR-6

**Refs:** NFR-PERF-1, NFR-REL-1

- **Done When:** `plugins/omp-spec-kit/skills/blast-radius-generator/SKILL.md` exists and generates BLAST_RADIUS.md draft with hardcoded omp-spec-kit patterns.

## TASK-3 — Implement blast-radius-reviewer skill

- **Status:** todo

**Implements:** FR-3

**Refs:** NFR-CORR-1

- **Done When:** `plugins/omp-spec-kit/skills/blast-radius-reviewer/SKILL.md` exists and validates blast radius drafts with APPROVED/NEEDS_REVISION verdicts.

## TASK-4 — Implement BlastRadiusWorkflow (LangGraph)

- **Status:** todo

**Implements:** FR-4

**Refs:** TASK-2, TASK-3, NFR-REL-1

- **Done When:** `src/workflows/blast-radius-workflow.js` implements supervisor-subagent pattern with generator, reviewer, and save nodes; retry policy of 2 attempts.

## TASK-5 — Integrate workflow into spec_patch service

- **Status:** todo

**Implements:** FR-5, FR-7

**Refs:** TASK-4, NFR-PERF-1

- **Done When:** `src/authoring/service.js` invokes BlastRadiusWorkflow after successful patch when `generateBlastRadius` is true (default true); saves BLAST_RADIUS.md via spec_patch with insert_at_eof.

## TASK-6 — Add unit tests for pattern matching

- **Status:** todo

**Implements:** NFR-PERF-1, NFR-CORR-1

**Refs:** TASK-2

- **Done When:** `tests/blast-radius-generator.test.mjs` tests pattern matching logic with mocked ripgrep output.

## TASK-7 — Add integration tests for generator skill

- **Status:** todo

**Implements:** FR-2

**Refs:** TASK-2

- **Done When:** Agent can invoke blast-radius-generator skill and receive valid BLAST_RADIUS.md draft.

## TASK-8 — Add integration tests for reviewer skill

- **Status:** todo

**Implements:** FR-3

**Refs:** TASK-3

- **Done When:** Agent can invoke blast-radius-reviewer skill and receive valid verdict with comments.

## TASK-9 — Add E2E test for full workflow

- **Status:** todo

**Implements:** FR-1, FR-4, FR-5

**Refs:** TASK-4, TASK-5

- **Done When:** E2E test creates a spec via spec_patch, automatically generates BLAST_RADIUS.md, and validates the document is saved correctly.

## TASK-10 — Update documentation

- **Status:** todo

**Implements:** FR-5

**Refs:** TASK-5

- **Done When:** README.md documents the new `generateBlastRadius` parameter and BLAST_RADIUS.md auto-generation feature.

## TASK-11 — Dogfood on omp-spec-kit

- **Status:** todo

**Implements:** FR-6

**Refs:** TASK-9

- **Done When:** Generate BLAST_RADIUS.md for this spec and validate patterns cover actual omp-spec-kit changes.
