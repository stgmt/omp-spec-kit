# Blast Radius Auto-Generation

Automatic generation of BLAST_RADIUS.md documents for specifications using two coordinated subagents (generator + reviewer).

**Profile:** standard
**Status:** active

## Purpose

When a specification is created or modified via `spec_patch`, automatically generate a BLAST_RADIUS.md document that analyzes the impact of changes across the codebase. The document follows the format from presentation-reels BLAST_RADIUS.md (11 sections with grep pattern analysis).

The generation uses two subagents:
1. **Generator**: analyzes changes, runs grep patterns, produces BLAST_RADIUS.md draft
2. **Reviewer**: validates completeness, accuracy, and correctness of the draft

The workflow is coordinated via a LangGraph supervisor-subagent pattern with 2 retry attempts.

## Documents

- [FR.md](FR.md) — Functional requirements
- [NFR.md](NFR.md) — Non-functional requirements
- [DESIGN.md](DESIGN.md) — Design decisions
- [TASKS.md](TASKS.md) — Implementation tasks
- [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md) — Acceptance criteria
- [blast-radius-auto-generation.feature](blast-radius-auto-generation.feature) — Gherkin scenarios
- [FILE_CHANGES.md](FILE_CHANGES.md) — File-level changes

## Related specifications

None. This is a new feature for omp-spec-kit.
