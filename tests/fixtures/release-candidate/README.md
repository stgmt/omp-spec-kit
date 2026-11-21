# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `29df25867b3fdcdce7980bf18e81e879886fd1a07e78f84657d06de2c79f8b6c` |
| Repository base commit | `ba6853ca9bc62a372b9fafc3299c3b1f0aae6f5f` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `c5528985146bf1ff9838963a31c33e8157b39cf6304c4c61df880bb6256d9843` |
| Source inputs | 485 files; aggregate `717cb04de94e37bf2159141fdd215ec90b40b0a02c60cf1d720b8b8ab60eff2e` |
| Source manifest SHA-256 | `40be11c4e1541877844c26c947038d364ad501cc91cba3f10bcff87cc6656fa4` |
| Docker image digest | `sha256:9376adfbc0c4c5943ab5dfc1b396638ecd0111a4165f5a8419c388e1fe733e34` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-21` |
| Executed scenarios | `35` |
| Completed steps | `69` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
