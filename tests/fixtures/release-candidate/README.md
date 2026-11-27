# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `c976adc2ef4a7ba5ec6225873c3825947a8c46a1845e9043239d8afe65ed1d71` |
| Repository base commit | `3e6cfac528e6bd6277cb333fb4138d530b1146e4` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `d4c2fe63244010a175566e943b9a834254a6a7a01defdb3130332665b4735b61` |
| Source inputs | 516 files; aggregate `6d5db24b87653fcea59b0ec6e3351c010bf617fe67e0fbfa7691e07b4ad87580` |
| Source manifest SHA-256 | `25b0cde4572a89be08b11e7d6f4cafa8d3f4276498478b3101675610d0acdbfd` |
| Docker image digest | `sha256:26d239c9f2fa12896010a6f8acf38fb5ba45afa41cc1b0141cca0eba43123c98` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-27` |
| Executed scenarios | `8` |
| Completed steps | `69` |

Ground truth: the stream contains the six required release contract scenarios and eight executed product-test scenarios in total. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
