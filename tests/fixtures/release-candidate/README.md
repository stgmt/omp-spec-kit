# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `c568d98c1137688950286d57271b3d9a3aa0de5114bc18de5185d923246717dd` |
| Repository base commit | `843b40af742592a74964f101f41d7dfa6cf3223b` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `eadb0c0ec669ecef114d49371886f53b6fa6ee0c496291d21ba932650a20424e` |
| Source inputs | 186 files; aggregate `d3c32661aedddd1f74cb278eb35cb0f7e75d283ae0cabd7a142e3b2cfcf2a2b3` |
| Source manifest SHA-256 | `4b09cf6c6abe572d36d1e54c8592127b6859acbed6c1c4bf4117fb05d3425751` |
| Docker image digest | `sha256:48633e327b2e8ff30f38ebc0a5710165b62b37e9dc46a1758d1ffc9147fcdae9` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-08-31` |
| Executed scenarios | 58 |
| Completed steps | 493 |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
