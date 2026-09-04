# Acceptance Criteria

These criteria define observable release behavior; prose and Gherkin alone are not execution evidence.

## AC-1.1 — Target identity and containment

**WHEN** the candidate catalog is evaluated **THEN** exactly one entry named `omp-spec-kit` SHALL resolve from `./plugins/omp-spec-kit` beneath the repository root and its declared entrypoints SHALL remain beneath that child; duplicate target names or path escape SHALL fail, while unrelated entries SHALL not.

**Requirement:** [FR-1](FR.md#fr-1-target-plugin-identity-and-containment) · **Scenario:** `@feature1`.

## AC-2.1 — Deterministic child payload

**WHEN** the immutable tag commit is built twice from clean output **THEN** both package-tree and archive SHA-256 values SHALL match, and missing, unexpected, linked, non-regular, source, test, or evidence payload files SHALL fail.

**Requirement:** [FR-2](FR.md#fr-2-deterministic-child-payload) · **Scenario:** `@feature2`.

## AC-3.1 — Installed canonical invocation

**WHEN** the exact archive is installed project-scope and a fresh supported OMP session sends a canonical request **THEN** the installed candidate SHALL answer from the active project and report the candidate version and declared surface; distribution SHALL not revalidate the kernel's full request/result grammar.

**Requirement:** [FR-3](FR.md#fr-3-installed-canonical-invocation) · **Scenario:** `@feature3`.

## AC-4.1 — Fresh-session activation

**WHEN** discovery, install, and reload succeed but the old session has not ended **THEN** activation SHALL remain unproven; **AND WHEN** a new session invokes the installed candidate **THEN** activation SHALL pass.

**Requirement:** [FR-4](FR.md#fr-4-fresh-session-activation) · **Scenario:** `@feature4`.

## AC-5.1 — Dependency-absent execution

**WHEN** the checkout and ambient dependencies are unavailable **THEN** the installed extension and MCP launcher SHALL still complete the canonical invocation, or release SHALL fail.

**Requirement:** [FR-5](FR.md#fr-5-dependency-absent-execution) · **Scenario:** `@feature5`.

## AC-6.1 — Installed containment and read-only smoke

**WHEN** the installed candidate is invoked from a project distinct from the package directory **THEN** it SHALL use the active project, stay contained, and leave project hashes, credentials, network, model, and background state untouched.

**Requirement:** [FR-6](FR.md#fr-6-installed-containment-and-read-only-smoke) · **Scenario:** `@feature6`.

## AC-7.1 — Version consistency and upgrade

**WHEN** a post-first candidate is evaluated **THEN** all candidate authorities and the fresh installed observation SHALL agree, and an upgrade from exact public predecessor bytes SHALL reach the candidate; stale-session or catalog-only change SHALL fail.

**Requirement:** [FR-7](FR.md#fr-7-version-consistency-and-upgrade) · **Scenario:** `@feature7`.

## AC-8.1 — Uninstall, reinstall, and rollback

**WHEN** lifecycle recovery is exercised **THEN** uninstall SHALL yield fresh absence, reinstall SHALL invoke the same candidate digest, rollback SHALL invoke the exact public predecessor for post-first releases, and non-OMP-managed project hashes SHALL remain unchanged.

**Requirement:** [FR-8](FR.md#fr-8-uninstall-reinstall-and-rollback) · **Scenario:** `@feature8`.

## AC-9.1 — Public-safety gates

**WHEN** provenance, license, secret, local-state, public-diff, or payload-allowlist verification fails **THEN** no public release asset SHALL be created and diagnostics SHALL not disclose the protected value.

**Requirement:** [FR-9](FR.md#fr-9-public-safety-gates) · **Scenario:** `@feature9`.

## AC-10.1 — Build once, publish, and attest

**WHEN** a qualifying tag passes every named check **THEN** the public archive SHA-256 SHALL equal the verified build SHA-256 and the final GitHub Artifact Attestation subject SHA-256; a rebuild, different existing asset, PR, or untagged push SHALL not publish.

**Requirement:** [FR-10](FR.md#fr-10-build-once-publish-the-same-digest-attest-once) · **Scenario:** `@feature10`.

## AC-11.1 — Distribution-owned status record

**WHEN** publication and final attestation complete **THEN** one compact immutable distribution record SHALL contain the candidate identity, named checks, lifecycle, public asset, and attestation; it SHALL contain no product capability decision.

**Requirement:** [FR-11](FR.md#fr-11-distribution-owned-release-status) · **Scenario:** `@feature11`.

## AC-12.1 — Compact release decision

**WHEN** any named release check fails **THEN** the release SHALL stop and identify that check in CI diagnostics without requiring extra receipt envelopes, copied host/runtime schemas, arbitrary counters, or a repository-wide inventory.

**Requirement:** [FR-12](FR.md#fr-12-compact-release-decision) · **Scenario:** `@feature12`.

## AC-13.1 — Practical distribution release path

**WHEN** a next candidate is released **THEN** it SHALL follow only the contained-target → build-once → installed/lifecycle/safety checks → same-digest publish → final archive attestation → status-record path; an obsolete secondary evaluator or intermediate attestation SHALL neither be required nor emitted.

**Requirement:** [FR-13](FR.md#fr-13-practical-distribution-release-path) · **Scenario:** `@feature13`.

---

## Product lifecycle domain (merged)

## FR-14 — Current shipped baseline

### AC-14.1 — Current release proof

**WHEN** the current product status is rendered **THEN** it SHALL show exactly one SHIPPED row for `omp-spec-kit@omp-spec-kit` v0.3.2, SHALL name the v0.2 graph/query kernel and eight working read-only MCP tools, and SHALL link `docs/validation/release-status-v0.3.2.json`.

**Scenario:** `@feature14`, `SCEN-product-current-release-proof`.

## FR-15 — One-product identity

### AC-15.1 — Single product identity

**WHEN** the installed product is inspected **THEN** exactly one marketplace entry, one plugin package, and one extension SHALL use the `omp-spec-kit@omp-spec-kit` identity and no competing specification writer SHALL exist.

**Scenario:** `@feature15`, `SCEN-product-one-product-identity`.

## FR-16 — Proof before shipped

### AC-16.1 — Missing proof is not shipped

**WHEN** an outcome lacks current observable proof for its exact released identity **THEN** it SHALL remain NEXT or LATER and SHALL NOT be labeled SHIPPED.

**Scenario:** `@feature16`, `SCEN-product-missing-proof-is-not-shipped`.

### AC-16.2 — Unexecuted text is not proof

**WHEN** only a specification, task state, Gherkin scenario, historical receipt, or sibling progress exists **THEN** the outcome SHALL NOT be labeled SHIPPED.

**Scenario:** `@feature16`, `SCEN-product-unexecuted-text-is-not-proof`.

## FR-17 — Next safe authoring outcome

### AC-17.1 — Bounded public mutation surface

**WHEN** the public mutation inventory is inspected **THEN** it SHALL contain exactly `spec_patch`; every helper SHALL remain internal.

**Scenario:** `@feature17`, `SCEN-product-authoring-tools-are-bounded`.

### AC-17.2 — Direct spec write policy

**WHEN** an OMP tool_call can access canonical .specs/** **THEN** the gate SHALL check registered MCP authority first and refuse every non-MCP read, search, enumeration, edit, write, or shell path, while real-path/link/reparse escapes or unresolved targets fail closed with a bounded reason.

**Scenario:** `@feature17`, `SCEN-product-direct-spec-write-is-refused`.

## FR-18 — Plain later outcomes

### AC-18.1 — Three-bucket roadmap

**WHEN** the roadmap is read **THEN** its only public buckets SHALL be SHIPPED, NEXT, and LATER; it SHALL contain one SHIPPED v0.3.2 row, one NEXT safe-authoring row, and plain LATER outcomes for expanded reads, editor navigation, evidence queries, impact reporting, and manual exact-content plan validation.

**Scenario:** `@feature18`, `SCEN-product-roadmap-has-three-buckets`.

---

## MCP release-integrity domain (merged)

## AC-19.1: Active project and contained override

**Requirement:** [FR-19](FR.md#fr-19-active-project-installed-behavior).

WHEN the installed package starts from project-a without an override THEN every result SHALL describe project-a and exclude project-b and package decoys; WHEN a validated absolute override selects project-b THEN only project-b SHALL be served; IF a root is relative, unresolved, package-local, or escaping THEN it SHALL NOT select data; IF startup inherits package cwd THEN startup SHALL refuse before serving.

## AC-20.1: One error and process recovery

**Requirement:** [FR-20](FR.md#fr-20-terminal-protocol-errors-and-recovery).

WHEN invalid JSON-RPC, malformed JSON, an unknown method, or an unknown tool is sent THEN exactly one response SHALL carry `-32600`, `-32700`, `-32601`, or `-32602` with the required id; WHEN a valid request follows THEN it SHALL succeed on the same process and stdout SHALL contain protocol frames only.

## AC-21.1: Eight installed handlers and zero writes

**Requirement:** [FR-21](FR.md#fr-21-historical-eight-tool-installed-surface).

WHEN the isolated v0.3.2 payload runs without source checkout or ambient dependency ancestry THEN `tools/list` SHALL equal the eight named historical tools, each handler SHALL return a complete result for the manifest-verified corpus, at least one serialization boundary SHALL match the direct query service, and corpus bytes SHALL remain unchanged.

## AC-22.1: Unfiltered run and observed lifecycle

**Requirement:** [FR-22](FR.md#fr-22-one-real-candidate-run).

WHEN a future candidate is verified THEN one successful unfiltered real Docker Cucumber Message run SHALL be bound to candidate/archive/feature/step/source digests and SHALL record passing active-project, protocol, eight-tool, safety, upgrade, rollback, uninstall, and reinstall observations with fresh-session versions and unchanged project hashes; IF output is failed, malformed, meta-only, tag-scoped, or name-scoped THEN it SHALL NOT replace trusted run evidence. Scenario or pickle counts and receipt key sets SHALL NOT decide acceptance.

## AC-23.1: Publish only the attested candidate bytes

**Requirement:** [FR-23](FR.md#fr-23-contained-deterministic-candidate-and-same-byte-publication).

WHEN a clean peeled-tag candidate is assembled THEN every candidate file under `bin/` SHALL have canonical mode 0755 and every other file SHALL have canonical mode 0644 independent of source modes, and the contained lexical file manifest, package-tree digest, archive digest, candidate digest, package digest, and tar headers SHALL encode those canonical modes; WHEN GitHub Artifact Attestations verifies the exact subject/repository/workflow/ref and publish downloads the archive THEN the downloaded and released SHA-256 SHALL equal the verified candidate archive; IF containment, safety, attestation, or asset identity differs THEN no release mutation SHALL occur.

## AC-24.1: Public history remains honest

**Requirement:** [FR-24](FR.md#fr-24-public-guidance-and-immutable-v032-evidence).

WHEN the bounded v0.3.2 record is read THEN tag, commit, candidate, package-tree, archive, release asset, attestation, captured notes, current guidance, and v0.3.0 advisory SHALL agree; historical evidence@3 fields SHALL remain readable but SHALL NOT be relabeled as a current run or a forward schema.

## AC-25.1: Response source identity and root consistency

**Requirement:** [FR-25](FR.md#fr-25-response-source-identity-and-root-consistency).

WHEN the installed stdio MCP server serves the active project without an override THEN every one of the eight tool results SHALL identify `omp-spec-kit`, carry equal opaque resolved and active-project root identities, and declare `rootMode: active-project`; WHEN an explicit absolute override selects project-b THEN every result SHALL identify one project-b root identity, declare `rootMode: explicit-absolute-override`, and set `matchesActiveProject: false`; WHEN a `repositoryRootFingerprint` conflict occurs THEN it SHALL use stable `causeCode` `REPOSITORY_ROOT_FINGERPRINT_MISMATCH`, state that another project or stale snapshot may be in use, expose only `activeProjectRootId` and `resolvedRootId`, and direct the caller to `mcp_preflight`; when those roots do not match the caller reconnects, otherwise it refreshes the `spec_catalog` overview and creates a new proposal; WHEN the OMP extension receives the same cwd and override THEN its legacy inventory result and every query-tool result SHALL carry the same provenance; IF any result exposes an absolute root path, environment value, document body, or silently mixes roots THEN the check SHALL fail.

## AC-26.1: Consolidated 10-tool MCP discovery and release evidence

**EARS:** WHEN the v0.10.0 candidate is validated THEN release preflight, archive smoke, and installed package discovery SHALL prove exactly 10 tools with the 9/1 annotation matrix and zero deprecated names.

**Requirement:** [FR-26](FR.md#fr-26-consolidated-10-tool-mcp-discovery-and-release-evidence)

**Scenario:** `@feature26`, `@id:SCEN-mri-consolidated-10-tools`
