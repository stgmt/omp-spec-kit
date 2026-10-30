# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `e52aa44444233bf32d983899529139b544c35d31a4ffbe2b96f4559504c2a484` |
| Repository base commit | `30013ab0742863187c00a0f428645522177be0bc` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `f46dcc021b311314ce2ed022d54fa277a90c0c75dccb00100dfe9ae84737e467` |
| Source inputs | 383 files; aggregate `dd57f993a215c95784c403c4a25620b76a34a744bbe1ae87b97e0c5378d91f04` |
| Source manifest SHA-256 | `4dfa5dcc7b2d9c5fd78a6d4ef96f1e811ec46bdb1b5619d300116fedab2a4f8d` |
| Docker image digest | `sha256:e39ee59c06c93c0089e8997c30c435d2f344eac5fe6659233416189b6f0ac17d` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-10-30` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
