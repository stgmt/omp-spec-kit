# Cucumber Message fixture

`cucumber-messages.ndjson` is an unmodified real Cucumber Message stream captured by the repository's unfiltered Docker BDD producer. Semantic rejection scenarios mutate parsed envelopes only in memory.

`cucumber-messages.provenance.json` is a closed v2 receipt. `cucumber-messages.inputs.json` lists every content-addressed producer input outside this fixture directory. The fixture loader re-hashes the stream, source manifest, every listed current input, and the aggregate before any release oracle or mutation is used. `parentFixtureSha256` records the prior real stream used by the self-hosting mutation scenarios during capture; it is not relabeled as current output.

| Field | Value |
|---|---|
| Fixture SHA-256 | `6867d1711ef08289837189454c83b65132ceb14256d1f146cd015d1508b3566f` |
| Repository base commit | `2c826513530969c188992201d41e556bc8d955f6` |
| Source state | `working-tree-content-addressed` |
| Parent fixture SHA-256 | `e595c28aae4bdb603ba282fae2fa9ea7174f54cb3ebaf3fb6dbfa6fdb7a312aa` |
| Source inputs | 508 files; aggregate `682c2c6707bffd8e53558b09cd049856ab81098f2e9de4e47e3647b040dae4db` |
| Source manifest SHA-256 | `e8a7b09dd0aea63d702cda53a98796d4852d96d75d63b83096ada1e7696b1981` |
| Docker image digest | `sha256:263d0513d57518af17da236e833b0cb0e4244b98942597bc6514b60e4b9398e6` |
| Cucumber version | `@cucumber/cucumber` `13.2.1` |
| Capture command | `bash scripts/docker-bdd.sh` |
| Capture date | `2026-11-25` |
| Executed scenarios | `8` |
| Completed steps | `69` |

Ground truth: the stream contains the six required release contract scenarios and eight executed product-test scenarios in total. Every required pickle has one test case and a complete passing terminal chain; the stream has one final successful `testRunFinished`. The evaluator rejects malformed/meta-only, missing or duplicate chain members, missing non-first outline expansions, retry-only and non-passing evidence with named `CucumberEvidenceError` codes.
