# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `d0a86ea78a6eeda848b96e1c4afa56115890d0ef318074f8b052bcbdee4bc4de` |
| Repository base commit | `202209c2ea00438b0f237ec78368d68ca7c0fb7e` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `83f58e62c7e795f04fded1572001af9b8184aa4c4f5ebf2cf92dee251b3a1188` |
| Source inputs | 372 files; aggregate `5013ceffefc8869cbdb55a584b1abce6bb8ed419b1a94dc81f6c893257fe8f52` |
| Source manifest SHA-256 | `bc9b49a08a794f53a550a56610169cb5e4951a9608c124cf21903091b32381b5` |
| Docker image digest | `sha256:e39ee59c06c93c0089e8997c30c435d2f344eac5fe6659233416189b6f0ac17d` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-10-30` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
