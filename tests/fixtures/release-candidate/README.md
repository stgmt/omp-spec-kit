# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `6b505dd7fd4200d15c17926f696fa79411f26d9366f203fc602b7fa74a477c6d` |
| Repository base commit | `c28aa17490f3b7c04020a21c382b0a208fea5e30` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `1c6f2bb783cb3515c8194563223135523723d97b800855cd707463a6a53cc171` |
| Source inputs | 459 files; aggregate `171aa4005a50723550ffb05fee9b50fbb0a41b2cc3600a764e2e44213ab79140` |
| Source manifest SHA-256 | `1ef2153c6a8a3568795cbf05b5cdebecd34d324b6a4f47e0e4969fb61cab3fc7` |
| Docker image digest | `sha256:4ba2751dbaf8730385b6fd1779765bfd0affb59cecc2e958bc33a0a3244838d5` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-16` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
