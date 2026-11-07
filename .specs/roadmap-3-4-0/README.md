# Release 3.4.0

Profile: roadmap
Status: active

Single source of truth for this release: issue #51. This specification is the release itself — numbered after the version — and it links one feature specification per wave. Nothing in this release is in scope unless it is either a phase below or a hygiene item named in phase 5.

The question the release answers: can an agent register a project and then keep its specification corpus correct through the tool itself — with decisions that cannot drift and checks that actually run?

Owner decision of 2026-11-08, recorded: **a project must be registered in the registry.** An unregistered project being refused is correct behaviour. The release therefore delivers the registration path, not a registry-less local mode; any local fallback is explicitly out of scope and phase 1 forbids it.

## Phases

1. **Registration path** (`spec-project-registration`) — an unknown project is refused with one actionable step, and an authorized principal can register through the tool.
2. **Patch bundle** (`spec-patch-bundle`) — one call expresses a whole authoring change and returns a reviewable unified diff.
3. **Decision drift** (`spec-decision-drift`) — decisions and open questions are entities, and a value stated twice differently fails validation.
4. **Verify runner** (`spec-verify-runner`) — a check is a command that runs, and done means green on the current commit.
5. **Release hygiene and later waves** — the defects listed in issue #51 that are not capabilities, and the two waves that follow.

## Documents

[Roadmap](ROADMAP.md) · [FR](FR.md) · [NFR](NFR.md) · [AC](ACCEPTANCE_CRITERIA.md) · [Tasks](TASKS.md) · [Files](FILE_CHANGES.md) · [Changelog](CHANGELOG.md) · [BDD](roadmap-3-4-0.feature)

Local IDs become qualified outside this directory, for example `roadmap-3-4-0:FR-1`.
