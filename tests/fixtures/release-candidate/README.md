# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `f26f38d0d346fb390c9f447958dfdcdffd16dd77e5d0e82d8e15ce40b2075b4e` |
| Repository base commit | `8ec713b4b953cdd9ec03533e523751e644c0da24` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `f15c0d2cfcb64db14efb1f956eedbc0d4102cc26bb968ef491f882ad6a2c2e85` |
| Source inputs | 436 files; aggregate `eb8a23d5c3367a407e20782556fafd5f337ae9a89ef1dfc453ebcce2d920d4ea` |
| Source manifest SHA-256 | `9361bd9f6df294e808f66b3ca215496b00d3e4a4b65d6053f17408a09772b3e9` |
| Docker image digest | `sha256:00a179abd7af49953582a596fe6790dced54f70f6b7467fa84cc7799a9fc4489` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-08` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
