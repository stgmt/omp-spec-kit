# Roadmap: Living Specification Corpus

> **Profile: roadmap** — human-facing convention; the kernel identifies this spec by the `roadmap-` slug prefix.

## Authored narrative

Release 3.4.0 makes the corpus maintainable through the tool. Until now an agent that could not open a project edited files around the guard, restated one rule in several documents and marked work done without running the check it promised. Each phase below removes one of those paths.

The order is deliberate. Local mode comes first because nothing else can be exercised on a repository the registry does not know. The bundle comes second because the workaround for unbatched edits is what produced duplicate headings. Decisions come third because a contradiction inside a specification costs a wrong implementation. Verification closes the loop, so completion stops being a claim.

## Auto-assembled items

<!-- roadmap:auto:start -->
<!-- roadmap:auto:end -->

## Later waves

- Coverage matrix: requirement to criterion to scenario to task to file, with the uncovered columns named.
- Zone guard: a staged diff compared with the file zones of active tasks, blocking an out-of-zone file and warning on code changed with no active task.
- Corpus context: a compact session package, ranked localisation, mechanical autofixes and typed supersession links.
