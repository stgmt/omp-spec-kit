# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `50ba2fd6812c48200985f36efc12dd2fa74c7cedb6116f5e0fa953293942072f` |
| Repository base commit | `2a0634aa8ba3a21d647a1e7a10e7e6c83f045d71` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `50ba2fd6812c48200985f36efc12dd2fa74c7cedb6116f5e0fa953293942072f` |
| Source inputs | 431 files; aggregate `e8053056ff57e2de8cd699635aa8271288411848cae81c0b6a30d31a82b6eedb` |
| Source manifest SHA-256 | `5a5f1d2525dd582d23b2d0861723d14690aa0de2897ab03fda58d49571d2d2ee` |
| Docker image digest | `sha256:00a179abd7af49953582a596fe6790dced54f70f6b7467fa84cc7799a9fc4489` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-02` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
