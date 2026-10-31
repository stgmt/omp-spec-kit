# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `d03541f644fbd9100f8aec064380107b86ce8b5764dbf1713d446a34a98ae075` |
| Repository base commit | `73b760a84d3fbdb16877acc52e1f4cae67654ed4` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `d03541f644fbd9100f8aec064380107b86ce8b5764dbf1713d446a34a98ae075` |
| Source inputs | 400 files; aggregate `220263df7074db30b576c7b066874836aecfc4f4eeeeb4b411e2858bc9be530d` |
| Source manifest SHA-256 | `17f1b1efc99d80aa3bab480e336aff346a6b56bccd0e01d97950c000171d5a83` |
| Docker image digest | `sha256:e39ee59c06c93c0089e8997c30c435d2f344eac5fe6659233416189b6f0ac17d` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-10-31` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
