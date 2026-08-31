# Research

## Scope

Sources are the target kernel contract, `MIGRATION_MATRIX.md`, and the preserved upstream snapshot under `docs/upstream/dev-pomogator/spec-generator-v4/`. Upstream text is provenance, never target authority or execution evidence.

## RF-1: Structural truth and execution truth are different

**Finding:** `spec-kernel:FR-6` forbids converting structural parsing into readiness or a passing-test claim.

**Decision:** Evidence remains a separate layer that consumes the current graph plus captured execution bytes. The evaluator is pure; the capture adapter owns I/O.

## RF-2: Stale passing rows caused false green

**Finding:** The upstream incident class described stale passing results while the execution lane appeared green. A timestamp or previous pass cannot prove current behavior.

**Decision:** Freshness compares scenario content, applicable step binding, and tested implementation identity. Current task membership is read from the current snapshot. Every required scenario must have fresh passed full-scope evidence.

## RF-3: Caller-provided hashes do not authenticate caller data

**Finding:** Re-hashing a caller-provided artifact and caller-provided sidecar proves internal consistency, not producer origin. A `CANONICAL` label also does not prove an unfiltered run.

**Decision:** Trust one local capture adapter that observes the actual invocation and computes one run envelope. FULL/PARTIAL is derived by capture. Adversarial attestation is out of scope rather than simulated with more self-declared hashes.

## RF-4: Stable identity is required for evidence

**Finding:** Scenario names are mutable and may collide across features. Name fallback can bind a passing row to the wrong requirement.

**Decision:** Only exact qualified scenario ID or a graph-verified canonical tag joins. Name matches remain bounded diagnostic candidates.

## RF-5: Whole-graph freshness is broader than the result

**Finding:** Once scenario content, applicable steps, tested implementation, and current task membership are known, whole-graph equality adds unrelated invalidation but no missing user invariant.

**Decision:** Remove graph fingerprint from per-result freshness. A newly required scenario becomes missing through the current task definition; unrelated graph edits do not stale an unchanged test result.

## RF-6: Result and trace need one identity

**Finding:** The earlier draft repeated artifact, run, freshness, trace, output, and cursor fingerprints across two query results.

**Decision:** `ScenarioEvidence` owns one `EvidenceRef`. Trace paging accepts that reference and returns only steps/failure. Paging tokens stay opaque server implementation details.

## RF-7: Real producer bytes are necessary parser evidence

**Finding:** Synthetic fixtures can mirror the parser's assumptions and miss actual producer shapes.

**Decision:** Executable fixtures require real producer bytes, immutable hashes, full capture provenance, permitted trimming, and reviewed normalized outcomes. Synthetic data is limited to labeled scale or one-fault derivatives.

## Risks

- **Capture compromise:** trusted local capture is an explicit trust boundary, not cryptographic attestation. A future adversarial model needs a real external trust root.
- **Scope misclassification:** planted filtered invocations must prove they remain PARTIAL.
- **Tag drift:** canonical tag verification uses the current graph; unverifiable tags never join.
- **Fixture availability:** no target runtime claim is allowed until real captures from at least two identified producers are reviewed.
