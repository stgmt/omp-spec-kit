# Fixtures

## Real corpus

`tests/fixtures/kernel/real-corpus-manifest.json` is the only shared source for MCP parity. Before serving a copy, the test helper verifies every listed path, byte length, and SHA-256. Tests do not fabricate alternate document shapes.

## Isolation fixtures

Each scenario creates project-a, project-b, package-decoy, copied package, and candidate/evidence data beneath one `mkdtemp` root. A minimal distinct specification identifier is added only to distinguish roots; the corpus itself remains manifest-derived.

## Candidate variants

Candidate tests generate a valid base from the current built package and change exactly one field per negative case: tag commit, archive byte, candidate digest, public safety record, Docker BDD record, v0.3.0 tagged-source proof, upgrade, or rollback. These inputs prove evaluator behavior; they are not claims of a public v0.3.1 release.
