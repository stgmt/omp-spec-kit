# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `9bcaa12544ad81dca1fb72915a38afb26e8e0ba890ece243783bfd54063600d2` |
| Repository base commit | `86525eaf6f411757e001474f69d38447bafd0d28` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `398711c01ad40d86edece475b1313a15ab7f9f01cca0a164be1f97296b47428f` |
| Source inputs | 174 files; aggregate `cca0e38e47581e776e61eaf72cdea1dfcf9d63f317abadf29c5a1700fd9963ea` |
| Source manifest SHA-256 | `194c85494af9a0380202ae665894fbd40783b1198babfb367020cb258dbfae15` |
| Docker image digest | `sha256:1143a064082310cc43132ce8562b233a413a8e0c625969675143c17f686647c8` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-08-29` |
| Executed scenarios | 77 |
| Completed steps | 720 |

Ground truth: the stream contains all 18 release-evidence IDs and all 40 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
