# Non-Functional Requirements

## NFR-PROJECTION-1: Determinism

Equal normalized BoardProjectionV1 inputs produce equal card payloads, link plans, snapshot bytes, projection digest, and comparison result. Serialization uses stable property and array order.

## NFR-BOUNDS-1: Bounded complete reads

The MCP board response is complete in one call and MUST be no larger than 1 MiB. The committed snapshot SHOULD remain below 900 KiB. If the bound cannot be met, the operation fails with a typed size error; it never returns an incomplete or truncated success payload.

## NFR-COMMIT-1: Atomic visibility

The pointer and snapshot use a commit marker containing fingerprint, snapshot hash, projection digest, node count, and edge count. The marker is published only after cards and links reconcile. Readers ignore an invalid or mismatched marker and retain the previous committed snapshot.

## NFR-IDEMPOTENCE-1: Idempotence and drift repair

Repeated syncs with equal desired and actual projections perform no writes. Same-fingerprint drift is detected by read-only comparison and repaired deterministically. Duplicate SpecId values are errors.

## NFR-SEPARATION-1: Separation of concerns

Domain translators are pure. Application orchestration depends on ports. REST/MCP calls, retries, locks, and YouTrack-specific serialization are infrastructure concerns. No UI code owns graph semantics.

## NFR-SAFETY-1: Safety and provenance

Rendered text is escaped. Every card and snapshot node retains source path, line, content hash, and source fingerprint. No tracker text or link topology can become authoritative.

## NFR-SECURITY-1: Writeback transport boundary

The tracker-to-listener writeback POST carries the shared `X-Spec-Writeback-Token` over cleartext HTTP between the YouTrack container and the host loopback (`host.docker.internal:8787`). This is an acknowledged boundary: the documented deployment is single-host Docker where that bridge is host-local traffic, and a captured token only enables event flooding — status injection stays blocked because the listener re-verifies every event against the tracker before touching `.specs`. Deployments that expose the listener beyond host-local reach MUST front it with TLS (or a same-host transport) instead of the plaintext URL. The listener additionally proves liveness with an HMAC health check so a foreign process squatting the port cannot impersonate it, and the token is never written to the repository — it lives at `~/.omp/spec-writeback-token` and is pasted into the tracker rule by the operator.

## NFR-TEST-1: Testability

The adapter has contract tests for complete reads, mapping, parity, drift repair, commit ordering, failure retention, and writeback validation. UI tests consume a frozen valid snapshot and cover V1, V2, V3 plus loading/error/empty states.
