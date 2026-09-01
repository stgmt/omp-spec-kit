# Fixture Contract

Real producer output, not hand-authored shapes, is the authority for executable distribution checks.

## Provenance required for every fixture

Record producer/source, immutable version or commit, capture command, retained-byte SHA-256 and counts, trimming rationale, ground truth, license disposition, and safety review. Synthetic one-fault variants must name the real admitted base.

## Retained real producers

| Surface | Producer/path | Ground truth |
|---|---|---|
| Supported host | `tests/distribution/Dockerfile` | Pinned runtime plus OMP v17.3.7 commit `8500092296621a6826b7136e840f8a59ea338958`; no host credentials/state. |
| Installed distribution | `tests/features/plugin-distribution.feature` and step definitions | Target containment, deterministic payload, fresh invocation, dependency absence, and public-safety observations. |
| Lifecycle | `tests/features/lifecycle-producers.feature` and step definitions | Fresh install/uninstall/reinstall and real v0.3.0↔v0.3.2 upgrade/rollback observations. |
| Real Cucumber messages | `tests/fixtures/release-candidate/cucumber-messages.ndjson` plus provenance JSON | Captured Docker stream reconciled to its producer summary. |
| OMP discovery | `tests/fixtures/omp-discovery-runtime/` and helper | Installed active-project manager connection and canonical invocation. |
| Current public release | `docs/validation/release-status-v0.3.2.json` | Exact v0.3.2 tag, digests, lifecycle identities, release asset, and attestations. |

## Isolation

Each run uses disposable project and OMP user roots; installs exact artifact digests; hides checkout/root/external dependencies for the packaged smoke; uses distinct pre-install/reload/fresh sessions; hashes non-OMP-managed project files around lifecycle transitions; and cleans only fixture-owned roots. Releases after the first use real public predecessor bytes.

## Current v0.3.2 ground truth

- tag commit: `2938389e34e2d06bdd497291ed01e0a2d89146c9`
- candidate SHA-256: `526ef6ff94ea682a116a43e4de0b5f622686b8ef36648b7884c830ba1eac25b4`
- package-tree SHA-256: `e8d53934122a495e1003f17126785dcd181f5d6d5f417270844e17fc25f12f92`
- archive SHA-256: `26a2ebadd7d1888c10dc9bdbdc25e11fecf5a7dcc7515b15c7e3bb363a0cbea9`
- public predecessor v0.3.0 digest: `a76965be487d54bd0eea31c366fb06da4874237986c6a5abf33d2191eae0c3d1`
- upgrade receipt digest: `0940519e597e71d2db00e4a95eb34299f3cde9e1c77df2c52c52be584a272abc`
- rollback receipt digest: `26c8b5e0481beb7375b3d39d80775a2ec9ce1b85a0d010f7368d2a1cc53893aa`

The historical internal distribution-evidence subject and attestation remain in the v0.3.2 record. New executable fixtures prove the public-archive final attestation path directly and do not manufacture a forward @2 eligibility envelope.

---

## Product lifecycle domain (merged)

## Current real release fixture

The positive product fixture is the bounded real-producer record at `docs/validation/release-status-v0.3.2.json`.

| Fact | Ground truth |
|---|---|
| Version and tag | `0.3.2`, `v0.3.2` |
| Tag commit | `2938389e34e2d06bdd497291ed01e0a2d89146c9` |
| Candidate SHA-256 | `526ef6ff94ea682a116a43e4de0b5f622686b8ef36648b7884c830ba1eac25b4` |
| Package-tree SHA-256 | `e8d53934122a495e1003f17126785dcd181f5d6d5f417270844e17fc25f12f92` |
| Archive SHA-256 | `26a2ebadd7d1888c10dc9bdbdc25e11fecf5a7dcc7515b15c7e3bb363a0cbea9` |
| Installed identity | `omp-spec-kit@omp-spec-kit` |
| Producer provenance | GitHub release workflow and attestation identities recorded in the bounded JSON; release assets are not copied here. |

This fixture proves only the current v0.3.2 read-only baseline. It does not prove a future outcome.

## Capture discipline

1. Capture output from the real release, install, authoring, or policy producer before trimming.
2. Record producer/tool version, invocation, repository revision, product artifact identity, capture time, result, and raw evidence SHA-256.
3. Trim only to a still-valid subset whose ground truth and producer summary reconcile.
4. Never hand-author a passing release, install, mutation, containment, or refusal receipt.
5. Keep secrets inert and unmistakably synthetic in negative safety cases.
6. Keep Gherkin and task state outside the proof count.

## Product-level result space

Only two status cases belong here:

- **positive:** the unchanged v0.3.2 real release record matches the SHIPPED row;
- **negative:** a bounded test input omits or mismatches the current proof reference and the evaluator returns not SHIPPED.

The negative input SHALL name its transformation from the captured positive record and SHALL NOT claim to be producer output. Detailed release failures and authoring-policy matrices stay with their owning specifications.

---

## MCP release-integrity domain (merged)

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