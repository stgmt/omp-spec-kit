# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `89a815fb493308fabc42389d0265eaa152fdc4909d514ac05a0b0f5584e8ea36` |
| Repository base commit | `a2e79ae520cf7cdd0e4a0dffef8f3cac6c5a4608` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `1a52869bf7b13df445473279859b82e7504f00aed037723e1af750f9c9cfc9ba` |
| Source inputs | 447 files; aggregate `2a7426b68109e6e1e92b1011ca869593ed802d4289d665c509fe602478282153` |
| Source manifest SHA-256 | `4518f83dea86f7543e2f84243d07cd04d860996efa4d6b6158155c0b98915b15` |
| Docker image digest | `sha256:4519f152f9cab0c01f3f20d6c17d8251a3ef08043ea63728d717e2fc222173a8` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-14` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
