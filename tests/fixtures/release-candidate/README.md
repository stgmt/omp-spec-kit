# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `0011c2aab31e5257f63c898adc233df084653c0694c651b029eaa3a9ed59a07a` |
| Repository base commit | `6c6d01a1b897c147cab170cd0ccac75b2c7862cd` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `09975ec0de0f2b971bf7903e4dd7587c0fcca8d10f49eaadff077fe2f6eaf7e7` |
| Source inputs | 383 files; aggregate `a36cb6c239e869fc4e0f0e7aa1d220ba330891902bd118dc75e42839b5004d8b` |
| Source manifest SHA-256 | `fe82b4749d5296306800f57d3f8a5278fe3c1bb32170d421836d0580e751dd34` |
| Docker image digest | `sha256:e39ee59c06c93c0089e8997c30c435d2f344eac5fe6659233416189b6f0ac17d` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-10-30` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
