# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `d2bd0a2c6c287972e40a8e336d5a3ed75e6786a719ec12c28a38b1f1be69ea89` |
| Repository base commit | `cfc1edc2b34db49dde607f7927de67d4df38f189` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `8d7491786f1b1eaee915faec35ec4917d3e94e5517d678f020c84b5e9ba0c059` |
| Source inputs | 412 files; aggregate `3b0f7904af39f5d36bae1f3ecca0436c127cb3ee4a85b6ea13576e7b88148060` |
| Source manifest SHA-256 | `aa8e68db4ab4646bfa398eaec0d5119b6ff8bad3d5e027cfafb9acdd386f4cc4` |
| Docker image digest | `sha256:e39ee59c06c93c0089e8997c30c435d2f344eac5fe6659233416189b6f0ac17d` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-10-31` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
