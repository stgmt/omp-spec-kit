# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `d71843b77e53dc2c101c118d6a7317853566751b53d5dfaeb44c89b42586b2ad` |
| Repository base commit | `ffba914e5e4ddadb3b07504c26a2ffa51c8cfc5c` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `6867d1711ef08289837189454c83b65132ceb14256d1f146cd015d1508b3566f` |
| Source inputs | 508 files; aggregate `954047294283f0a3cf39e2881438f7773f4060cca62916f7c5211571b53e7307` |
| Source manifest SHA-256 | `65e40a42ed729467e841bd15b7786290a3945ca167b247dd90e216bdb7f8e1b0` |
| Docker image digest | `sha256:32da9db58efed2f91d4d60de848527a9b9784583fc2b6038be3f2fd82ca80c83` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-25` |
| Executed scenarios | `8` |
| Completed steps | `69` |

Ground truth: the stream contains the six required release contract scenarios and eight executed product-test scenarios in total. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
