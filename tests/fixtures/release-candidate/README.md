# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `35eb6d0e5a52dcf593199be2636a34cfc1acf1fd274b93111f327ab17330016c` |
| Repository base commit | `f6ea632204e91d5e35b889e4240b37e2b91b8fa5` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `f26f38d0d346fb390c9f447958dfdcdffd16dd77e5d0e82d8e15ce40b2075b4e` |
| Source inputs | 437 files; aggregate `00ff22090a82519262e2c20e4a5569721989875429232d56a4c49b1727366581` |
| Source manifest SHA-256 | `7c4ba7c65bfcbe413c52de9c70e549ae0572e19d515604e03c9224cebfd34ded` |
| Docker image digest | `sha256:00a179abd7af49953582a596fe6790dced54f70f6b7467fa84cc7799a9fc4489` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-08` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
