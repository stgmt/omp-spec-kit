# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `4ccf3507cede34b9c6ff53aebca2b73b9f51c42d937a8aa4a80d5b207e95eaca` |
| Repository base commit | `22b5175ead5c94032ea4bc857324e09aea73a2aa` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `1cd45347836b1992de0a7cfd6bca13bb731ea129b5e3f8a63d1824ed4c9284b5` |
| Source inputs | 419 files; aggregate `188a7ff6e489610dd9f2e7ab21f8a62cb32f1969b51b76ba6d70e106aefff275` |
| Source manifest SHA-256 | `4edb1471a6e3ccee350c3a0b9704dd866d571b14f4e6df4b0cc07b57ae359285` |
| Docker image digest | `sha256:022b0a7d481808e17997c1a569a6d9abd0b547aa505163a4db7177565aef9781` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-01` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
