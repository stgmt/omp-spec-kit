# Functional Requirements

## FR-1: Executable task checks

A task SHALL be able to declare `Verify:` and `Guard:` commands, each with an optional `spends: true` flag and an optional timeout. The kernel SHALL parse them into task metadata, and a task that declares no check SHALL be reported as `NO_CHECK` in the task listing rather than appearing complete.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-executable-task-checks)

**Scenario:** `@feature1` / `SCEN-executable-checks`

**Task:** [TASK-1](TASKS.md#task-1-parse-checks-and-run-them-under-an-allowlist)

## FR-2: Run under an allowlist and a timeout

A verification run SHALL execute the declared command as an argument vector in the repository root, SHALL refuse any executable outside an allowlist before spawning it, and SHALL terminate at its timeout with the partial output recorded. A dry mode SHALL return the command, its parsed arguments and the allowlist verdict without executing anything.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-run-under-an-allowlist-and-a-timeout)

**Scenario:** `@feature2` / `SCEN-allowlisted-run`

**Task:** [TASK-1](TASKS.md#task-1-parse-checks-and-run-them-under-an-allowlist)

## FR-3: Evidence records

Each run SHALL produce one evidence record naming the task, the commit, the dirty state of the worktree, the command, the exit code, the duration, the last 16 KiB of output and the hash of the complete output. `spec_evidence` SHALL answer three questions from those records: the latest run for a task, the history of runs for a task, and the last green run for a scenario.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-evidence-records)

**Scenario:** `@feature3` / `SCEN-evidence-record`

**Task:** [TASK-2](TASKS.md#task-2-record-and-answer-evidence)

## FR-4: Completion requires a fresh green run

A transition to `done` SHALL be refused unless a green record exists for the current commit, and the refusal SHALL name the missing record. An explicit override SHALL be possible only with a written reason that the receipt records, so the exception is visible in the history instead of silent.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-completion-requires-a-fresh-green-run), [AC-4.2](ACCEPTANCE_CRITERIA.md#ac-42-override-is-recorded)

**Scenario:** `@feature4` / `SCEN-completion-gate`

**Task:** [TASK-3](TASKS.md#task-3-gate-completion-and-record-overrides)

## FR-5: Spend authorization

A command declared with `spends: true` SHALL be refused unless an authorization record for that task and commit exists, and the refusal SHALL name the authorization that is missing. A run without the flag SHALL proceed without authorization.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-spend-authorization)

**Scenario:** `@feature5` / `SCEN-spend-authorization`

**Task:** [TASK-3](TASKS.md#task-3-gate-completion-and-record-overrides)

## FR-6: External result writers and last-green answers

A pytest plugin and a vitest reporter SHALL write scenario results in a declared NDJSON schema carrying a run identifier, the commit and the start time, and the evidence surface SHALL ingest them so that a scenario answers with its last green run, its commit and its timestamp. Runs SHALL be retained as history rather than collapsed to one file per machine.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-external-writers-and-last-green)

**Scenario:** `@feature6` / `SCEN-external-writers`

**Task:** [TASK-4](TASKS.md#task-4-ingest-external-results-and-keep-history)
