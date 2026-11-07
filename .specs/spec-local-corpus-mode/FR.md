# Functional Requirements

## FR-1: Local corpus resolution without a registry

The stdio transport SHALL resolve a specification corpus from the requested working-tree root with no registry project, no token and no project selection. That resolution SHALL be reported as a distinct local outcome, and the response envelope SHALL name the transport, the resolved root and the project source. A repository that the registry does not know SHALL NOT be refused when its corpus is resolvable locally.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-local-corpus-resolution-without-a-registry)

**Scenario:** `@feature1` / `SCEN-local-corpus-resolution`

**Task:** [TASK-1](TASKS.md#task-1-resolve-a-corpus-from-a-working-tree-without-a-registry)

## FR-2: Preflight reports the resolution state

The preflight report SHALL answer, in one object, why a corpus is or is not usable: `transport`, `projectSource`, `resolvableRoot`, `registryReachable`, `guardMode`, `writable` and exactly one `nextAction`. A resolution refusal SHALL carry the same object, so the caller does not have to reconstruct the cause from a bare code. The report SHALL NOT expose a credential or an absolute path outside the requested root.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-preflight-reports-the-resolution-state), [AC-2.2](ACCEPTANCE_CRITERIA.md#ac-22-refusal-carries-the-report)

**Scenario:** `@feature2` / `SCEN-preflight-report`

**Task:** [TASK-2](TASKS.md#task-2-preflight-reports-the-resolution-state)

## FR-3: Registry reachability probe

The hosted report SHALL probe the registry under its own timeout and report `registryReachable` together with a timeout flag. The probe SHALL NOT be attempted in local mode, and a failed or timed-out probe SHALL NOT fail the enclosing tool call.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-registry-reachability-probe)

**Scenario:** `@feature3` / `SCEN-registry-probe`

**Task:** [TASK-3](TASKS.md#task-3-probe-registry-reachability-with-a-bound)

## FR-4: Internal URI schemes are not filesystem targets

The enforcement guard SHALL recognize every internal URI scheme an agent host can emit, including `proc` and `out`, and SHALL NOT resolve such a value as a filesystem path for any tool. Adding a scheme SHALL be a one-line change in a single list. Corpus containment SHALL be unchanged: a real corpus path is still refused for read and write.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-internal-uri-schemes-are-not-filesystem-targets), [AC-4.2](ACCEPTANCE_CRITERIA.md#ac-42-corpus-paths-stay-contained)

**Scenario:** `@feature4` / `SCEN-internal-uri`

**Task:** [TASK-4](TASKS.md#task-4-treat-internal-uris-as-non-filesystem-targets)

## FR-5: Refusals explain and offer one next action

Every project-resolution refusal SHALL name the offending project, the projects the caller is allowed to use, and exactly one next action. `PROJECT_REQUIRED` SHALL NOT be emitted when a corpus is resolvable, and `PROJECT_NOT_ALLOWED` SHALL NOT be the only information a caller receives about an unknown project.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-refusals-explain-and-offer-one-next-action)

**Scenario:** `@feature5` / `SCEN-project-refusal`

**Task:** [TASK-5](TASKS.md#task-5-refusals-name-the-project-and-one-next-action)

## FR-6: Local writes are transactional and unauthenticated

A write in local mode SHALL use the same transactional patch path as a hosted write, SHALL return a receipt naming the changed documents, and SHALL require no registry credential. A failed batch SHALL leave no partially written document.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-local-writes-are-transactional-and-unauthenticated)

**Scenario:** `@feature6` / `SCEN-local-write`

**Task:** [TASK-6](TASKS.md#task-6-local-writes-carry-receipts-and-no-token)
