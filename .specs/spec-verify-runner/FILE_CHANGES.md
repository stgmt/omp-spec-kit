# File Changes

## FC-1: Task check fields

Action: edit
Planned: yes
Paths: src/kernel/parsers/attributes.js

Parse the executable check line with its spend and timeout modifiers, and report a task without a check as such.

## FC-2: Command runner

Action: create
Planned: yes
Paths: src/verify/runner.js

Execute an allowlisted argument vector with a timeout and a redacting log tail, and return a structured result.

## FC-3: Evidence records and views

Action: edit
Planned: yes
Paths: src/evidence/service.js

Persist one record per run and answer run, history and scenario queries from them.

## FC-4: Completion gate

Action: edit
Planned: yes
Paths: src/authoring/proposals.js

Refuse a completion transition without a fresh green record for the current commit unless an explicit override reason is recorded.

## FC-5: Tool contract

Action: edit
Planned: yes
Paths: src/adapters/tool-contracts.js

Declare the verification tool and its run and dry modes, keeping the single authoring tool invariant.

## FC-6: External result writers

Action: create
Planned: yes
Paths: tests/step-definitions/verify-runner.steps.mjs

Step definitions for the allowlist, the timeout, the evidence record, the completion gate and the spend refusal.
