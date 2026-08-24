# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured from the repository's Docker BDD container on 2026-08-24.

Capture command:

```text
wsl.exe -e bash -lc "docker run --rm --env OMP_SPEC_KIT_BDD_MESSAGE_STDOUT=1 omp-spec-kit-bdd:local"
```

Producer: `@cucumber/cucumber` 13.2.1 using the repository's `cucumber.mjs` configuration.

Ground truth: the stream contains a complete passing execution chain for every release-evidence-tagged scenario: `pickle`, `testCase`, `testCaseStarted`, `testStepFinished` with `PASSED`, and `testCaseFinished`. The evaluator must reject a stream containing only `meta`, missing any chain member, or any non-passing step.
