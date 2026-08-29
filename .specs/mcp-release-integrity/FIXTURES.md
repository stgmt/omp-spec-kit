# Fixtures

## Real corpus

`tests/fixtures/kernel/real-corpus-manifest.json` plus `tests/fixtures/kernel/real-corpus/.specs/` are the shared MCP parity source. They are exact clean-commit bytes with per-file size/SHA-256 and an independent lexical-count oracle. `loadPinnedCorpusGraph()` verifies bytes before the production filesystem adapter reads them; mutable repository specs are never parity input.

## Real Cucumber evidence

`tests/fixtures/release-candidate/cucumber-messages.ndjson` is committed output from the real Docker Cucumber 13.2.1 producer, not a hand-authored stream. The current bytes are SHA-256 `9bcaa12544ad81dca1fb72915a38afb26e8e0ba890ece243783bfd54063600d2` with 77 executed scenarios and 720 completed steps. Closed provenance v2 binds base commit, prior self-hosting fixture SHA, Docker image `sha256:1143a064082310cc43132ce8562b233a413a8e0c625969675143c17f686647c8`, command/date, and a 174-file source-input manifest (`cca0e38e47581e776e61eaf72cdea1dfcf9d63f317abadf29c5a1700fd9963ea`). The loader re-hashes every manifest input plus the stream before use. All 18 MRI IDs and 40 source-derived pickle executions have passing terminal chains; semantic mutations alter parsed copies only.

The current committed stream contains passing chains for all eighteen canonical MRI IDs and the previously captured source-derived outline expansions. The amended evaluator now derives exact multiplicity from current source; after the added multiplicity scenario the required execution set is 40 pickles. The amended contract makes all eighteen `@release-evidence` members. Because scenario/step source bytes changed during this corpus repair, the fixture/provenance/closed loader constant must be recaptured from a successful unfiltered Docker run before amended CHKs become Verified; the existing real stream is not relabeled as output from changed inputs.

## Current Docker BDD artifact

`bash scripts/docker-bdd.sh` creates an ignored host result under `.dev-pomogator/bdd-results/` and mounts only that directory writable. A successful unfiltered run with complete source/Gherkin/pickle/test-run/test-case/terminal-step envelopes atomically promotes `.dev-pomogator/.last-test-run.ndjson`; failed, malformed, tag/name-filtered or otherwise scoped runs cannot replace it.

## Attested distribution evidence

`SCEN-mri-unverified-attestation-refusal` exercises the real fail-closed verifier path in a container without `gh`; no verifier mock turns self-authored data green. The production path is separately grounded by the bounded v0.3.2 record:

- attested subject `distribution-evidence.json` SHA-256 `46deadb5ccb26413942bf96c046516231e1c98d217d95353b90574922365f5d7`;
- repository `stgmt/omp-spec-kit`;
- signer `.github/workflows/distribution-evidence.yml@refs/tags/v0.3.2`;
- tag commit `2938389e34e2d06bdd497291ed01e0a2d89146c9`;
- Rekor index `2624698726`;
- provenance commands in `docs/validation/release-status-v0.3.2.json`.

The positive readback steps bind the distribution subject to the evidence receipt, one archive asset and captured GitHub release-note body/hash. They are historical published-release evidence, not a fake local `gh` success, download/rebuild execution, or authority for a future candidate.

## Isolation and pinned OMP runtime

Every scenario owns one `mkdtemp` tree containing project-a, project-b, package-decoy, copied package and candidate/evidence data. `tests/fixtures/omp-discovery-runtime/bun.lock` pins the disposable `@oh-my-pi/pi-coding-agent@17.3.7` host. Before manager enrollment, the probe externally hashes the generated package manifest, every manifest-listed `dist` file and POSIX launcher. Docker uses digest-pinned Bun/Node bases and a source/test/package allowlist.

## Candidate variants

Candidate tests create a valid local base and change exactly one tag/archive/candidate/public-safety/BDD/prior/upgrade/rollback identity per negative case. These fixtures prove evaluator refusal behavior. They are not the public v0.3.2 producer receipts and cannot authorize publication.
