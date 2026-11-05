# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `bdf2aeb266339a766603b9c19edd52b8d83c8ca7946f7f0925ebadd261388846` |
| Repository base commit | `4cfde83dc5e4518b2978b354686bb0a594a3afb1` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `50ba2fd6812c48200985f36efc12dd2fa74c7cedb6116f5e0fa953293942072f` |
| Source inputs | 437 files; aggregate `bb9de0341f8ef8559905d88cb9cb9ab405673068fd23afac6a92fb66c1b9acfa` |
| Source manifest SHA-256 | `2952f428e09bc1ffbbb05653fa2d7146312e5c976e56b4655b8e1132710fc935` |
| Docker image digest | `sha256:00a179abd7af49953582a596fe6790dced54f70f6b7467fa84cc7799a9fc4489` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-05` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
