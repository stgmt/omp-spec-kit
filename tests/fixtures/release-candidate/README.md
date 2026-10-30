# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `389314c20a245620cef8608dfaa64e10329955f8bde02461452137d63a23f687` |
| Repository base commit | `9b3d7ea867d236a65d79bd4f523a73e31f3c9e03` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `5f9ff44e39132360867ccb19ec2fbbdb4edc4cb4ac35b8f62de8a55dbd5e4b26` |
| Source inputs | 381 files; aggregate `2472095f148807a6fb0a5c1dde95ba78d3715862fccfb01f74a4d691031e6ed2` |
| Source manifest SHA-256 | `276f71aed857f6775f6f6d0f110b8cea3c15f0ea8dac4fd5bb406e54987d847b` |
| Docker image digest | `sha256:e39ee59c06c93c0089e8997c30c435d2f344eac5fe6659233416189b6f0ac17d` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-10-30` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
