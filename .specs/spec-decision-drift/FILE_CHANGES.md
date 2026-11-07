# File Changes

## FC-1: Entity kinds and diagnostic codes

Action: edit
Planned: yes
Paths: src/kernel/types.js

Add the QUESTION entity kind with the `Q-n` local identifier role, the SUPERSEDES edge type, and the diagnostics this specification introduces.

## FC-2: Decision and question field parsing

Action: edit
Planned: yes
Paths: src/kernel/parsers/attributes.js

Parse date, scope, key, value, guard, status and supersession for a decision, and blocks, askee and status for a question.

## FC-3: Drift evaluation

Action: edit
Planned: yes
Paths: src/kernel/graph/build.js

Evaluate each decided decision's declared pattern across the corpus and emit the drift diagnostic with both locations.

## FC-4: Open question finding and status refusal

Action: edit
Planned: yes
Paths: src/kernel/query/extended.js

Report work blocked by an open question, and refuse a completion transition while a blocking question is open.

## FC-5: Drift and question coverage

Action: create
Planned: yes
Paths: tests/step-definitions/decision-drift.steps.mjs

Step definitions for structural parse, drift with two locations, supersession and the open question block.
