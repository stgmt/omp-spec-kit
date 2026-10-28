# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `4d6835af478e839c42bfaf9ee82bd206e1f6f6ab3c8e1ab532e3989900468607` |
| Repository base commit | `e7e900f0aab0d5591ceeee83feeb7d87a1bd5329` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `70e62c2862b3810f07abbf816f67109b016d483fbe9b6e983e95b5156218447a` |
| Source inputs | 361 files; aggregate `d6b64a14a40867970e974e69f7d002941c847a36228565f064621ecfea56b875` |
| Source manifest SHA-256 | `842c72f64adc7474a2434ef7d4f6a38f55e2942df65e7162b8afd358dc72133f` |
| Docker image digest | `sha256:e39ee59c06c93c0089e8997c30c435d2f344eac5fe6659233416189b6f0ac17d` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-10-09` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
