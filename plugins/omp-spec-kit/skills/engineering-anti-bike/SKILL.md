---
name: engineering-anti-bike
description: Anti-bikeshedding and anti-fake-green discipline for specification authoring and implementation — evidence-first claims, prior-art scan before custom code, and evidence-based BDD scenario authoring.
---

# Engineering anti-bike

Operating discipline that prevents two failure modes: bikeshedding (debating taste instead of shipping the boring correct thing) and fake-green (tests that pass without proving anything).

## Evidence-first claims

- Every claim about code, tests, tools, or documents must be grounded in bytes you actually read or a command you actually ran. Mark anything unobserved as inference.
- Never assert "the test covers X" from the test name; read the assertion body.
- Never assert "the tool does Y" from its description; run it or read its handler.

## Prior-art scan before custom implementation

- Before writing a new mechanism, search the repository and the installed toolchain for an existing one. Name what you found and why it does not fit, or reuse it.
- Prefer the boring option that already exists over a novel abstraction. A second convention beside an existing one is prohibited.

## BDD scenario authoring

Draft scenarios require complete Given/When/Then steps and valid links. Write observable behavior and use concrete examples that distinguish the intended outcome from an incorrect one. The owner's BDD coverage map approves the examples used for task scope and promotion to `@spec-ready`.

## Migrating an existing specification

Legacy specification documents remain readable through `spec_documents`. Before changing one specification with an old or incomplete layout, request its file list with `includeSnapshot: true` and read the sources against that snapshot. Prepare `spec_patch` with `intent: "migrateSpec"`, both canonical Gherkin documents and source-to-target mapping, then preview it. Preserve the source content and links; direct links of a story or case use `Refs: <slug>:<ID>` before `Context`. For an ambiguous case-to-story link, ask the owner and include the approved `decisions` entry with its reason. If a canonical field is not proven by its corresponding source field, ask the owner and include `fieldDecisions` such as `{ "entityId": "US-1", "field": "Goal", "value": "Review the proposal", "reason": "Owner confirmed this goal", "sourceDocument": "legacy.feature", "sourceSha256": "<source SHA-256>", "sourceStartLine": 1, "sourceEndLine": 1 }`. The source range must belong to a mapping into that same Rule. If existing scenario step lines need correction, obtain the owner's decision and provide `repairs` with exact source/before/after SHA-256 hashes, original line range, scenario ID, replacement and reason. Review the shown before/after fragments. Do not invent requirements or approve coverage. After reviewing the preservation findings and diff, apply the same proposal using its `expectedProposalHash` and repeat the original change. The remaining specifications can stay in their current format until they need changes.

## Hypothesis Q&A

- Ask only questions whose answer changes a requirement, acceptance criterion, or boundary claim. Name the gap each question closes.
- Never reverse a decision under pressure alone; reverse only on new evidence, and record the evidence.
