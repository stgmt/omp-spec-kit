# Tasks

## TASK-1 — Diagnose an unknown project

- **Status:** in-progress

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

- **Status:** in-progress

**Implements:** FR-2

<!-- agent-teams-description:start -->
> Expose one authorized registration call that checks role before any remote access, reports the preconditions it can check, creates the binding, and reports an identical re-bind as unchanged.
> 
> Done when:
> - a principal without the role is refused before the probe
> - a successful registration returns the binding it created
> - a repeated registration returns unchanged with no re-migration
<!-- agent-teams-description:end -->

## TASK-3 — Bootstrap the first specification

- **Status:** in-progress

**Implements:** FR-3, FR-4

<!-- agent-teams-description:start -->
> Make the first specification creation work right after registration with no operator step, and report whether the caller's credential is accepted with the one repair when it is not.
> 
> Done when:
> - the first spec branch is created and named in the response
> - the second spec follows the same path
> - an unaccepted credential names the repair and leaks no value
<!-- agent-teams-description:end -->

## TASK-4 — Remove any local fallback

- **Status:** planned

**Implements:** FR-5

<!-- agent-teams-description:start -->
> Ensure no tool serves a corpus from a working tree when the project is unregistered, and that the refusal states registration is required and points at the registration action.
> 
> Done when:
> - no resolution path returns a local corpus for an unregistered project
> - the refusal text names the action rather than an alternative mode
> - a scenario asserts the refusal on a working tree that does contain a corpus
<!-- agent-teams-description:end -->
