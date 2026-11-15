# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `88ef21e0261418cd2b9a538c2d268008c899b37bdeb32a4ae093d40359001770` |
| Repository base commit | `a1008ba87ca41e4eeacdafc9a56b891055580862` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `b6b61b275b5d14f52687bc039f7c261f2d644fab2c2b73a9b03f21add0ee50fc` |
| Source inputs | 455 files; aggregate `6e3e72289300db04d2b1d73b771049078d7057a499c9913f3747b6b184908e34` |
| Source manifest SHA-256 | `b63127ac0257eff2d9ede3cd1ead2e8bf91a1e54e6afbca0682b80a14e033fb7` |
| Docker image digest | `sha256:e1a114222796aef2b98857dbc801bd8eea472196ba8b14daa47d4c4d891216b5` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-15` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
