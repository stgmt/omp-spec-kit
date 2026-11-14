# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `1a52869bf7b13df445473279859b82e7504f00aed037723e1af750f9c9cfc9ba` |
| Repository base commit | `a7fa5c113c25db0c561bd01876e4855cbc3f5174` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `35369cf21bb1e9cbeba552afd3f58ce2fc8d33e35a4d4d5af8e7864b60f2913d` |
| Source inputs | 447 files; aggregate `5cb1a10b8903a58f5dbc8d1fe8b3f0ec9980d09ffcd1abaf262064704e47a6d3` |
| Source manifest SHA-256 | `8e3d1ae412efcc087619a2a50a5142d890906b2fc80fbc924bb8908339927a0b` |
| Docker image digest | `sha256:f0ae50543ee6029db22c2e035fc1154fc0c953c94009aff3bb5e619bc50c8a27` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-14` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
