# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `075815c362523f4d07d54747cf0ba164b5f2b85a6f1b1d2d505ae0cc9223a6eb` |
| Repository base commit | `d2c9aac9811fd1899090a191f881459f996398ef` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `5e482732a410b8854aedc27071d44e294be9d6d7e928eebe5cd5fe49da15b27c` |
| Source inputs | 385 files; aggregate `d5e4b68ed1c34e88c925eb1c1db626f2ea5d190df96804843abe9020a9d23000` |
| Source manifest SHA-256 | `7be442237b2b33099324d892b8a04b03a55202f211665bc37e23ca0b8806309b` |
| Docker image digest | `sha256:e39ee59c06c93c0089e8997c30c435d2f344eac5fe6659233416189b6f0ac17d` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-10-30` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
