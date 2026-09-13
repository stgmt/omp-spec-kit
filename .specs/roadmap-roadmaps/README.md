# Roadmap: Roadmap Management

Profile: roadmap
Status: active

Roadmap specs are a higher-level abstraction above feature specifications. A roadmap describes the waterfall implementation phases of one or more feature specs, tracing each phase to specific functional requirements, acceptance criteria, and tasks in the target specs.

Detection rule: the kernel identifies a roadmap spec solely by the `roadmap-` slug prefix. The `Profile: roadmap` field above is a human-facing convention that mirrors that rule; it carries no detection semantics and is not kernel-validated.

A roadmap spec lives at `.specs/roadmap-<theme>/` and uses a reduced document set:
- README.md — profile and purpose
- ROADMAP.md — hybrid roadmap view: authored narrative plus a deterministic generated region assembled from the graph
- FR.md — implementation phases
- TASKS.md — work items with trace links to feature specs
- ACCEPTANCE_CRITERIA.md — phase acceptance criteria
- `<slug>.feature` — Gherkin scenarios

Roadmap FRs describe implementation waves. Roadmap TASKs trace to feature spec FRs and ACs via `Implements:` columns.

The generated region of ROADMAP.md is assembled from the graph: the roadmap's own `Implements:` references select the target spec scope, and requirement-level entities (FR, USE_CASE, USER_STORY — never TASK) are rendered with derived implementation status. Re-assembly merges by canonical ID, removes vanished items, and never touches authored content.

Related:
- Product ROADMAP.md — release-oriented view of all roadmap specs
- `.specs/plugin-distribution/` — product lifecycle domain
