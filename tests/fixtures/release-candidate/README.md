# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `b0b75ad6b7da12945696656598ad950029ad5c6208080501f82a21cbf2a0fef4` |
| Repository base commit | `57ba9a3f2c563a09142e652cdb87ab4e367d8319` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `f78eef371ca70fd0bc3e1941dffdf341f800f1eaa4932104dd1f60d3866552e4` |
| Source inputs | 183 files; aggregate `30884b850610ec78d5e60c023cab55dde9bb6ecfbd09d81570cbef9f7271a104` |
| Source manifest SHA-256 | `6727862b9250128316aedd7cf225b770688d5631de6dc57f4e4806bc13cae7a4` |
| Docker image digest | `sha256:0a1295375d35619d17afb0d4c143346bfd9a043065b6dba5824b71a8a12bd520` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-09-04` |
| Executed scenarios | `7` |
| Completed steps | `69` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
