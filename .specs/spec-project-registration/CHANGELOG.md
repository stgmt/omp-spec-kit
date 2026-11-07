# Changelog

## 3.4.0 — unreleased

Specification created for release 3.4.0, wave 1a (issue #51), revised: registration is the required path.

### Implemented (source, 2026-11-08)

- **Refusals name the way out (FR-1).** `PROJECT_NOT_ALLOWED`, `PROJECT_REQUIRED` and `PROJECT_SELECTION_REQUIRED` now carry the caller's allowed projects as `candidates`, `causeCode: "PROJECT_NOT_REGISTERED"` where that is the cause, and one `nextAction` that is the literal register call. A caller with no project at all is told that no deployment project belongs to a tenant its groups match, instead of only being asked for a `project` argument. Code: `src/service/scope.js`.
- **Self-service registration (FR-2).** `spec_repo {"action":"register"}` creates a project the deployment does not know and binds it: owner role on the operator's YouTrack only (`FORBIDDEN_IDP` for a bound IdP), a project id that no tenant, operator config entry or existing binding owns (`PROJECT_ALREADY_CONFIGURED`, `PROJECT_ALREADY_BOUND`, `PROJECT_ALREADY_REGISTERED`), and a credential that reads the repository. Repeating the same registration of the same repository and branch returns `unchanged` without touching the remote. Code: `src/service/repos.js`, `src/service/ops/repos.js`, `src/service/ledger.js` (registrations table in both store drivers), `src/service/dispatch.js` (the scope gate is skipped for this call only).
- **Registration widens exactly one scope.** `MountManager.registeredProjectsBy` feeds the auth boundary, so a login sees the projects it registered and nobody else's; `MountManager.registeredProjects` makes them configured, so the first specification can be created without an operator config edit. Code: `src/service/mounts.js`, `src/service/http.js`, `src/service/index.js`.
- **Credential diagnosis (FR-4).** `mcp_preflight` reports `credential.repository` (`not-bound`, `rejected`, `verified`) with one repair, and `registration.status` (`not-registered`, `registered-without-active-binding`, `self-registered`, `operator-configured`). For an owner, preflight answers for a project outside the caller's scope instead of stopping at the gate; no credential value is ever returned. Code: `src/service/index.js`, `src/service/dispatch.js`.
- **No registry-less fallback (FR-5).** The hosted transport still refuses `declaredWorktree`, and a test pins that a corpus path is never served by path.

### Verified

- `node --test tests/project-registration.test.mjs`: 19 assertions across four suites — refusal shapes, the registration gate in order, idempotent re-registration without a remote call, a real registration against a local bare repository (registration row, sealed credential, audit entry), dispatch pass-through for the owner and refusal for every other action, preflight for an owner versus a writer, and the auth-boundary scope union for the registering login only.
- `node --test tests/service/worktree-routing.test.mjs tests/service/integration.test.mjs`: routing and a real service boot on a local bare remote, both green with the changed dispatcher and mount manager.
- `npm run test:unit`: only the frozen release-candidate evidence gate fails, on files this change did not author — see the note below.
- `node scripts/check-spec-port.mjs`: `tools=10`, the surface is unchanged.

### Not yet verified

- **Live acceptance.** The deployed registry still runs the previous build, so no live registration has been exercised. First-spec bootstrap (FR-3) rides on the unchanged branch-creation path and needs that live run.
- **Repository README and CHANGELOG are unchanged on purpose.** Both files are inputs of the frozen release-candidate fixture (`tests/fixtures/release-candidate/cucumber-messages.inputs.json`), so editing them turns the evidence gate red until the fixture is recaptured for the release: `bash scripts/docker-bdd.sh` then `node scripts/refresh-cucumber-fixture.mjs`. The user-facing wording is recorded here and will land with that recapture.
