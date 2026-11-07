# Tasks

## TASK-1 — Emit real unified diffs

- **Status:** planned

**Implements:** FR-1

<!-- agent-teams-description:start -->
> Replace the positional before/after listing with a unified diff per document: file headers, hunk headers with line counts, three lines of context, documents ordered by name.
> 
> Done when:
> - a three-document bundle previews as three unified diffs
> - applying the bundle reproduces exactly the previewed lines
> - a scenario asserts the `@@` header shape
<!-- agent-teams-description:end -->

## TASK-2 — Publish section-end append and bullet upsert

- **Status:** planned

**Implements:** FR-2

<!-- agent-teams-description:start -->
> Expose the implemented section-end append and add a keyed bullet upsert to the public operation set, with idempotent reapplication.
> 
> Done when:
> - `append_to_section` inserts before the next heading of equal or higher level
> - `upsert_bullet` replaces by key and inserts once when absent
> - applying the same upsert twice leaves the document byte-identical
<!-- agent-teams-description:end -->

## TASK-3 — Apply ordered operations per document

- **Status:** planned

**Implements:** FR-3

<!-- agent-teams-description:start -->
> Let a bundle carry several operations for one document and apply them in array order inside one transaction, naming the failing index when a selector misses.
> 
> Done when:
> - two operations on one document apply in order
> - a missing selector fails the bundle with the index named and no write
> - the receipt reports the final hash per document
<!-- agent-teams-description:end -->

## TASK-4 — Report truncation and sizes

- **Status:** planned

**Implements:** FR-4

<!-- agent-teams-description:start -->
> Carry the truncation flag, the byte budget and per-document before and after sizes into the preview envelope, so a truncated diff is never presented as complete.
> 
> Done when:
> - an over-budget diff reports truncation and the budget
> - a complete diff reports no truncation
> - the envelope states the affected line ranges
<!-- agent-teams-description:end -->

## TASK-5 — Create a specification with authored documents

- **Status:** planned

**Implements:** FR-5

<!-- agent-teams-description:start -->
> Let the create intent carry initial document contents, so a new specification is written once with real content instead of a scaffold overwritten by a second call.
> 
> Done when:
> - a create intent with five authored documents produces those bytes in one receipt
> - the elicitation gate still applies to the first creation
> - no second call is needed to replace a scaffold
<!-- agent-teams-description:end -->
