# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `f15c0d2cfcb64db14efb1f956eedbc0d4102cc26bb968ef491f882ad6a2c2e85` |
| Repository base commit | `2ae8f7b3ef4f39838d923577f6777a1cbd9e62b3` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `b49d0154e84add170f7f273d6373da87fa9cb78afdd9e676e3b4b7257fcbea4c` |
| Source inputs | 436 files; aggregate `853ea8d8cbab7080ff2bcf0cda7faad8ef4d6b0c91c2025f811c8e7acb2d099f` |
| Source manifest SHA-256 | `add38cf1131ca89f6e7f9586c00f9abff2498fe305fabf6d8f52b58639b2bced` |
| Docker image digest | `sha256:00a179abd7af49953582a596fe6790dced54f70f6b7467fa84cc7799a9fc4489` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-08` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
