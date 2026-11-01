# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `108e598ecd3d644414585cd19deac072f90dcc86ef24a7deaf3e49ab07ac9f6e` |
| Repository base commit | `79ee118f42fe0164eb71f82db8c9ceb4ecdbb36c` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `108e598ecd3d644414585cd19deac072f90dcc86ef24a7deaf3e49ab07ac9f6e` |
| Source inputs | 427 files; aggregate `30ad41f4bad8c6b4a4b5a1845caf08105dced38ea8199aa4a21a3423e9c9d4ca` |
| Source manifest SHA-256 | `c4cbea4aaaf62f708d6451f24672122c4d2d8ecbdd6a3279dbe944dc83690410` |
| Docker image digest | `sha256:00a179abd7af49953582a596fe6790dced54f70f6b7467fa84cc7799a9fc4489` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-01` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
