# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `50ba2fd6812c48200985f36efc12dd2fa74c7cedb6116f5e0fa953293942072f` |
| Repository base commit | `38730a96723ad51b5e09c8dfc8d773bbe2ae7cd7` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `50ba2fd6812c48200985f36efc12dd2fa74c7cedb6116f5e0fa953293942072f` |
| Source inputs | 435 files; aggregate `78c69f35f6369eb540283f5bbec22d0813bb1386cd7062ce27268f2e81585888` |
| Source manifest SHA-256 | `c0d51cbf4f6fe5f3e1646dade02e7dd855a22530d90ad3d6f01731fe4459df1c` |
| Docker image digest | `sha256:00a179abd7af49953582a596fe6790dced54f70f6b7467fa84cc7799a9fc4489` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-02` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
