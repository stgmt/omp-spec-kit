# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `b49d0154e84add170f7f273d6373da87fa9cb78afdd9e676e3b4b7257fcbea4c` |
| Repository base commit | `d40ff0b89630fceb64a488e04d4450ade15384bf` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `50ba2fd6812c48200985f36efc12dd2fa74c7cedb6116f5e0fa953293942072f` |
| Source inputs | 436 files; aggregate `2d403298008cec02f0c9c2907471945859cabcb4f4c1a9b25f36a153b2fd4a1f` |
| Source manifest SHA-256 | `8c193ef683e3fa53141b66cdea8971ab47a100ff90603c53dfcd22f360508b64` |
| Docker image digest | `sha256:00a179abd7af49953582a596fe6790dced54f70f6b7467fa84cc7799a9fc4489` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-08` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
