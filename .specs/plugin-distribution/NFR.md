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

---

## Product lifecycle domain (merged)

## NFR-PRODUCT-SECURITY-1 — Contained writes

Direct-write protection for `.specs/**` SHALL use canonical repository containment, real-path/link/reparse checks, and repository-relative diagnostics. Unknown or unresolved targets SHALL fail closed when they may reach `.specs/**`.

**Traces:** `plugin-distribution:FR-17`, `plugin-distribution:AC-17.2`.

## NFR-PRODUCT-PROVENANCE-1 — Release proof provenance

A SHIPPED claim SHALL cite a bounded record captured from the real release producer. The record SHALL identify the released version and artifact without copying release assets into the specification.

**Traces:** `plugin-distribution:FR-14`, `plugin-distribution:FR-16`.

## NFR-PRODUCT-RELIABILITY-1 — Conservative status

A missing, unreadable, stale, or mismatched current proof SHALL never produce SHIPPED. Status evaluation SHALL be deterministic for the same roadmap and proof inputs.

**Traces:** `plugin-distribution:FR-16`.

## NFR-PRODUCT-USABILITY-1 — Manager-readable roadmap

A reader SHALL answer what is shipped, what is next, and what is later from one short table and list without learning implementation-specific states.

**Traces:** `plugin-distribution:FR-14`, `plugin-distribution:FR-17`, `plugin-distribution:FR-18`.

## NFR-PRODUCT-MAINTAINABILITY-1 — Single ownership boundary

Product documents SHALL state externally visible outcomes and SHALL link detailed owner contracts instead of copying their internal checks. Task status SHALL exist only in canonical task blocks, not in a second hand-maintained summary.

**Traces:** `plugin-distribution:FR-15`, `plugin-distribution:FR-17`, `plugin-distribution:FR-18`.

---

## MCP release-integrity domain (merged)

## MRI Performance

- Root selection adds no watcher, background service, or eager corpus scan.
- Candidate hashing visits only the allowlisted candidate tree in deterministic lexical order.

## MRI Security

- Candidate and evidence paths are relative, regular, realpath-contained files; symlink, junction, reparse, and parent-component escape fail before content use.
- Credential checks emit redacted bounded findings and never echo matched values, environment contents, or absolute user paths.
- Attestation verification fixes the exact subject, repository, signer workflow, and tag ref.


- Response provenance uses opaque canonical-root identities and never returns absolute paths, environment values, credentials, or document bodies.

## MRI Reliability

- Each identified invalid request has one terminal response and the process accepts a later valid request.
- Equal clean input bytes produce equal package-tree, archive, and candidate digests.
- Only a successful unfiltered real-producer run may replace trusted current-run evidence.
- Publication mutates nothing when candidate, attestation, downloaded archive, or existing asset identity differs.

- The stdio server and every OMP extension tool resolve one root context per execution; a foreign absolute override is visible as `matchesActiveProject: false` rather than silently presented as active-project data.

## MRI Usability

- Install, upgrade, rollback, and reinstall guidance requires a fresh OMP session.
- Public material distinguishes immutable v0.3.2 history from a future candidate run.
- Failure output names the affected file or check in bounded language without exposing secrets or private paths.