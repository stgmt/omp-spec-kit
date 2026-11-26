# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `c976adc2ef4a7ba5ec6225873c3825947a8c46a1845e9043239d8afe65ed1d71` |
| Repository base commit | `0ca0c3a0b20d7ebb0cb307ab0430ca270b92cdf9` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `d4c2fe63244010a175566e943b9a834254a6a7a01defdb3130332665b4735b61` |
| Source inputs | 514 files; aggregate `803496eb3dafc0c3d7a7e2acd85484aa17ebf70e8a07295e60f35b4ecb1a6820` |
| Source manifest SHA-256 | `1c6c110fee00125d4c341477f24351477004b97f7d72504c54d2ecf662f94fa8` |
| Docker image digest | `sha256:59a96a327d9157c13d102169bd782b7614282602f8002deeb2d5dfa0b4535eb7` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-26` |
| Executed scenarios | `8` |
| Completed steps | `69` |

Ground truth: the stream contains the six required release contract scenarios and eight executed product-test scenarios in total. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
