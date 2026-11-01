# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `1cd45347836b1992de0a7cfd6bca13bb731ea129b5e3f8a63d1824ed4c9284b5` |
| Repository base commit | `eb3259ff0ca850bf7d289f9df3a71ed064030bce` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `f5c054bd07056f06efaaa886f1e25d9295507ed35745d444b63ad2878c898fe9` |
| Source inputs | 419 files; aggregate `ac34ea6966d4ca2d03e984082fc47af465b532969a74cc7c17b0fcbd00831108` |
| Source manifest SHA-256 | `ffdaa1c2a8d1a6332ad6d9354677f4c4b89f583eeb869305ed8ed44e4e46da74` |
| Docker image digest | `sha256:aa454842a3c85544c246bc4f6d685809ac9994391aef1c07564419170012ebed` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-01` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
