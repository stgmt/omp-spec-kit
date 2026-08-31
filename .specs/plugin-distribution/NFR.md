# Non-Functional Requirements

## NFR-SECURITY-1 — Least privilege

Installed read-only operation requires no credential, network, shell, model, database, watcher, or mutation access. Verification jobs use read permissions; only the final tag-gated publish job receives the minimum contents/attestation permissions. Untrusted repository content is data, never executable input.

## NFR-PERFORMANCE-1 — Proportional release checks

Distribution work SHALL be proportional to the selected child and named fixture set. Hashing SHALL stream exact bytes, each named release check SHALL run once per candidate, and verbose diagnostics SHALL remain ordinary CI artifacts/logs. No distribution-specific result-byte, receipt-count, blocker-count, or scalar-count ABI is normative.

## NFR-PORTABILITY-1 — Installed portability

The packaged extension and MCP launcher SHALL operate on supported Windows and POSIX OMP environments without the source checkout, root `node_modules`, user-global setup, or workstation-specific absolute paths.

## NFR-RELIABILITY-1 — Reversible lifecycle

Install, uninstall, reinstall, upgrade, and rollback SHALL use isolated roots, fresh sessions, exact artifact digests, and preservation hashes. A failed release check cannot publish partial or replacement bytes.

## NFR-SUPPLYCHAIN-1 — Reproducible exact bytes

The tagged commit produces one verified archive. Publication consumes that archive without rebuilding, and the final public asset attestation names the same SHA-256.

## NFR-USABILITY-1 — Actionable diagnostics

A failed release identifies the failed named check and a concise remediation in CI logs without exposing secrets, absolute user paths, stacks, or internal receipt schemas.

## NFR-MAINTAINABILITY-1 — Owner boundaries

OMP owns host parsing, the kernel owns runtime query contracts, distribution owns packaging/lifecycle/publication, MRI owns release integrity, and product owns public capability state. New OMP fields or runtime operations do not require a distribution schema fork.
