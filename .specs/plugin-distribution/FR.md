# Functional Requirements

IDs are local here and qualified as `plugin-distribution:<id>` outside this specification.

## FR-1 — Target plugin identity and containment

A release SHALL select exactly one catalog entry named `omp-spec-kit`, require source `./plugins/omp-spec-kit`, and prove that source resolves beneath the repository root. The child version plus declared extension and MCP entrypoints SHALL resolve beneath that child. Unrelated catalog entries, packages, or servers are outside this requirement.

**Acceptance:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-target-identity-and-containment)

**Scenario:** `@feature1` / `SCEN-select-contained-target-plugin`.

**Stories/use cases:** US-1; UC-1

## FR-2 — Deterministic child payload

A clean build from the immutable tag commit SHALL create the complete installable child, reject missing, unexpected, linked, or non-regular payload files, and record deterministic package-tree and archive SHA-256 values. Generated `dist/**` SHALL not depend on source/test/evidence files inside the child.

**Acceptance:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-deterministic-child-payload)

**Scenario:** `@feature2` / `SCEN-build-deterministic-child-payload`.

**Stories/use cases:** US-1; UC-1

## FR-3 — Installed canonical invocation

The release check SHALL install the exact candidate project-scope in an isolated OMP environment and invoke a canonical read-only request from a fresh session. It SHALL compare the observed candidate version and declared surface with the candidate manifest, while leaving request/result/error semantics to the kernel/runtime owner. For historical v0.3.2, the declared MCP surface is the eight shipped read-only names.

**Acceptance:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-installed-canonical-invocation)

**Scenario:** `@feature3` / `SCEN-invoke-installed-candidate`.

**Stories/use cases:** US-2; UC-2

## FR-4 — Fresh-session activation

Discovery, project-scope install, installed-version observation, `/reload-plugins`, old-session termination, fresh-session startup, and invocation SHALL be separate observations. Install or reload without fresh invocation SHALL not prove activation.

**Acceptance:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-fresh-session-activation)

**Scenario:** `@feature4` / `SCEN-require-fresh-session-activation`.

**Stories/use cases:** US-2; UC-2

## FR-5 — Dependency-absent execution

The installed extension and MCP launcher SHALL load and serve the canonical invocation when the source checkout, repository-root `node_modules`, and unrelated external dependencies are unavailable. Absolute workstation paths, install-time downloads, native addons, and undeclared runtime dependencies SHALL block release.

**Acceptance:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-dependency-absent-execution)

**Scenario:** `@feature5` / `SCEN-run-without-ambient-dependencies`.

**Stories/use cases:** US-2; UC-2

## FR-6 — Installed containment and read-only smoke

The installed smoke SHALL prove that the candidate resolves the active project rather than package CWD, does not escape the project/package boundaries, and performs no repository mutation, credential access, network access, model call, or background work. Detailed runtime diagnostics remain owned by the runtime contracts.

**Acceptance:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-installed-containment-and-read-only-smoke)

**Scenario:** `@feature6` / `SCEN-contain-installed-invocation`.

**Stories/use cases:** US-2; UC-2

## FR-7 — Version consistency and upgrade

Catalog version, child version, embedded version, tag, commit, archive digest, and fresh installed observation SHALL identify one candidate. Every release after the first SHALL upgrade from exact bytes of a real lower public release. Catalog refresh or an old-session observation SHALL not count as upgrade proof.

**Acceptance:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-version-consistency-and-upgrade)

**Scenario:** `@feature7` / `SCEN-upgrade-from-real-public-release`.

**Stories/use cases:** US-3; UC-3

## FR-8 — Uninstall, reinstall, and rollback

Every candidate SHALL prove uninstall plus fresh-session absence and reinstall of the same candidate digest plus fresh invocation. Every release after the first SHALL also roll back to exact bytes of a real public predecessor. Non-OMP-managed project bytes SHALL remain unchanged across all transitions.

