# Non-Functional Requirements

## NFR-SECURITY-1 — Security and least privilege

Installed read-only baseline profiles SHALL require no credential, network, shell, subprocess, model, database, watcher, lock, or mutation capability. Workflow permissions default to `actions: read`/`contents: read`; only the final tag-gated publish job receives `contents: write`, `id-token: write`, and `attestations: write`. Untrusted repository/evidence content is data and is never executed.

**Measures:** zero repository writes; zero outbound requests/processes/model calls during inventory; zero secret findings outside designated scanner-test fixtures; no absolute path or environment disclosure.

## NFR-PERFORMANCE-1 — Bounded performance

Inventory SHALL have fixed hard caps independent of corpus size. Defaults and maxima are defined in `plugin-distribution_SCHEMA.md`. Directory processing SHALL be linear in inspected entries up to the cap, results SHALL be deterministic, and abort signals SHALL stop additional work promptly.

**Measures:** inspected entries, elapsed time, truncation flag, and returned byte count are captured. `spec-inventory-result@1` is at most the effective `maxResultBytes` (default 256 KiB, hard 512 KiB) with complete-row truncation and `LIMIT_REACHED`; `distribution-release-eligibility@2` is at most 512 KiB with 12 requirement keys, 64 receipt digests, 200 complete blockers, and 512-scalar blocker messages. A fixed runtime latency SLO remains deferred until a real baseline exists.

## NFR-PORTABILITY-1 — Portability

The installed runtime SHALL operate from the child package on supported OMP platforms without dev-pomogator, the source checkout, repository-root `node_modules`, absolute workstation paths, or user-global setup. Path normalization SHALL preserve platform independence and public output SHALL use `/`-separated project-relative paths.

## NFR-RELIABILITY-1 — Reliability and containment

A malformed or inaccessible spec SHALL degrade the single result, not terminate the session or poison subsequent invocations. Clean install, activation, uninstall, and reinstall operations SHALL be repeatable in isolated fixtures and SHALL preserve non-OMP-managed project bytes; upgrade and rollback SHALL meet the same property beginning with the first subsequent release.

## NFR-SUPPLYCHAIN-1 — Reproducibility and supply-chain integrity

A clean build from the tagged commit SHALL produce the release artifact consumed by verification and publication. Evidence SHALL bind commit, OMP pin, platform image/digest, catalog/package/runtime version, artifact digest, fixture digest, timestamps, and step outcomes. Release publication SHALL never rebuild an unverified payload.

## NFR-USABILITY-1 — Usability and diagnostics

Every non-success result SHALL provide a stable machine code and one bounded remediation message without stack traces or internal paths. Public documentation SHALL distinguish catalog update, plugin upgrade, plugin reload, fresh-session restart, rollback, marketplace removal, and uninstall.

## NFR-MAINTAINABILITY-1 — Maintainability and single control plane

Historical v0.1.0 and delivered v0.3.2 registration remain in one extension factory, one child package, and one profile-gated MCP server identity. Release profiles reject nested manifests and unused compatibility surfaces. Future capabilities require separate accepted gates and extend only the same product topology.
