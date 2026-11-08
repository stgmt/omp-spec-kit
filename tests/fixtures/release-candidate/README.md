# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `ab5303a4a9e70bbb8a5af27d357e45a43d2e082014435b595fadca1759e875b1` |
| Repository base commit | `37b45ed2631924be885f7dcd3cf56a4477c30b26` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `35eb6d0e5a52dcf593199be2636a34cfc1acf1fd274b93111f327ab17330016c` |
| Source inputs | 437 files; aggregate `113040a06d2375df4ba9fc72819247b3f168e4152a6d7961d114efdd679cc368` |
| Source manifest SHA-256 | `ea48be2e8730ab82485a8b33d413c814033ba788b05f216c678a316c6277f134` |
| Docker image digest | `sha256:00a179abd7af49953582a596fe6790dced54f70f6b7467fa84cc7799a9fc4489` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-08` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
