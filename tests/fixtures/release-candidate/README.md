# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `8d7491786f1b1eaee915faec35ec4917d3e94e5517d678f020c84b5e9ba0c059` |
| Repository base commit | `6952cbc1d7b8ee6ad524251a27e8393da2c6c324` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `07b283fd0caf385e3341935b5b552b065f6b99dca049cf767a3686af21f1e4d7` |
| Source inputs | 412 files; aggregate `adc53031e29a05b430cd161d7903512219b9e414352901ae25fd76f8fbcbeebd` |
| Source manifest SHA-256 | `fd92106e406c54b9b134613d34e44ac5a5e916b6970bdc8cde9d2a5d68004292` |
| Docker image digest | `sha256:e39ee59c06c93c0089e8997c30c435d2f344eac5fe6659233416189b6f0ac17d` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-10-31` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
