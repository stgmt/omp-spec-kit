# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `35369cf21bb1e9cbeba552afd3f58ce2fc8d33e35a4d4d5af8e7864b60f2913d` |
| Repository base commit | `9980a3c55bdcdadd7970b753ce13c5ae1024d3d4` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `ab5303a4a9e70bbb8a5af27d357e45a43d2e082014435b595fadca1759e875b1` |
| Source inputs | 437 files; aggregate `4366257b452a9b21f60bcb1ab1df2d99ae6b059972321940a34057cadddc4948` |
| Source manifest SHA-256 | `834fc15915e559381035b930695df15414eb815b805d35bed2206b7a4074a1d9` |
| Docker image digest | `sha256:00a179abd7af49953582a596fe6790dced54f70f6b7467fa84cc7799a9fc4489` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-08` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
