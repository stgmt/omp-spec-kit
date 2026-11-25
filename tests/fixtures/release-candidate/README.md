# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `d4c2fe63244010a175566e943b9a834254a6a7a01defdb3130332665b4735b61` |
| Repository base commit | `76a3d6ca42f1a3f867d91136271a7c0cd8b923d8` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `d71843b77e53dc2c101c118d6a7317853566751b53d5dfaeb44c89b42586b2ad` |
| Source inputs | 508 files; aggregate `25517618c584210b7e1f4f79a3fc8cbb293c1a9e9bc8625f3832d666a4ac3bd9` |
| Source manifest SHA-256 | `ab91d8873ba0da07d8f3a052f2566942e8d7c926042bdd62a229d056d6c193ab` |
| Docker image digest | `sha256:9bea519cb1a85e9d321d1962728fb2620bcc3e2a0241749c5c75213c268d9549` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-25` |
| Executed scenarios | `8` |
| Completed steps | `69` |

Ground truth: the stream contains the six required release contract scenarios and eight executed product-test scenarios in total. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
