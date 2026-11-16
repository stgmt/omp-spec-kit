# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `98b957870048baccb8bd9ce7e977ad51298cf2bcfd534e36d2a3defbcb338674` |
| Repository base commit | `63d63e7de122bd07d6b79bcf9017fc988eafa700` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `3dc835b51e3594d7bf280923072c08b6f2436a4fe41cd4eb7b70b5b47e617369` |
| Source inputs | 456 files; aggregate `e2c0283b990a6e9b1c91f6590d7dc127445f8604d261ef6576f7cde2a870bb4d` |
| Source manifest SHA-256 | `a55e5e33f111dc790557b4b1a27b9a52c2c8394466ff0961a4230b2eb76bf994` |
| Docker image digest | `sha256:15b0be2079d67755cd4a2903f575037ed4b67c75c17375d337f23ffedc317900` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-15` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
