# Release 3.4.0

Status: DRAFT

## TASK-1 — Deliver the registration path

- **Status:** planned

**Implements:** FR-1

<!-- agent-teams-description:start -->
> Bring `spec-project-registration` to accepted: the diagnosis with one action, registration through the tool, first-spec bootstrap, credential repair hint, and no local fallback.
> 
> Done when:
> - the wave specification reports its acceptance criteria green on a release candidate
> - an unregistered repository registers and creates its first specification in one session
> - the evidence run is recorded in that specification
<!-- agent-teams-description:end -->

## TASK-2 — Deliver the patch bundle

- **Status:** planned

**Implements:** FR-2

<!-- agent-teams-description:start -->
> Bring `spec-patch-bundle` to accepted: unified hunks, ordered operations on one document, section operations, truncation flag and one-call creation.
> 
> Done when:
> - the wave specification reports its acceptance criteria green on a release candidate
> - one live bundle produces one reviewable diff
> - the evidence run is recorded in that specification
<!-- agent-teams-description:end -->

## TASK-3 — Deliver decision drift

- **Status:** planned

**Implements:** FR-3

<!-- agent-teams-description:start -->
> Bring `spec-decision-drift` to accepted: the question kind, structured decision metadata, the drift diagnostic with both locations and the blocking relation.
> 
> Done when:
> - the wave specification reports its acceptance criteria green on a release candidate
> - a real drift in a real corpus is reported with both locations
> - the evidence run is recorded in that specification
<!-- agent-teams-description:end -->

## TASK-4 — Deliver the verify runner

- **Status:** planned

**Implements:** FR-4

<!-- agent-teams-description:start -->
> Bring `spec-verify-runner` to accepted: the check field, the allowlisted run, the evidence record, the completion gate, spend authorization and the external writers.
> 
> Done when:
> - the wave specification reports its acceptance criteria green on a release candidate
> - a real task completes only after its recorded green run
> - the evidence run is recorded in that specification
<!-- agent-teams-description:end -->

## TASK-5 — Close release hygiene and declare later waves

- **Status:** planned

**Implements:** FR-5, FR-6

<!-- agent-teams-description:start -->
> Close the non-capability defects from issue #51 (internal URI schemes, type catalog copy, task list default, first-write gate persistence, roadmap markers, roadmap intent safety) and declare the two later waves as planned with their headlines.
> 
> Done when:
> - each hygiene item has a check that fails when the fix is reverted
> - both later waves appear as planned and neither as shipped
> - the assembled release view is generated rather than written by hand
<!-- agent-teams-description:end -->
