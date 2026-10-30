# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `f46dcc021b311314ce2ed022d54fa277a90c0c75dccb00100dfe9ae84737e467` |
| Repository base commit | `f895b05eff8dea426c8469fa9bea1a6d8573aab9` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `59504ed85c8572313a02d88fdef4661df1c45acab698d51289ad0c672071c28a` |
| Source inputs | 383 files; aggregate `3f72e1e85f90db09e8d45860dd3115b1c4c27844c9eb2427f9e765e29febd6b7` |
| Source manifest SHA-256 | `a22ab6917496faba44ff2b8415195ae0f6d291fa3c539abfeeb5924d5e86fc30` |
| Docker image digest | `sha256:e39ee59c06c93c0089e8997c30c435d2f344eac5fe6659233416189b6f0ac17d` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-10-30` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
