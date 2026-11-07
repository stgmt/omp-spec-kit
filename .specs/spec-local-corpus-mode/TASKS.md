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
