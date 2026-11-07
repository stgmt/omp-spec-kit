# Roadmap: Living Specification Corpus

Profile: roadmap
Status: active

Release plan for 3.4.0. The release answers one question: can an agent keep a specification corpus correct through the tool itself, on a repository the registry does not know, with decisions that cannot drift and checks that actually run?

The roadmap covers four feature specifications, in the order they unblock each other, and declares the two waves that follow. A phase enters this roadmap as done only when its own specification's acceptance criteria are green on a release candidate and the evidence is recorded.

## Phases

1. **Local corpus mode** (`spec-local-corpus-mode`) — a corpus opens with no registry project, and preflight says why when it does not.
2. **Patch bundle** (`spec-patch-bundle`) — one call expresses a whole authoring change and returns a reviewable unified diff.
3. **Decision drift** (`spec-decision-drift`) — owner decisions and open questions are entities, and a value stated twice differently fails validation.
4. **Verify runner** (`spec-verify-runner`) — a task's check is a command that runs, and done means green on the current commit.
5. **Later waves** — the coverage matrix and the commit-time zone guard, each with its own specification.

## Documents

[Roadmap](ROADMAP.md) · [FR](FR.md) · [NFR](NFR.md) · [AC](ACCEPTANCE_CRITERIA.md) · [Tasks](TASKS.md) · [Files](FILE_CHANGES.md) · [Changelog](CHANGELOG.md) · [BDD](roadmap-living-spec-corpus.feature)

Local IDs become qualified outside this directory, for example `roadmap-living-spec-corpus:FR-2`.
