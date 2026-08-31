# Changelog

## Unreleased

- Replaced the unshipped overlay/sidecar model with one trusted-capture run envelope built from an actual runner invocation.
- Made capture-derived FULL/PARTIAL scope authoritative; partial runs remain visible but never satisfy readiness.
- Restricted joins to qualified scenario ID or graph-verified canonical tag; names are diagnostics only.
- Removed whole-graph per-result freshness. Freshness now compares scenario content, applicable step binding, and tested implementation identity.
- Required fresh passed FULL-scope evidence for every current required scenario.
- Replaced duplicate result/trace identities with one `EvidenceRef`; `get_test_result` returns `ScenarioEvidence` and trace pages use its reference.
- Removed public conservation counters/equations, unused task/schema fields, deterministic output fingerprints, the 14-record evidence release manifest, and its second evidence fingerprint.
- Preserved the real-producer fixture/provenance discipline and the SHIPPED v0.3.2 historical evidence boundary. No runtime delivery is claimed.

The previous sidecar/fingerprint/release schema was a superseded specification draft and has no compatibility authority.

## 2026-08-23 — Specification init

- Created the evidence/honesty specification from the kernel boundary and upstream migration research.
- Recorded the stale-result false-green incident class and the requirement for real multi-producer fixtures.
