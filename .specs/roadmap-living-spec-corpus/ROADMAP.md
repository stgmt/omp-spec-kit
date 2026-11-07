# Roadmap: Living Specification Corpus

> **Profile: roadmap** — human-facing convention; the kernel identifies this spec by the `roadmap-` slug prefix.

## Authored narrative

Release 3.4.0 makes the corpus maintainable through the tool. Until now an agent that could not open a project edited files around the guard, restated one rule in several documents and marked work done without running the check it promised. Each phase below removes one of those paths.

The order is deliberate. Local mode comes first because nothing else can be exercised on a repository the registry does not know. The bundle comes second because the workaround for unbatched edits is what produced duplicate headings. Decisions come third because a contradiction inside a specification costs a wrong implementation. Verification closes the loop, so completion stops being a claim.

## Auto-assembled items

<!-- roadmap:auto:start -->
### roadmap-living-spec-corpus
- [planned] FR-1 — Phase 1 — a corpus opens without a registry (FR)
- [planned] FR-2 — Phase 2 — one bundle, one diff (FR)
- [planned] FR-3 — Phase 3 — decisions and open questions (FR)
- [planned] FR-4 — Phase 4 — executable verification (FR)
- [planned] FR-5 — Phase 5 — later waves declared and gated (FR)

### spec-decision-drift
- [planned] FR-1 — Open questions as entities (FR)
- [planned] FR-2 — Structured decision metadata (FR)
- [planned] FR-3 — Decision drift diagnostic (FR)
- [planned] FR-4 — Open questions block work (FR)
- [planned] FR-5 — Superseded decisions (FR)

### spec-local-corpus-mode
- [planned] FR-1 — Local corpus resolution without a registry (FR)
- [planned] FR-2 — Preflight reports the resolution state (FR)
- [planned] FR-3 — Registry reachability probe (FR)
- [planned] FR-4 — Internal URI schemes are not filesystem targets (FR)
- [planned] FR-5 — Refusals explain and offer one next action (FR)
- [planned] FR-6 — Local writes are transactional and unauthenticated (FR)

### spec-patch-bundle
- [planned] FR-1 — Unified diff with hunks and context (FR)
- [planned] FR-2 — Section-end append and keyed bullet upsert (FR)
- [planned] FR-3 — Ordered operations on one document (FR)
- [planned] FR-4 — Explicit preview truncation and size report (FR)
- [planned] FR-5 — Create a specification with authored documents (FR)

### spec-verify-runner
- [planned] FR-1 — Executable task checks (FR)
- [planned] FR-2 — Run under an allowlist and a timeout (FR)
- [planned] FR-3 — Evidence records (FR)
- [planned] FR-4 — Completion requires a fresh green run (FR)
- [planned] FR-5 — Spend authorization (FR)
- [planned] FR-6 — External result writers and last-green answers (FR)
<!-- roadmap:auto:end -->

## Later waves

- Coverage matrix: requirement to criterion to scenario to task to file, with the uncovered columns named.
- Zone guard: a staged diff compared with the file zones of active tasks, blocking an out-of-zone file and warning on code changed with no active task.
- Corpus context: a compact session package, ranked localisation, mechanical autofixes and typed supersession links.