**Acceptance:** [AC-8.1](ACCEPTANCE_CRITERIA.md#ac-81-uninstall-reinstall-and-rollback)

**Scenario:** `@feature8` / `SCEN-recover-with-exact-artifacts`.

**Stories/use cases:** US-3; UC-3

## FR-9 — Public-safety gates

Before publication, automation SHALL verify source provenance and license disposition, secret scanning, absence of local/user state, a clean public diff, and an allowlisted child payload. A failed check SHALL stop publication and SHALL not leak the triggering secret or host path.

**Acceptance:** [AC-9.1](ACCEPTANCE_CRITERIA.md#ac-91-public-safety-gates)

**Scenario:** `@feature9` / `SCEN-block-unsafe-public-artifact`.

**Stories/use cases:** US-4; UC-4

## FR-10 — Build once, publish the same digest, attest once

The tag workflow SHALL build the candidate once, pass its archive SHA-256 through the named release checks, and publish those exact bytes without rebuilding. It SHALL refuse replacement of an existing different asset and SHALL create one final GitHub Artifact Attestation whose subject is the public archive. PRs and untagged pushes SHALL remain verify-only.

**Acceptance:** [AC-10.1](ACCEPTANCE_CRITERIA.md#ac-101-build-once-publish-and-attest)

**Scenario:** `@feature10` / `SCEN-publish-same-digest-with-final-attestation`.

**Stories/use cases:** US-4; UC-4

## FR-11 — Distribution-owned release status

After publication, distribution SHALL write one immutable status record containing version, tag, commit, package-tree and archive SHA-256 values, supported OMP/platform identity, named check outcomes, lifecycle observations, public asset identity, and final attestation identity. It SHALL not decide global badges, task states, capabilities, MRI, or product delivery.

**Acceptance:** [AC-11.1](ACCEPTANCE_CRITERIA.md#ac-111-distribution-owned-status-record)

**Scenario:** `@feature11` / `SCEN-write-compact-distribution-status`.

**Stories/use cases:** US-5; UC-5

## FR-12 — Compact release decision

The release job SHALL decide from the named checks `target`, `build`, `install`, `invoke`, `dependencyAbsent`, `lifecycle`, and `publicSafety`. It SHALL report failed check names with bounded human diagnostics in CI logs; no public per-FR receipts, exhaustive host/runtime schemas, serialized-byte counters, or global repository inventory are part of the decision contract.

**Acceptance:** [AC-12.1](ACCEPTANCE_CRITERIA.md#ac-121-compact-release-decision)

**Scenario:** `@feature12` / `SCEN-block-on-named-check-failure`.

**Stories/use cases:** US-5; UC-5

## FR-13 — Practical distribution release path

A candidate is distribution-ready only when FR-1 through FR-12 are satisfied for one tag/commit/archive identity. The only forward path is: validate the contained target, build once, run installed and lifecycle/public-safety checks, publish the same digest, create the final archive attestation, and record the result. Historical eligibility and internal evidence-attestation formats SHALL remain readable historical evidence but SHALL NOT be required or emitted as the forward API.

**Acceptance:** [AC-13.1](ACCEPTANCE_CRITERIA.md#ac-131-practical-distribution-release-path)

**Scenario:** `@feature13` / `SCEN-use-one-practical-release-path`.

---

## Product lifecycle domain (merged)

All `SHALL` and `SHALL NOT` statements are normative. A written requirement is not execution evidence.

**Stories/use cases:** US-5; UC-5

## FR-14 — Current shipped baseline

The public roadmap SHALL contain exactly one SHIPPED row for `omp-spec-kit@omp-spec-kit` v0.3.2. The row SHALL describe the v0.2 graph/query kernel and eight working read-only MCP tools and SHALL link `docs/validation/release-status-v0.3.2.json` as its current release proof. Public-init, v0.1, v0.2, and v0.3 SHALL remain history rather than additional current rows.

- **Priority:** Must
- **Status:** Specified
- **Acceptance:** [AC-14.1](ACCEPTANCE_CRITERIA.md#ac-141-current-release-proof)
- **Scenario trace:** `@feature14`; `SCEN-product-current-release-proof`.
- **Stories/use cases:** US-6; UC-6.

## FR-15 — One-product identity

The repository SHALL expose one product named `omp-spec-kit`, installed as `omp-spec-kit@omp-spec-kit`, with one marketplace entry, one plugin package, and one extension. New outcomes SHALL remain inside that identity and SHALL NOT create a second product or competing specification write surface.

- **Priority:** Must
- **Status:** Specified
- **Acceptance:** [AC-15.1](ACCEPTANCE_CRITERIA.md#ac-151-single-product-identity)
- **Scenario trace:** `@feature15`; `SCEN-product-one-product-identity`.
- **Stories/use cases:** US-7; UC-7.

## FR-16 — Proof before shipped

Public product status SHALL use only SHIPPED, NEXT, and LATER. A row may enter SHIPPED only when a current observable proof names the exact released identity and result. Missing proof SHALL keep the outcome in NEXT or LATER. Specifications, task state, Gherkin text, historical receipts, and sibling progress SHALL NOT substitute for current proof.

- **Priority:** Must
- **Status:** Specified
- **Acceptance:** [AC-16.1](ACCEPTANCE_CRITERIA.md#ac-161-missing-proof-is-not-shipped), [AC-16.2](ACCEPTANCE_CRITERIA.md#ac-162-unexecuted-text-is-not-proof)
- **Scenario trace:** `@feature16`; `SCEN-product-missing-proof-is-not-shipped`; `SCEN-product-unexecuted-text-is-not-proof`.
- **Stories/use cases:** US-8; UC-8.

## FR-17 — Next safe authoring outcome

The roadmap SHALL contain exactly one NEXT row for safe spec authoring. Its public mutation surface and exact authoring-name allowlist SHALL both contain only spec_propose_patch and apply_proposed_patch; helper operations compile internally. Before each tool_call, the access gate SHALL accept only registered MCP operations for specification access, then SHALL refuse every other read, search, enumeration, shell, edit, or write whose canonically resolved target is under .specs/**. Resolution SHALL enforce repository containment across real paths, links, and reparse points. Accepted application SHALL be atomic and refusal reasons SHALL be bounded. The row SHALL NOT enter SHIPPED without real end-to-end proof of both the mutation path and the non-MCP access refusal path.

- **Priority:** Must
- **Status:** Specified
- **Acceptance:** [AC-17.1](ACCEPTANCE_CRITERIA.md#ac-171-bounded-public-mutation-surface), [AC-17.2](ACCEPTANCE_CRITERIA.md#ac-172-direct-spec-write-policy)
- **Scenario trace:** `@feature17`; `SCEN-product-authoring-tools-are-bounded`; `SCEN-product-direct-spec-write-is-refused`.
- **Stories/use cases:** US-9; UC-9.

## FR-18 — Plain later outcomes

The roadmap SHALL list expanded read queries, editor navigation, evidence queries, impact reporting, and manual exact-content plan validation as plain LATER outcomes. It SHALL NOT assign hidden substates, owner-internal checks, or shipment claims to them. A LATER outcome becomes NEXT only through an explicit product decision and becomes SHIPPED only under FR-16.

- **Priority:** Should
- **Status:** Specified
- **Acceptance:** [AC-18.1](ACCEPTANCE_CRITERIA.md#ac-181-three-bucket-roadmap)
- **Scenario trace:** `@feature18`; `SCEN-product-roadmap-has-three-buckets`.
- **Stories/use cases:** US-10; UC-10.

---

## MCP release-integrity domain (merged)

## FR-19: Active-project installed behavior

The installed MCP package SHALL locate its packaged server while preserving OMP's active-project working directory. With no override, every response SHALL describe the active project. A validated absolute override MAY select a different project. Relative, unresolved, package-local, or escaping roots SHALL NOT select data, and launching from package cwd SHALL fail before serving.

```yaml metadata
schemaVersion: 1
verificationMethod: test
contract:
  version: 1
  kind: behavior
  subject: Installed MCP root selection
  behavior:
    actor: OMP user
    trigger: A fresh session discovers the installed package
    preconditions: [The installed payload is allowlisted, The active project contains a specification corpus]
    observable_outcomes: [Responses describe the active project, A validated absolute override selects only its target]
    forbidden_outcomes: [Package decoys are served, A relative unresolved or escaping root is used]
  observables:
    - when: The package starts from project-a without an override
      then: Results contain project-a and exclude project-b and package decoys
  negative_cases:
    - when: Startup inherits package cwd or receives an unsafe root
      then: Startup refuses or retains the safe active project without serving package data
  verification:
    method: bdd
    required_evidence: [bdd, integration, implementation]
    scenario:
      refs: [SCEN-mri-active-project-root]
    implementation_surface:
      refs: [plugins/omp-spec-kit/.mcp.json, plugins/omp-spec-kit/bin/omp-spec-kit-mcp, src/adapters/query-service.js]
    evidence_policy: {source: runtime, freshness: current, independent: true}
```

**Related AC:** [AC-19.1](ACCEPTANCE_CRITERIA.md#ac-191-active-project-and-contained-override). **Use Case:** [UC-11](USE_CASES.md#uc-11-launch-from-the-active-project).

## FR-20: Terminal protocol errors and recovery

The MCP server SHALL emit one newline-delimited JSON-RPC response for every invalid identified request: `-32600` for an invalid request object, `-32700` for malformed JSON, `-32601` for an unknown method, and `-32602` for an unknown tool. A subsequent valid request SHALL succeed on the same process, and stdout SHALL contain protocol frames only.

```yaml metadata
schemaVersion: 1
verificationMethod: test
contract:
  version: 1
  kind: behavior
  subject: MCP protocol failure and recovery
  behavior:
    actor: MCP client
    trigger: An invalid newline-delimited request reaches the server
    preconditions: [The installed server process is running]
    observable_outcomes: [One terminal error is returned, A later valid request succeeds]
    forbidden_outcomes: [The request silently times out, Stdout contains non-protocol text]
  observables:
    - when: Invalid and valid frames are sent in sequence
      then: Each identified frame has one response and the process recovers
  negative_cases:
    - when: JSON is malformed or method or tool names are unknown
      then: The matching standard error is returned without terminating the process
  verification:
    method: bdd
    required_evidence: [bdd, implementation]
    scenario:
      refs: [SCEN-mri-terminal-json-rpc, SCEN-mri-malformed-json-recovery]
    implementation_surface:
      refs: [src/mcp/server.js, tests/helpers/mcp-world.mjs]
    evidence_policy: {source: runtime, freshness: current, independent: true}
```

**Related AC:** [AC-20.1](ACCEPTANCE_CRITERIA.md#ac-201-one-error-and-process-recovery). **Use Case:** [UC-12](USE_CASES.md#uc-12-recover-after-an-invalid-protocol-frame).

## FR-21: Historical eight-tool installed surface

The isolated v0.3.2 package SHALL list and execute exactly these historical read-only MCP tools: `spec_inventory`, `spec_get_node`, `spec_find_nodes`, `spec_get_edges`, `spec_trace`, `spec_diagnostics`, `spec_overview`, and `spec_markdown_inventory`. Every call SHALL return a complete external envelope for the manifest-verified corpus, with at least one serialization-boundary comparison to the shared query service. The package SHALL run without repository source or ambient dependency ancestry and SHALL perform zero specification writes. This exact set identifies v0.3.2 only; MRI owns no future registry-conservation rule.

```yaml metadata
schemaVersion: 1
verificationMethod: test
contract:
  version: 1
  kind: behavior
  subject: Installed v0.3.2 MCP surface
  behavior:
    actor: Release verifier
    trigger: The isolated installed package is launched against the pinned corpus
    preconditions: [Package and corpus manifests are verified, Source checkout and ambient dependencies are absent]
    observable_outcomes: [The historical eight names are listed, Every handler returns a complete result]
    forbidden_outcomes: [A descriptor exists without handler execution, The served corpus changes]
  observables:
    - when: All eight historical tools are called
      then: Every call succeeds and identifies the pinned corpus
  negative_cases:
    - when: A payload or corpus byte changes
      then: Manifest or immutability verification fails
  verification:
    method: bdd
    required_evidence: [bdd, integration, implementation]
    scenario:
      refs: [SCEN-mri-all-tool-parity]
    implementation_surface:
      refs: [src/adapters/tool-contracts.js, src/mcp/server.js, tests/helpers/mcp-world.mjs]
    evidence_policy: {source: runtime, freshness: current, independent: true}
```

**Related AC:** [AC-21.1](ACCEPTANCE_CRITERIA.md#ac-211-eight-installed-handlers-and-zero-writes). **Use Case:** [UC-13](USE_CASES.md#uc-13-exercise-the-historical-v032-surface).

## FR-22: One real candidate run

A future candidate SHALL have one successful unfiltered MRI run produced by the real Docker Cucumber producer and bound to the candidate digest, archive digest, feature digest, step-definition digest, and source-input manifest digest. The run SHALL cover active-project launch, protocol recovery, all eight historical handlers, public-tree safety, and real fresh-session install, upgrade from the supported predecessor, rollback, uninstall absence, and reinstall. Observed versions and non-OMP project hashes SHALL be recorded. Failed, malformed, meta-only, tag-scoped, or name-scoped output SHALL NOT replace the trusted run. No scenario count, pickle count, per-FR receipt registry, or detailed Cucumber parser error vocabulary is release identity.

```yaml metadata
schemaVersion: 1
verificationMethod: test
contract:
  version: 1
  kind: behavior
  subject: Real candidate verification run
  behavior:
    actor: Release maintainer
    trigger: One clean candidate enters verification
    preconditions: [The real Docker producer runs unfiltered, Lifecycle observations use fresh sessions]
    observable_outcomes: [All named behavior groups pass, Upgrade rollback uninstall and reinstall report expected versions and unchanged project hashes]
    forbidden_outcomes: [A scoped or malformed run becomes trusted, Receipt shape substitutes for lifecycle execution]
  observables:
    - when: The unfiltered candidate profile completes
      then: One hash-bound run result reports the observable groups and lifecycle journey
  negative_cases:
    - when: Output is meta-only failed malformed or scoped
      then: It cannot replace the last successful unfiltered run
  verification:
    method: bdd
    required_evidence: [bdd, integration, operational-proof]
    scenario:
      refs: [SCEN-mri-public-eligibility-separation]
    implementation_surface:
      refs: [scripts/docker-bdd.sh, tests/fixtures/release-candidate/cucumber-messages.ndjson, tests/step-definitions/release-candidate.steps.mjs]
    evidence_policy: {source: runtime, freshness: current, independent: true}
```

**Related AC:** [AC-22.1](ACCEPTANCE_CRITERIA.md#ac-221-unfiltered-run-and-observed-lifecycle). **Use Case:** [UC-14](USE_CASES.md#uc-14-run-a-future-candidate-journey).

## FR-23: Contained deterministic candidate and same-byte publication

Candidate creation SHALL resolve a clean peeled semantic-version tag, enumerate allowlisted regular files in lexical order, canonicalize candidate file modes to 0755 under `bin/` and 0644 elsewhere independent of source modes, include those canonical modes in the package-tree digest and tar archive headers, reject symlink/junction/reparse escape, and emit package-tree, archive, and candidate digests. Public-tree verification SHALL reject credential-bearing bytes with redacted bounded findings without exposing a secret-category ABI. Publication SHALL verify the exact artifact subject with GitHub Artifact Attestations, download and re-hash the verified archive, and publish those same bytes without rebuild. Existing releases are idempotent only when required asset name, size, and digest match.

```yaml metadata
schemaVersion: 1
verificationMethod: test
contract:
  version: 1
  kind: behavior
  subject: Candidate bytes and publication
  behavior:
    actor: Release workflow
    trigger: A clean tagged candidate is assembled and published
    preconditions: [Inputs are regular contained files, Native attestation verification binds subject repository workflow and tag ref]
    observable_outcomes: [Deterministic candidate identities are emitted, Published archive digest equals the verified archive digest]
    forbidden_outcomes: [Publish rebuilds, Escaping or secret-bearing input is read or published]
  observables:
    - when: Publish receives the verified candidate archive
      then: Downloaded and released bytes have the candidate archive digest
  negative_cases:
    - when: Containment attestation or asset identity differs
      then: No release mutation occurs
  verification:
    method: integration
    required_evidence: [bdd, integration, implementation, operational-proof]
    scenario:
      refs: [SCEN-mri-artifact-mismatch-refusal, SCEN-mri-executable-launcher-archive, SCEN-mri-symlinked-evidence-refusal]
    implementation_surface:
      refs: [scripts/create-release-candidate.mjs, scripts/verify-public-tree.mjs, scripts/verify-release.mjs, .github/workflows/release.yml]
    evidence_policy: {source: external, freshness: current, independent: true}
```

**Related AC:** [AC-23.1](ACCEPTANCE_CRITERIA.md#ac-231-publish-only-the-attested-candidate-bytes). **Use Case:** [UC-15](USE_CASES.md#uc-15-publish-the-verified-archive).

## FR-24: Public guidance and immutable v0.3.2 evidence

The repository SHALL retain v0.3.0 history with a reversible advisory and SHALL identify v0.3.2 as the current public release. Root/package guidance, changelog, and captured release notes SHALL agree with the immutable v0.3.2 record. Historical evidence@3, release result, lifecycle, manager-discovery, and attestation fields MAY be read for that release but SHALL NOT be extended, reclassified, or used as the forward candidate schema after feature or step changes.

```yaml metadata
schemaVersion: 1
verificationMethod: test
contract:
  version: 1
  kind: behavior
  subject: Public release history and evidence reader
  behavior:
    actor: Plugin user
    trigger: Public status or recovery guidance is read
    preconditions: [The bounded v0.3.2 record remains immutable]
    observable_outcomes: [Guidance identifies v0.3.2 and fresh-session behavior, The v0.3.0 advisory remains available]
    forbidden_outcomes: [Historical bytes are relabeled as a new run, Public tags or history are rewritten]
  observables:
    - when: The v0.3.2 record and guidance are reconciled
      then: Version release URL archive digest notes hash attestation and advisory agree
  negative_cases:
    - when: A future candidate lacks current run or artifact proof
      then: Guidance generation withholds a release-ready claim
  verification:
    method: integration
    required_evidence: [integration, implementation, review]
    scenario:
      refs: [SCEN-mri-public-communication-proof]
    implementation_surface:
      refs: [docs/validation/release-status-v0.3.2.json, docs/advisories/v0.3.0-mcp-root.md, scripts/render-release-notes.mjs]
    evidence_policy: {source: external, freshness: current, independent: true}
```

**Related AC:** [AC-24.1](ACCEPTANCE_CRITERIA.md#ac-241-public-history-remains-honest). **Use Case:** [UC-16](USE_CASES.md#uc-16-read-immutable-v032-evidence).

## FR-25: Response source identity and root consistency

The installed stdio MCP adapter and OMP extension SHALL resolve one canonical physical repository root through the same resolver. Every successful result and every typed read error SHALL include a `provenance` object with `serverName`, opaque `resolvedRootId`, opaque `activeProjectRootId`, `rootMode`, and `matchesActiveProject`. The two root IDs SHALL be lowercase SHA-256 identities of canonical physical roots and SHALL NOT disclose absolute paths, environment values, or document content. Without an override, `rootMode` SHALL be `active-project` and `matchesActiveProject` SHALL be true. An explicit absolute override MAY select another project only when `rootMode` is `explicit-absolute-override` and `matchesActiveProject` is false; the structured result SHALL expose the override identity without silently presenting it as the active project. A `repositoryRootFingerprint` conflict MUST use stable `causeCode` `REPOSITORY_ROOT_FINGERPRINT_MISMATCH`, mention that another project or a stale snapshot may be in use, expose only `activeProjectRootId` and `resolvedRootId` as root identities, and direct the caller to `mcp_preflight`. When those roots do not match, the caller MUST reconnect; otherwise it MUST refresh the `spec_catalog` overview and create a new proposal.

```yaml metadata
schemaVersion: 1
verificationMethod: test
contract:
  version: 1
  kind: behavior
  subject: Installed response source identity
  behavior:
    actor: OMP user or MCP client
    trigger: A read-only tool returns a result from an installed package
    preconditions: [The installed package is launched from an active project]
    observable_outcomes: [Every result names the server and opaque source identities, Every tool uses one resolved root, An explicit override is visible as an active-project mismatch]
    forbidden_outcomes: [A result silently presents a foreign root as the active project, Absolute private paths or environment values are disclosed, Inventory and query tools read different roots]
  observables:
    - when: The package serves an active project without an override
      then: Every result has matching active and resolved root identities and `rootMode: active-project`
    - when: The package serves an explicit absolute project override
      then: Every result has one override identity and `matchesActiveProject: false`
  negative_cases:
    - when: The OMP extension receives a foreign absolute override beside an active-project cwd
      then: Its inventory and query tools report the same overridden root identity
    - when: A result is serialized
      then: It contains no absolute root path, environment value, or document body
  verification:
    method: bdd
    required_evidence: [bdd, integration, implementation]
    scenario:
      refs: [SCEN-mri-response-provenance, SCEN-mri-extension-root-consistency]
    implementation_surface:
      refs: [src/adapters/query-service.js, src/mcp/server.js, src/v0.1/extension.js, src/v0.1/inventory.js]
    evidence_policy: {source: runtime, freshness: current, independent: true}
```

**Related AC:** [AC-25.1](ACCEPTANCE_CRITERIA.md#ac-251-response-source-identity-and-root-consistency). **Use Case:** [UC-17](USE_CASES.md#uc-17-distinguish-the-active-and-overridden-project).

## FR-26: Consolidated 11-tool MCP discovery and release evidence

The v0.8.0 release SHALL provide exactly 11 MCP tools, verified by release preflight, archive smoke test, and installed package discovery. Release assets and candidate validation SHALL prove 10 read-only and 1 mutating tool, zero deprecated tool names, and catalog size within the 25,499-byte limit.

```yaml metadata
schemaVersion: 1
verificationMethod: test
contract:
  version: 1
  kind: behavior
  subject: Consolidated 11-tool MCP discovery
  behavior:
    actor: Release verifier
    trigger: The v0.8.0 candidate package is discovered and inspected
    preconditions: [The candidate build is complete, Baseline metrics are frozen]
    observable_outcomes: [Exactly 11 tools are discovered, 10 read-only and 1 mutating tool are annotated, Catalog size does not exceed 25499 bytes]
    forbidden_outcomes: [Any of the 27 retired tool names appears, Surface blast limits are exceeded]
  observables:
    - when: Tools are listed
      then: Exactly 11 tools are returned matching the consolidated catalog
  negative_cases:
    - when: A retired tool name is present
      then: Blast verification fails closed
  verification:
    method: bdd
    required_evidence: [bdd, integration, implementation]
    scenario:
      refs: [SCEN-mri-consolidated-11-tools]
    implementation_surface:
      refs: [src/adapters/tool-contracts.js, src/mcp/server.js, scripts/measure-mcp-tool-blast.mjs]
    evidence_policy: {source: runtime, freshness: current, independent: true}
```

**Related AC:** [AC-26.1](ACCEPTANCE_CRITERIA.md#ac-261-consolidated-11-tool-mcp-discovery-and-release-evidence). **Use Case:** [UC-18](USE_CASES.md#uc-18-discover-consolidated-11-tool-surface).
