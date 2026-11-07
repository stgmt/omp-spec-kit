# Local Corpus Mode

- **Status:** backlog

> **Not part of release 3.4.0.** Owner decision of 2026-11-08, recorded in issue #51: a project must be registered in the registry, so a registry-less local mode is out of scope. This specification is kept as the design record; the delivered path is `spec-project-registration`, and the internal URI allowlist moved to phase 5 of `roadmap-3-4-0`.

The work recorded here measured what an agent meets on a repository the registry does not know: a resolution refusal with no next action, a preflight report that omits the transport, the registry reachability and the guard mode, and an internal URI scheme treated as a filesystem path. The first two are answered by the registration specification; the third is answered by the release hygiene phase.

## What this record contains

- The measured refusal chain and the observed preflight gaps, kept as evidence for the registration specification.
- The internal URI allowlist defect: `proc` and `out` are resolved as paths while `agent` and the other schemes continue.

## Public states

- **BACKLOG.** Requirements in this directory describe a mode the owner declined. They are not commitments, not in the release view, and not referenced by any active specification.

## Documents

[Requirements](REQUIREMENTS.md) · [NFR](NFR.md) · [FR](FR.md) · [AC](ACCEPTANCE_CRITERIA.md) · [Design](DESIGN.md) · [Tasks](TASKS.md) · [Files](FILE_CHANGES.md) · [Changelog](CHANGELOG.md) · [BDD](spec-local-corpus-mode.feature) · [Fixtures](FIXTURES.md)

Local IDs become qualified outside this directory, for example `spec-local-corpus-mode:FR-1`.
