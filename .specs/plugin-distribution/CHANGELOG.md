# Specification Changelog

## Unreleased — Practical release contract

- Removed the forward `distribution-release-eligibility@2` ABI and its arbitrary matrices, counters, and per-FR receipt envelope.
- Removed internal evidence-subject attestation and re-verification from the forward path.
- Delegated marketplace/extension/MCP schemas to OMP and inventory/query schemas to the kernel.
- Scoped topology checks to the uniquely named `omp-spec-kit` entry and its contained child; unrelated repository entries are allowed.
- Replaced global status policing with one compact distribution-owned status record.
- Defined one forward path: build tagged bytes once, run named checks, publish the same digest, and create one final GitHub Artifact Attestation for the public archive.

## SHIPPED — v0.3.2

The public release remains unchanged. `docs/validation/release-status-v0.3.2.json` records tag commit `2938389e34e2d06bdd497291ed01e0a2d89146c9`, candidate digest `526ef6ff94ea682a116a43e4de0b5f622686b8ef36648b7884c830ba1eac25b4`, package-tree digest `e8d53934122a495e1003f17126785dcd181f5d6d5f417270844e17fc25f12f92`, archive SHA-256 `26a2ebadd7d1888c10dc9bdbdc25e11fecf5a7dcc7515b15c7e3bb363a0cbea9`, lifecycle receipt identities, and the public release attestation.

## Historical receipt policy

Historical v0.1, v0.2, v0.3, and v0.3.2 contracts and receipts are immutable audit evidence. The delivered `omp-spec-kit-release-evidence@3`, `public-release-eligibility@1`, distribution-evidence subject, and its attestation describe those releases only. They are not required shapes or a double-attestation chain for the next release.
