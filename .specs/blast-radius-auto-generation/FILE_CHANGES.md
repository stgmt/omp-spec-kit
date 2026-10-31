# File Changes

## New files

- `src/adapters/tool-contracts.js` — add `generateBlastRadius` intent to spec_patch
- `src/workflows/blast-radius-workflow.js` — new LangGraph workflow for blast radius generation
- `src/authoring/service.js` — integrate workflow into spec_patch service
- `plugins/omp-spec-kit/skills/blast-radius-generator/SKILL.md` — generator skill
- `plugins/omp-spec-kit/skills/blast-radius-reviewer/SKILL.md` — reviewer skill
- `tests/blast-radius-generator.test.mjs` — unit tests for pattern matching
- `tests/blast-radius-workflow.test.mjs` — integration tests for workflow
- `README.md` — document generateBlastRadius parameter

## Modified files

- `src/adapters/tool-contracts.js` — add generateBlastRadius variant
- `src/authoring/service.js` — invoke workflow after patch
- `README.md` — add documentation for new feature

## Specification documents

- `README.md` — spec metadata
- `FR.md` — functional requirements
- `NFR.md` — non-functional requirements
- `DESIGN.md` — design decisions
- `TASKS.md` — implementation tasks
- `ACCEPTANCE_CRITERIA.md` — acceptance criteria
- `blast-radius-auto-generation.feature` — Gherkin scenarios
- `FILE_CHANGES.md` — this file
