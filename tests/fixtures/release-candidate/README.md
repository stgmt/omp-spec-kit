# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured from the repository's Docker BDD container. It is read-only: semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed immutable provenance record. The BDD fixture loader verifies every field, the SHA-256 of the raw fixture bytes, and the documented scenario and completed-step counts before either the release-candidate oracle or any mutation is used.

| Field | Value |
|---|---|
| Fixture SHA-256 | `3f748539baa884a29b3c99e94d98087a1e8876257d924719238e89ab64f44335` |
| Repository commit | `86a80f59d600d6c6f2c581c93d55fd3981a92989` |
| Docker image digest | `sha256:75680db26398fa5250cbb349f523d8d481ed50aa91fa758c8b6e1c7298f6daab` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `wsl.exe -e bash -lc "docker run --rm --env OMP_SPEC_KIT_BDD_MESSAGE_STDOUT=1 omp-spec-kit-bdd:local"` |
| Capture date | `2026-08-24` |
| Scenario count | `38` |
| Completed-step count | `302` |

Ground truth: the stream contains a complete passing execution chain for every release-evidence-tagged scenario: `pickle`, `testCase`, `testCaseStarted`, `testStepFinished` with `PASSED`, and exactly one `testCaseFinished` for each start. The evaluator rejects meta-only, malformed, duplicate-terminal, retry-only, missing-chain, and non-passing-terminal-step evidence with a named `CucumberEvidenceError` code.
