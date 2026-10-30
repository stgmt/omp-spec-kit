# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `7b88313d63ed53e94536e6af981b8f6aedf271af9e2986d389703a4b38a669ac` |
| Repository base commit | `e5c2a9e4bbcc13a5a16cf9d2d89703c3e2b8f1af` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `0011c2aab31e5257f63c898adc233df084653c0694c651b029eaa3a9ed59a07a` |
| Source inputs | 383 files; aggregate `ea8e031a394c57d678de8cc4b45471ee7222e209e28e12de8e5d68d1a954300e` |
| Source manifest SHA-256 | `f34ebf244263ca973abc959a753e63915349a23846473b6b1a3561c55c0d1083` |
| Docker image digest | `sha256:e39ee59c06c93c0089e8997c30c435d2f344eac5fe6659233416189b6f0ac17d` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-10-30` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
