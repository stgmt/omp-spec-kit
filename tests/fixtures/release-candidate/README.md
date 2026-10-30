# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `5e482732a410b8854aedc27071d44e294be9d6d7e928eebe5cd5fe49da15b27c` |
| Repository base commit | `8f6fe350cea252b3787c37071a41b50189fb528b` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `7b88313d63ed53e94536e6af981b8f6aedf271af9e2986d389703a4b38a669ac` |
| Source inputs | 383 files; aggregate `5922f9c7d42306f35849fd0ef95c95a9cd0ebefbad1803160335a451e9eaf703` |
| Source manifest SHA-256 | `6b337b3ccd11d4e130696c0962f9ba53ec0aea98d6a0d1669f9eacdbf6ddc9c1` |
| Docker image digest | `sha256:e39ee59c06c93c0089e8997c30c435d2f344eac5fe6659233416189b6f0ac17d` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-10-30` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
