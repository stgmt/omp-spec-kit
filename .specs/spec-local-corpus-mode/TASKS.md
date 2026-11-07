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

## TASK-3 — Probe registry reachability with a bound

- **Status:** planned

**Implements:** FR-3

<!-- agent-teams-description:start -->
> The hosted report probes the registry with its own timeout and reports the outcome without failing the enclosing call.
> 
> Done when:
> - a closed registry yields `registryReachable: false` with a timeout flag
> - the enclosing tool call still returns its own result
> - the probe never runs in local mode
<!-- agent-teams-description:end -->

## TASK-4 — Treat internal URIs as non-filesystem targets

- **Status:** planned

**Implements:** FR-4

<!-- agent-teams-description:start -->
> Every OMP internal URI scheme, including `proc` and `out`, is recognized as an internal target and never resolved as a path.
> 
> Done when:
> - `read proc://` and a read of `out://` content are allowed
> - a real corpus file path is still refused with the corpus containment code
> - the scheme list lives in one place and is covered by a scenario
<!-- agent-teams-description:end -->

## TASK-5 — Refusals name the project and one next action

- **Status:** planned

**Implements:** FR-5

<!-- agent-teams-description:start -->
> A project-resolution refusal names the offending project, the projects the caller may use, and exactly one next action; `PROJECT_REQUIRED` is not emitted when a corpus is resolvable.
> 
> Done when:
> - each refusal code carries the three facts
> - an unregistered consumer project resolves locally instead of refusing
> - the refusal message fits the bounded reason budget
<!-- agent-teams-description:end -->

## TASK-6 — Local writes carry receipts and no token

- **Status:** planned

**Implements:** FR-6

<!-- agent-teams-description:start -->
> Writes in local mode use the same transactional patch path as hosted writes, emit a receipt, and require no token.
> 
> Done when:
> - a local write returns an APPLIED receipt with changed documents
> - no registry credential is read or forwarded
> - a failed batch leaves no partial document
<!-- agent-teams-description:end -->
