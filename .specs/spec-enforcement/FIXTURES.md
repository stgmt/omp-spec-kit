# Fixtures

Fixture admission follows the repository real-producer policy (`spec-kernel:FR-11` house standard). Every executable enforcement fixture must be real, immutable, hashed, and reconciled with reviewed ground truth.

## Categories

| Category | Producer | Purpose | Admission |
|---|---|---|---|
| Valid spec document | An actual spec file from a live `.specs/` tree (e.g. this repository's `product` or `spec-kernel` spec) | Positive end-to-end: diagnostic injection produces kernel findings | Real; full manifest |
| Installed tool registry | Candidate-build built-in/MCP/extension tool/provider/schema snapshot plus package-manifest hash | Exact installed registry/effect/shape equality | Real candidate output; full manifest |
| Host authority ABI | v17.3.7 source/behavior absence receipt plus future authenticated provider/server/schema event | Current DEFERRED_HOST_ABI and future exact authority binding | Real pinned-host receipts |
| Sigstore attestation | Captured DSSE/Fulcio/Rekor bundle plus pinned TUF trust-root bytes for exact candidate/workflow/ref/subject | Offline cryptographic acceptance and issuer/repo/workflow/ref/subject/log/expiry refusals | Real capture plus one-fault mutations |
| Spec/non-spec writer calls | Recorded tool-call inputs with exhaustive targets | RAW_SPEC_WRITE vs PROVEN_NON_SPEC_TARGETS | Real-derived; full input provenance |
| Authoring authority calls | Recorded `omp-spec-kit` MCP facades plus name-only/cross-candidate spoofs | Exact authority allowance and mismatch blocks | Real-derived positive + synthetic negatives |
| Command-effect calls | Real command tool inputs plus dynamic/substitution variants | Exhaustive extraction; unsupported syntax incomplete | Real-derived with labeled mutations |
| Containment trees | Real POSIX symlink and Windows reparse-point trees, existing/non-existing targets | Filesystem resolver classification | Real producer per OS; full manifest |
| Kernel-unavailable/product-gate sessions | Session captures with missing kernel/evidence/authority | FR-4/FR-8/FR-9 visible degradation | Real capture where possible; labeled synthetic injection otherwise |
| Fault fixtures | Registry/input mismatch, resolver error, handler exception, deadline, over-budget render | Conservative safety block vs informational diagnostic | Synthetic (labeled) |
| Registry-drift fixtures | Add/rename/change one installed or host-event tool entry | New/changed call becomes UNKNOWN without gate downgrade | Synthetic mutation of real registry |
| Scale fixtures | Maximum 64 targets and large census/diagnostic inputs | NFR size/latency/memory evidence | Synthetic (labeled) |

## Manifest fields

Each fixture record carries: fixture ID, category, capture command or method, producer and version/commit, source path or URL, capture date, SHA-256, byte count, license disposition, permitted trimming note, and ground truth.

Ground truth lists `{toolName, effect, extractionComplete, authority, resolvedTargets:[{classification,code,path}], mode, decision, decisionCode, diagnosticKind}` in handler order. Admission reconciliation is element-for-element; `SPEC`/`NON_SPEC`/`INDETERMINATE`, kernel findings, and enforcement-policy diagnostics are never collapsed.

## Provenance boundary

Real spec documents from this repository's own `.specs/` tree are preferred capture candidates because their license disposition is already established. Upstream `dev-pomogator` spec files are capture candidates only; importing any upstream byte into this repository still requires the repository's provenance/SHA-256/license disposition decision per `SECURITY.md` and the import policy; this specification does not waive that gate.
