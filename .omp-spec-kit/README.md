# Dogfood evidence

`evidence/release-test-run.ndjson` is the product test stream used by
`scripts/refresh-cucumber-fixture.mjs`. Older streams are historical dogfood
inputs.

`release-worktree-*/` is a local release checkout and is ignored. Only the
captured evidence is versioned.
