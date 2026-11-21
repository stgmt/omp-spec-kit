# Dogfood evidence

`evidence/last-test-run.ndjson` and `evidence/release-test-run.ndjson` are
captured Cucumber Message streams from real BDD runs. They are kept as
historical dogfood and analysis inputs; `release-test-run.ndjson` is the
canonical stream used by `scripts/refresh-cucumber-fixture.mjs`.

`release-worktree-*/` is a local release checkout and is ignored. Only the
captured evidence is versioned.
