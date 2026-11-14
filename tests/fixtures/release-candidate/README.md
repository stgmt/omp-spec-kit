# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `b9d483cf8d6d16d36c492d122f7ef10b4ceb6a1608921e9d07696c4698ba9d86` |
| Repository base commit | `5f7fe7d2018ec7361f541d7733aa4cd8dec5e4ca` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `b9d483cf8d6d16d36c492d122f7ef10b4ceb6a1608921e9d07696c4698ba9d86` |
| Source inputs | 447 files; aggregate `9603aaca2fc785f53cfb7affae97e783c6833ba517c647181cfa816d69251b44` |
| Source manifest SHA-256 | `c6c8dc05a41830fc2db7a6845fcc63873e81428481748aa78369bd5f5f90fc88` |
| Docker image digest | `sha256:f42e9688810c7b3c411714966ed149cbc060f906177f6bde267c67d511f2eaad` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-14` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
