# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `6867d1711ef08289837189454c83b65132ceb14256d1f146cd015d1508b3566f` |
| Repository base commit | `59e7c6f7f29c0fb820e9160df6252fd6d906a26a` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `e595c28aae4bdb603ba282fae2fa9ea7174f54cb3ebaf3fb6dbfa6fdb7a312aa` |
| Source inputs | 480 files; aggregate `7d0ba7fcc6d4a01750d10e7b0d586b470cd18b2475e257444dc93d47e04f162d` |
| Source manifest SHA-256 | `3b2ade535a6342ca05f8e2650ee669a5490ec1de2ec954141536bb4b4398b7b6` |
| Docker image digest | `sha256:dbd1e6fa72f0b8539f8de459391c377fc90d9a481737d9342c78e67413f14102` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-23` |
| Executed scenarios | `8` |
| Completed steps | `69` |

Ground truth: the stream contains the six required release contract scenarios and eight executed product-test scenarios in total. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
