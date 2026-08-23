# Non-Functional Requirements

## NFR-1 — Security and least privilege

The v0.1.0 extension SHALL require no credential, network, shell, subprocess, model, database, watcher, lock, or mutation capability. GitHub Actions permissions SHALL default to `contents: read`; only the final tag-gated release job MAY receive the minimum release write permission. Untrusted repository content SHALL be treated as data and never executed.

**Measures:** zero repository writes; zero outbound requests/processes/model calls during inventory; zero secret findings outside designated scanner-test fixtures; no absolute path or environment disclosure.

## NFR-2 — Bounded performance

Inventory SHALL have fixed hard caps independent of corpus size. Defaults and maxima are defined in `plugin-distribution_SCHEMA.md`. Directory processing SHALL be linear in inspected entries up to the cap, results SHALL be deterministic, and abort signals SHALL stop additional work promptly.

**Measures:** inspected entries, elapsed time, truncation flag, and returned byte count are captured in evidence. A fixed latency SLO is deferred until a real clean-fixture baseline exists and SHALL not be invented by this specification.

## NFR-3 — Portability

The installed runtime SHALL operate from the child package on supported OMP platforms without dev-pomogator, the source checkout, repository-root `node_modules`, absolute workstation paths, or user-global setup. Path normalization SHALL preserve platform independence and public output SHALL use `/`-separated project-relative paths.

## NFR-4 — Reliability and containment

A malformed or inaccessible spec SHALL degrade the single result, not terminate the session or poison subsequent invocations. Clean install, activation, uninstall, and reinstall operations SHALL be repeatable in isolated fixtures and SHALL preserve non-OMP-managed project bytes; upgrade and rollback SHALL meet the same property beginning with the first subsequent release.

## NFR-5 — Reproducibility and supply-chain integrity

A clean build from the tagged commit SHALL produce the release artifact consumed by verification and publication. Evidence SHALL bind commit, OMP pin, platform image/digest, catalog/package/runtime version, artifact digest, fixture digest, timestamps, and step outcomes. Release publication SHALL never rebuild an unverified payload.

## NFR-6 — Usability and diagnostics

Every non-success result SHALL provide a stable machine code and one bounded remediation message without stack traces or internal paths. Public documentation SHALL distinguish catalog update, plugin upgrade, plugin reload, fresh-session restart, rollback, marketplace removal, and uninstall.

## NFR-7 — Maintainability and single control plane

All v0.1.0 runtime registration SHALL remain in one extension factory and one child package. The release profile SHALL reject nested manifests and unused compatibility surfaces. Future graph, MCP, or mutation functionality requires a separate version/spec gate and SHALL not silently expand the v0.1.0 package contract.
