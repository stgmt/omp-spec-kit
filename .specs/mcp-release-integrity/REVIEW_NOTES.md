# Spec Review: mcp-release-integrity

## Verdict

The public v0.3.2 release remains **SHIPPED** and immutable. This contract repair does not create, retract, or reinterpret a runtime release. `.progress.json` records document-authoring history only.

## Preserved historical identities

- tag/commit: `v0.3.2` / `2938389e34e2d06bdd497291ed01e0a2d89146c9`;
- candidate digest: `526ef6ff94ea682a116a43e4de0b5f622686b8ef36648b7884c830ba1eac25b4`;
- package-tree digest: `e8d53934122a495e1003f17126785dcd181f5d6d5f417270844e17fc25f12f92`;
- archive SHA-256: `26a2ebadd7d1888c10dc9bdbdc25e11fecf5a7dcc7515b15c7e3bb363a0cbea9`;
- real Cucumber stream SHA-256: `9bcaa12544ad81dca1fb72915a38afb26e8e0ba890ece243783bfd54063600d2`.

Historical evidence@3, lifecycle, manager-discovery, distribution-attestation, and release-result fields remain readable exactly as recorded. They are not forward contract authorities.

## Forward boundary

**NEXT** is one unfiltered real-producer candidate run, one observed fresh-session lifecycle journey, one deterministic contained archive, native artifact-attestation verification, and publication of the same digest. MRI no longer owns OMP manager topology, distribution producer claims, a release-authority lattice, receipt/counter gates, or future tool registry conservation.
