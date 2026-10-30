# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `d03541f644fbd9100f8aec064380107b86ce8b5764dbf1713d446a34a98ae075` |
| Repository base commit | `966ed489c154f3a13bcd37ca4209e2a541c0e138` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `129e0024e30ad74e55a4b3abb5b716298d5c5812be5113f3f9a3292a5b9c91a6` |
| Source inputs | 391 files; aggregate `e1320ba04063507fb6fa7c286b281b2291fec5263d080e130f4dd362a7eabd4c` |
| Source manifest SHA-256 | `06563c326ce25b62b9ecc26ccf4cf9d38595ca1119775197eda7ba942f5ec1b8` |
| Docker image digest | `sha256:e39ee59c06c93c0089e8997c30c435d2f344eac5fe6659233416189b6f0ac17d` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-10-30` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
