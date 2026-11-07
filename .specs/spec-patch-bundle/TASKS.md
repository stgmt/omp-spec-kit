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
