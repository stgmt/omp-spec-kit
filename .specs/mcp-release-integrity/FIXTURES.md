# Fixtures

## Real corpus

`tests/fixtures/kernel/real-corpus-manifest.json` and `tests/fixtures/kernel/real-corpus/.specs/` are exact clean-commit bytes with per-file byte size and SHA-256 plus an independent lexical-count oracle. `loadPinnedCorpusGraph()` verifies every entry before the production filesystem adapter reads it. Mutable repository specifications are never parity input.

## Real Cucumber producer output

`tests/fixtures/release-candidate/cucumber-messages.ndjson` is output from the real Docker Cucumber 13.2.1 producer, not a hand-authored stream. Its historical bytes have SHA-256 `9bcaa12544ad81dca1fb72915a38afb26e8e0ba890ece243783bfd54063600d2`; descriptive capture metadata records 77 executed scenarios and 720 completed steps. Closed provenance binds the base commit, Docker image `sha256:1143a064082310cc43132ce8562b233a413a8e0c625969675143c17f686647c8`, command, date, and the 174-file source-input manifest digest `cca0e38e47581e776e61eaf72cdea1dfcf9d63f317abadf29c5a1700fd9963ea`.

Those counts describe the captured stream; they are not a future release gate. The loader re-hashes the stream and every source input before use. If feature, step, or source bytes change, capture a new successful unfiltered run with new provenance. Never relabel the old stream as output from changed inputs.

## Trusted-run promotion

`scripts/docker-bdd.sh` creates a unique ignored result under `.dev-pomogator/bdd-results/` and mounts only that directory writable. Only a successful unfiltered run with parseable Cucumber Messages and a successful terminal run may atomically replace `.dev-pomogator/.last-test-run.ndjson`. Failed, malformed, meta-only, tag-scoped, and name-scoped runs cannot replace it.

Detailed Cucumber envelope mutation cases belong to the producer adapter's focused tests. MRI retains real-stream parseability, provenance binding, successful unfiltered execution, and a bounded negative that meta-only or failed output cannot become trusted.

## Historical v0.3.2 publication

`docs/validation/release-status-v0.3.2.json` binds the public tag, candidate/package/archive digests, release assets, captured release notes, and attestations. Historical distribution subject facts remain:

- SHA-256 `46deadb5ccb26413942bf96c046516231e1c98d217d95353b90574922365f5d7`;
- repository `stgmt/omp-spec-kit`;
- signer `.github/workflows/distribution-evidence.yml@refs/tags/v0.3.2`;
- tag commit `2938389e34e2d06bdd497291ed01e0a2d89146c9`;
- Rekor index `2624698726`.

These are immutable historical readback facts, not a simulated local verifier run and not a forward distribution claim matrix.

## Isolation

Each scenario owns one `mkdtemp` tree containing project-a, project-b, package decoy, copied package, and candidate data. Project identities are distinct but their absolute paths and environment values are never placed in expected result bytes. The provenance assertions compare fixed server identity, opaque root IDs, root mode, and mismatch state; they also require inventory and query results from one execution context to carry equal provenance. Cleanup removes only that tree after the server closes. Tests do not mutate tracked source, user state, tags, releases, or shared fixtures. The copied payload and corpus are externally hashed before use. A pinned OMP package version may reproduce the user path, but no assertion depends on manager/provider topology.
