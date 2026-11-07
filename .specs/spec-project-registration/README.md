# Project Registration

Status: DRAFT

Release 3.4.0, wave 1a of issue #51, revised by the owner's decision of 2026-11-08: an unregistered project is **correctly** refused. The tool SHALL NOT open a corpus from a bare working tree as a substitute. What is missing is the registration path itself: today an agent that meets an unknown project receives `PROJECT_NOT_ALLOWED`, and the only registration route is a human step in the tracker app.

This specification owns: the diagnosis an unknown project receives, the registration action an authorized principal can drive through the tool, the first-specification bootstrap that follows it, the credential diagnosis attached to both, and the explicit prohibition of a registry-less fallback.

It does not own: token issuance and identity verification, which belong to `spec-registry-service`; repository binding internals and snapshot migration, also owned there; the patch surface (`spec-patch-bundle`); or evidence (`spec-verify-runner`).

## Public states

- **DRAFT.** Registration exists as a service capability (`src/service/onboarding.js`, `src/service/repos.js`) and as a human step in the tracker app; it is not reachable from an agent session, and its preconditions (owner or writer role, secrets key present, remote reachable) are not reported before the attempt.
- **Observed field failure:** an agent wrote a project binding by hand, retried, and received `PROJECT_NOT_ALLOWED` with no statement of what to do next. The correct outcome is the same refusal plus one action that registers the project.

## Documents

[Requirements](REQUIREMENTS.md) · [NFR](NFR.md) · [FR](FR.md) · [AC](ACCEPTANCE_CRITERIA.md) · [Design](DESIGN.md) · [Tasks](TASKS.md) · [Files](FILE_CHANGES.md) · [Changelog](CHANGELOG.md) · [BDD](spec-project-registration.feature) · [Fixtures](FIXTURES.md)

Local IDs become qualified outside this directory, for example `spec-project-registration:FR-2`.
