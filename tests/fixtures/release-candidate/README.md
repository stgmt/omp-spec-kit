# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `797fe43c062423f1b0d9db5021cdf4f00700f08c074daae4272e26719591be76` |
| Repository base commit | `c2589032739c51b5ce9d990aeb654a463e755f02` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `797fe43c062423f1b0d9db5021cdf4f00700f08c074daae4272e26719591be76` |
| Source inputs | 427 files; aggregate `3d7a5afef555fe0ac64dfb70085f725db9da3797a8fe2f9955f56eaf20fd6509` |
| Source manifest SHA-256 | `bd9062b2bb6d2c5c837f9df5f2c8fc1d9c53df741f7edbca27128da58cca0a70` |
| Docker image digest | `sha256:00a179abd7af49953582a596fe6790dced54f70f6b7467fa84cc7799a9fc4489` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-01` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
