# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `f5c054bd07056f06efaaa886f1e25d9295507ed35745d444b63ad2878c898fe9` |
| Repository base commit | `20b09059c5fdaa33bd32035dab5dac670bacddf8` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `f5c054bd07056f06efaaa886f1e25d9295507ed35745d444b63ad2878c898fe9` |
| Source inputs | 419 files; aggregate `dd3493a6371c73dcdc64d5ee4a66b177f24df1c43d3d4a344a9a3415148221fb` |
| Source manifest SHA-256 | `57dbe40b05c6c1fdbf0081b6aaafa95e60161de62039601329abfc82d305dc9b` |
| Docker image digest | `sha256:e39ee59c06c93c0089e8997c30c435d2f344eac5fe6659233416189b6f0ac17d` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-01` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
