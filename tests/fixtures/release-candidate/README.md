# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `b6b61b275b5d14f52687bc039f7c261f2d644fab2c2b73a9b03f21add0ee50fc` |
| Repository base commit | `489ef3d60b99db153dd5c693eb908b3c4a8530a3` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `ed9d408145adf27a20f48a575580e54243f24b3f8f125d2bfdcc3edce55a4b19` |
| Source inputs | 449 files; aggregate `7a6eb63f3002afe735321f18cc30a54352baa4784c3bfc227c92806176fc00c4` |
| Source manifest SHA-256 | `66caa75403a741817f8ce666c76c95e03b6e715d6c658075a85a0ef2f114e450` |
| Docker image digest | `sha256:d20487725a654e437d28661d91b913fbd89a008caedf86ced32b2516485eae2c` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-14` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
