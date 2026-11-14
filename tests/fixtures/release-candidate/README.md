# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `89a815fb493308fabc42389d0265eaa152fdc4909d514ac05a0b0f5584e8ea36` |
| Repository base commit | `1527b7b82661680fb634c26d041c204845137712` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `89a815fb493308fabc42389d0265eaa152fdc4909d514ac05a0b0f5584e8ea36` |
| Source inputs | 447 files; aggregate `93997b0a3761d6f2a65dcd0b8ee0b0d00c4184a0f45b9fccd4cd9ee1c6c14201` |
| Source manifest SHA-256 | `73036583bd4c51acd28769ef5af938ca37724e5fae087537d58ceaa2b95ee507` |
| Docker image digest | `sha256:4519f152f9cab0c01f3f20d6c17d8251a3ef08043ea63728d717e2fc222173a8` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-14` |
| Executed scenarios | `8` |
| Completed steps | `77` |

Ground truth: the stream contains all 11 MRI scenario IDs and all 12 source-derived MRI pickle executions. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
