# File Changes

## FC-1: Unknown project diagnosis

Action: edit
Planned: yes
Paths: src/service/scope.js

Name the unknown project, the projects the caller may use, and one next action, instead of a bare not-allowed code.

## FC-2: Registration action

Action: edit
Planned: yes
Paths: src/service/repos.js

Expose registration as one authorized call that reports preconditions before the probe, and reports an unchanged result for an identical re-bind.

## FC-3: Precondition reporting

Action: edit
Planned: yes
Paths: src/service/onboarding.js

Report whether the caller's credential is valid for the project and name the repair when it is not, without returning the secret.

## FC-4: Surface declaration

Action: edit
Planned: yes
Paths: src/adapters/tool-contracts.js

Declare the registration and diagnosis fields on the preflight and repository surfaces.

## FC-5: Registration coverage

Action: create
Planned: yes
Paths: tests/step-definitions/project-registration.steps.mjs

Step definitions for the refusal diagnosis, registration by role, idempotent re-registration, first-spec bootstrap and the credential repair hint.
