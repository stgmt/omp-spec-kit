# Roadmap: Roadmap Management

Profile: light
Status: active

Roadmap specs are a higher-level abstraction above feature specifications. A roadmap describes the waterfall implementation phases of one or more feature specs, tracing each phase to specific functional requirements, acceptance criteria, and tasks in the target specs.

A roadmap spec lives at `.specs/roadmap-<theme>/` and uses a reduced document set:
- README.md — profile and purpose
- FR.md — implementation phases
- TASKS.md — work items with trace links to feature specs
- ACCEPTANCE_CRITERIA.md — phase acceptance criteria
- `<slug>.feature` — Gherkin scenarios

Roadmap FRs describe implementation waves. Roadmap TASKs trace to feature spec FRs and ACs via `Implements:` columns.

Related:
- Product ROADMAP.md — release-oriented view of all roadmap specs
- `.specs/plugin-distribution/` — product lifecycle domain
