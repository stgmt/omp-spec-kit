# File Changes

## FC-1: Product roadmap markers

Action: edit
Planned: yes
Paths: ROADMAP.md

Add the generated-region markers to the product roadmap and a 3.x section for the release, so the roadmap specification can assemble its own view instead of describing it by hand.

## FC-2: Release notes

Action: edit
Planned: yes
Paths: CHANGELOG.md

Record the four capabilities with their evidence references under 3.4.0.

## FC-3: Stale type catalog copy

Action: edit
Planned: yes
Paths: src/adapters/tool-contracts.js

Correct the type catalog description so it states the entity kind and edge type counts the kernel actually exposes.

## FC-4: Task listing default

Action: edit
Planned: yes
Paths: src/kernel/query/extended.js

Stop hiding completed tasks from an unfiltered listing, which currently returns only non-terminal statuses.
