# Project Registration

Status: DRAFT

## TASK-1 — Diagnose an unknown project

- **Status:** planned

**Implements:** FR-1

<!-- agent-teams-description:start -->
> Replace the bare not-allowed refusal with a diagnosis: the project, the fact that it is unregistered, the caller's allowed projects, and one next action.
> 
> Done when:
> - the refusal carries all four parts
> - a registered but forbidden project reports the same shape
> - a scenario asserts the parts rather than the code alone
<!-- agent-teams-description:end -->

## TASK-2 — Register a project through the tool

- **Status:** planned

**Implements:** FR-2

<!-- agent-teams-description:start -->
> Expose one authorized registration call that checks role before any remote access, reports the preconditions it can check, creates the binding, and reports an identical re-bind as unchanged.
> 
> Done when:
> - a principal without the role is refused before the probe
> - a successful registration returns the binding it created
> - a repeated registration returns unchanged with no re-migration
<!-- agent-teams-description:end -->
