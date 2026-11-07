# Functional Requirements

## FR-1: An unknown project is diagnosed, not merely denied

A call that targets a project the registry does not know SHALL be refused with a diagnosis that names the project, states that it is not registered, lists the projects the caller may use, and gives exactly one next action that registers it. A bare not-allowed code without those parts SHALL NOT be produced.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-an-unknown-project-is-diagnosed)

**Scenario:** `@feature1` / `SCEN-unknown-project-diagnosis`

**Task:** [TASK-1](TASKS.md#task-1-diagnose-an-unknown-project)

## FR-2: Registration an authorized principal can drive

An owner or writer principal SHALL be able to register a project through the tool by naming its repository URL and an optional branch. The call SHALL verify the caller's role before any remote access, SHALL report each precondition it can check (role, secrets key, remote reachability), SHALL create the project record and the repository binding, and SHALL report the binding it created. Registering the same repository and branch twice SHALL be idempotent and SHALL report the result as unchanged rather than as a failure.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-registration-by-an-authorized-principal), [AC-2.2](ACCEPTANCE_CRITERIA.md#ac-22-registration-is-idempotent)

**Scenario:** `@feature2` / `SCEN-registration`

**Task:** [TASK-2](TASKS.md#task-2-register-a-project-through-the-tool)

## FR-3: First specification bootstrap

After a successful registration, creating the first specification in that project SHALL work with no operator step: the specification branch SHALL be created, the scaffold SHALL be written, and the response SHALL name the created branch and the commit. A second specification SHALL follow the same path.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-first-specification-bootstrap)

**Scenario:** `@feature3` / `SCEN-first-spec-bootstrap`

**Task:** [TASK-3](TASKS.md#task-3-bootstrap-the-first-specification)

## FR-4: Credential diagnosis names the repair

Registration and the preflight report SHALL state whether the caller's credential is accepted for the registered project, and when it is not SHALL name the one repair that fixes it, in terms the caller can execute. A credential value SHALL NOT appear in any response, log or audit record.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-credential-diagnosis)

**Scenario:** `@feature4` / `SCEN-credential-diagnosis`

**Task:** [TASK-3](TASKS.md#task-3-bootstrap-the-first-specification)

## FR-5: No registry-less fallback

An unregistered project SHALL NOT be served from a local working tree as a fallback, and no tool SHALL silently switch to local resolution when registration is missing. The refusal SHALL state that registration is required and SHALL point at the action from FR-2.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-no-registry-less-fallback)

**Scenario:** `@feature5` / `SCEN-no-local-fallback`

**Task:** [TASK-4](TASKS.md#task-4-remove-any-local-fallback)
