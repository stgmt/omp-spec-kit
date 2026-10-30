# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `5f9ff44e39132360867ccb19ec2fbbdb4edc4cb4ac35b8f62de8a55dbd5e4b26` |
| Repository base commit | `a07b24998bfff72e57f046d1a104721f7b5fb5d8` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `8349390d47b6a254e7b7e3590e7aad1e34d31cebd9efee2e15ad83c1f8f689f0` |
| Source inputs | 375 files; aggregate `08fc47cfb28cdcde2c4d218cbfebef8145cad440e68572dc3e02535bfd518dae` |
| Source manifest SHA-256 | `b62c499fe4be2373645e966283bdfe2f02f2fc526b6752dce92a3becc003d056` |
| Docker image digest | `sha256:e39ee59c06c93c0089e8997c30c435d2f344eac5fe6659233416189b6f0ac17d` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-10-30` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
