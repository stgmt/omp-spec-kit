# Fixtures

## Real corpus

`tests/fixtures/kernel/real-corpus-manifest.json` plus the frozen `tests/fixtures/kernel/real-corpus/.specs/` tree are the only shared MCP parity source. The fixture is exact `git show` output from clean commit `1e1475c139406c112dab43dfa689d1140a57ddb3`, selected by immutable manifest commit `b40db2e57f0b4c093a8a0e96e591d9109e3335be`; the manifest records per-file byte lengths/SHA-256 and the aggregate fixture SHA-256. `loadPinnedCorpusGraph()` verifies frozen bytes then reads that frozen root through the filesystem adapter—mutable repository `.specs` files are never parity input. `node scripts/refresh-real-corpus-manifest.mjs --check` independently reconciles the lexical count oracle without importing `buildKernelGraph`; re-materialization may only use `node scripts/refresh-real-corpus-manifest.mjs --source-commit 1e1475c139406c112dab43dfa689d1140a57ddb3`.

## Real Cucumber evidence

`tests/fixtures/release-candidate/cucumber-messages.ndjson` is committed producer output, not a hand-authored message stream. Its closed `cucumber-messages.provenance.json` records the fixture SHA-256, capture commit, Docker image digest, Cucumber version, capture command/date, and 38-scenario/302-completed-step counts. `readVerifiedCucumberFixture()` verifies that metadata, raw-byte digest, and counts before the release evidence oracle or any in-memory mutation runs. `SCEN-MRI-011` removes or alters only parsed envelopes in memory, leaving the committed source bytes unchanged while covering every required semantic rejection code; its matrix remains pending until Docker BDD passes.

## Current Docker BDD artifact

`bash scripts/docker-bdd.sh` creates an ignored host file at `.dev-pomogator/bdd-results/run.*.ndjson` and mounts only that results directory into the test container. The configured Cucumber formatter writes one Cucumber Messages NDJSON stream there while normal callers retain progress output; `OMP_SPEC_KIT_BDD_MESSAGE_STDOUT=1` retains pure message stdout for release capture and also writes the mounted stream. Only a successful no-argument run whose artifact is nonempty JSONL and contains source, Gherkin, pickle, test-run, test-case, and terminal-step message envelopes atomically replaces `.dev-pomogator/.last-test-run.ndjson`. Any failed, malformed, tag/name-filtered, or other argument-scoped invocation leaves the prior canonical artifact untouched.

## Isolation fixtures

Each scenario creates project-a, project-b, package-decoy, copied package, and candidate/evidence data beneath one `mkdtemp` root. A minimal distinct specification identifier is added only to distinguish roots; the corpus itself remains manifest-derived.

## Pinned OMP runtime

`tests/fixtures/omp-discovery-runtime/bun.lock` is the committed dependency graph for the disposable Bun host; Docker installs it only with `bun install --frozen-lockfile`. The host has exactly `@oh-my-pi/pi-coding-agent@17.3.7` as its declared runtime dependency. Before `PluginManager.link`, the probe hashes the repository-built `plugins/omp-spec-kit/dist/manifest.json` and POSIX MCP launcher, passes those expected digests to the subprocess, then requires the copied manifest and every manifest-listed `dist/` file to match. The Docker BDD image copies only the declared source/test/package allowlist and pins Bun 1.3.14 and Node 22-bookworm-slim to the immutable digests recorded in `tests/distribution/Dockerfile`.

## Candidate variants

Candidate tests generate a valid base from the current built package and change exactly one field per negative case: tag commit, archive byte, candidate digest, public safety record, Docker BDD record, v0.3.0 tagged-source proof, upgrade, or rollback. These inputs prove evaluator behavior; they are not claims of a public v0.3.1 release.
