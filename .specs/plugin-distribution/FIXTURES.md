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
