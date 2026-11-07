# Local Corpus Mode

Status: DRAFT

Release 3.4.0, wave 1a of issue #51. A specification corpus SHALL be usable directly from a working tree: no registry project, no token, no project selection. Every resolution outcome SHALL be describable in one object, so a caller learns why a corpus is unavailable instead of guessing.

This specification owns: local corpus resolution on the stdio transport, the `PROJECT_LOCAL` resolution outcome, the preflight report that doubles as a state doctor, registry reachability probing, and the internal-URI allowlist of the enforcement guard.

It does not own: corpus containment and read redirection (`spec-mcp-access-gate`), the hosted registry service and its project scopes (`spec-registry-service`), the patch operation surface (`spec-patch-bundle`), scenario and command evidence (`spec-verify-runner`), or the task graph itself (`spec-mcp-operations`).

## Public states

- **DRAFT.** Nothing is implemented. The current behaviour this specification replaces is measured in issue #51: `PROJECT_REQUIRED` and `PROJECT_NOT_ALLOWED` are reachable on a repository whose corpus is a plain working tree, and the preflight report omits the transport, the registry reachability, the guard mode and the next action.
- **Blocking dependency removed:** the enforcement guard currently treats `proc` and `out` as filesystem targets (`src/enforcement/resolve-targets.js`), so a read-only introspection call is refused before any corpus work starts.

## Documents

[Requirements](REQUIREMENTS.md) · [NFR](NFR.md) · [FR](FR.md) · [AC](ACCEPTANCE_CRITERIA.md) · [Design](DESIGN.md) · [Tasks](TASKS.md) · [Files](FILE_CHANGES.md) · [Changelog](CHANGELOG.md) · [BDD](spec-local-corpus-mode.feature) · [Fixtures](FIXTURES.md)

Local IDs become qualified outside this directory, for example `spec-local-corpus-mode:FR-1`.
