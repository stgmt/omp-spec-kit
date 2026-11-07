# Local Corpus Mode

Status: DRAFT

## TASK-1 — Resolve a corpus from a working tree without a registry

- **Status:** planned

**Implements:** FR-1

<!-- agent-teams-description:start -->
> Local transport resolves the corpus at the requested root and reports `rootMode: local` with `projectSource: none`, so a fresh clone is readable and writable with no token and no project selection.
> 
> Done when:
> - a corpus with no registry binding opens on the stdio transport and answers `spec_catalog`
> - the response envelope names the local mode and the resolved root
> - no registry credential is read on that path
<!-- agent-teams-description:end -->

## TASK-2 — Preflight reports the resolution state

- **Status:** planned

**Implements:** FR-2

<!-- agent-teams-description:start -->
> The preflight payload carries transport, project source, resolvable root, registry reachability, guard mode, writability and one next action.
> 
> Done when:
> - every field is present in the local and the hosted report
> - a refusal carries the same object instead of a bare code
> - the root is reported in a form the caller can act on
<!-- agent-teams-description:end -->
