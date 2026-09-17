# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `0189f850d09c7fe05f2afd9adcf92e41e9917b5b4b43443c327c363cbff2c345` |
| Repository base commit | `a865ac2c5a4154088e67ba52ef697d29dc648ede` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `b0b75ad6b7da12945696656598ad950029ad5c6208080501f82a21cbf2a0fef4` |
| Source inputs | 331 files; aggregate `ad17a727c10080729ddaeb1af7fb0179862a6f167ce5e1c5b0d1fbb501fa986a` |
| Source manifest SHA-256 | `921d734cb1ed53375464f81b82a4e50bc7c0cfcfacaef2fee3d69b1d33d852f6` |
| Docker image digest | `sha256:314737dfede8fcbb5304a193819906aca8128272f1d0c7a04d977ebfde823471` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-09-17` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
