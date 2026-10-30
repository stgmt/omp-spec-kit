# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `83f58e62c7e795f04fded1572001af9b8184aa4c4f5ebf2cf92dee251b3a1188` |
| Repository base commit | `ce10e6ac0356767c25914d260aabb68703933382` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `625a82478f32eee6de0e1b23bf46ca24f2c14feb148c3fdf933842ff8084d123` |
| Source inputs | 371 files; aggregate `05b810440e5b46dd02ffc3ccfae6c4cac1d5ffa0462bfc3bedf04deaff4fab3c` |
| Source manifest SHA-256 | `6370d982f1b43c44cbf07a056a9fbe8aa2de8bbdb5332336d527a38a37db0c63` |
| Docker image digest | `sha256:e39ee59c06c93c0089e8997c30c435d2f344eac5fe6659233416189b6f0ac17d` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-10-30` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
