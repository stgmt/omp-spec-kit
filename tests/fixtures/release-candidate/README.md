# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `f5c054bd07056f06efaaa886f1e25d9295507ed35745d444b63ad2878c898fe9` |
| Repository base commit | `f49cf7b8cee06cb52e1beee3f24cf85f6b8351f4` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `d2bd0a2c6c287972e40a8e336d5a3ed75e6786a719ec12c28a38b1f1be69ea89` |
| Source inputs | 413 files; aggregate `41fc094ec1fc28355206121a343b11af290887ac817520b6174629e2a20b3c5b` |
| Source manifest SHA-256 | `c47e6272eacd45f32e2077a6baf271dc35d732ed41abf8a856d7544742f1e72a` |
| Docker image digest | `sha256:e39ee59c06c93c0089e8997c30c435d2f344eac5fe6659233416189b6f0ac17d` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-10-31` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
