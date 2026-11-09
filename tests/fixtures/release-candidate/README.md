# Cucumber Message fixture

After producer inputs change, run `bash scripts/docker-bdd.sh` to completion,
then run `node scripts/refresh-cucumber-fixture.mjs`. Run the Docker producer
again to verify the recaptured fixture without replacing it with the second run.

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `62b995304437e72e2df0dc73fccf006936caf57618321ec98df1ba8407c40489` |
| Repository base commit | `96e6fa0a8053c2cc285b5f68e180fbd2bcb77b7d` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `4e551263fe06fc2dc7c3ee831361cb91ccbfbbd2a567e781d83fd8dd7fa41c91` |
| Source inputs | 451 files; aggregate `adf2bb50d4a8d84042be5352ad657cae2a12b67b1a0c3d7cef0dfa71ef5f7ba0` |
| Source manifest SHA-256 | `f3737a7ffa0e73416c2625f0368a05e06f9637122ab80888af7d523c025f4506` |
| Docker image digest | `sha256:815220cd406c74e5ce9b6276c3222f39b7c38b447effa307c84eb73a9bf45cfc` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-08` |
| Executed scenarios | `8` |
| Completed steps | `77` |

This capture covers `tests/features/release-evidence.feature`; other scenarios require separate verification.
