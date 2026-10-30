# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `129e0024e30ad74e55a4b3abb5b716298d5c5812be5113f3f9a3292a5b9c91a6` |
| Repository base commit | `309ea88b992d92fc3d7a9c6af72daccc894a07e7` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `075815c362523f4d07d54747cf0ba164b5f2b85a6f1b1d2d505ae0cc9223a6eb` |
| Source inputs | 389 files; aggregate `1137bb57a7e604c8d13a141fa1cd66607bf79c4fd69b4eaf8dc7c46c68516fca` |
| Source manifest SHA-256 | `23ec15bfffa42ff0793dd43d85e1a610f2f6d75b34ebe2db39d806c60e408526` |
| Docker image digest | `sha256:e39ee59c06c93c0089e8997c30c435d2f344eac5fe6659233416189b6f0ac17d` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-10-30` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
