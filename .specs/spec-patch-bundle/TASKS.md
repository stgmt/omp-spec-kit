# Patch Bundle

Status: DRAFT

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
