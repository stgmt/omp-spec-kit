# File Changes

## FC-1: Diff and operation semantics

Action: edit
Planned: yes
Paths: src/authoring/proposals.js

Emit real unified hunks with context, allow ordered operations on one document, and expose section-end append and keyed bullet upsert.

## FC-2: Public operation schemas

Action: edit
Planned: yes
Paths: src/adapters/tool-contracts.js

Add the new operation kinds and the authored-documents field of the create intent to the published schema.

## FC-3: Preview envelope

Action: edit
Planned: yes
Paths: src/authoring/service.js

Carry the truncation flag, the per-document byte sizes and the applied result hashes into the preview envelope.

## FC-4: Bundle behaviour coverage

Action: create
Planned: yes
Paths: tests/step-definitions/patch-bundle.steps.mjs

Step definitions for ordered same-document operations, section-end append, keyed bullet upsert, truncation reporting and one-call spec creation.
