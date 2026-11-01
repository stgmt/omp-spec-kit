# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `8ffc46365ab7279769bff68a660639f5401bf5e9830b5533ec5284962e8bf37c` |
| Repository base commit | `19a4667d2e87b4812b5f3f20c70df1207778b3e3` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `4ccf3507cede34b9c6ff53aebca2b73b9f51c42d937a8aa4a80d5b207e95eaca` |
| Source inputs | 420 files; aggregate `95e516c4126a91af39c768572e7dc4c120433c15a526ba991182cf62d714b95f` |
| Source manifest SHA-256 | `3647171a0bd946fe172d08c7968cb01a9ca4a6e51219d352a7055026a203271a` |
| Docker image digest | `sha256:60a68c6654be1395b7e1ca8b278db5cdb91e04732bfeb50753518a8939d84aed` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-01` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
