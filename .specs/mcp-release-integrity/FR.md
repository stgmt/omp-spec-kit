# Functional Requirements (FR)

## FR-1: Active-project installed behavior

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

**Related AC:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-active-project-and-contained-override). **Use Case:** [UC-1](USE_CASES.md#uc-1-launch-from-the-active-project).

## FR-2: Terminal protocol errors and recovery

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

**Related AC:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-one-error-and-process-recovery). **Use Case:** [UC-2](USE_CASES.md#uc-2-recover-after-an-invalid-protocol-frame).

## FR-3: Historical eight-tool installed surface

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

**Related AC:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-eight-installed-handlers-and-zero-writes). **Use Case:** [UC-3](USE_CASES.md#uc-3-exercise-the-historical-v032-surface).

## FR-4: One real candidate run

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
      refs: [SCEN-mri-meta-only-evidence-refusal]
    implementation_surface:
      refs: [scripts/docker-bdd.sh, tests/fixtures/release-candidate/cucumber-messages.ndjson, tests/step-definitions/release-candidate.steps.mjs]
    evidence_policy: {source: runtime, freshness: current, independent: true}
```

**Related AC:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-unfiltered-run-and-observed-lifecycle). **Use Case:** [UC-4](USE_CASES.md#uc-4-run-a-future-candidate-journey).

## FR-5: Contained deterministic candidate and same-byte publication

Candidate creation SHALL resolve a clean peeled semantic-version tag, enumerate allowlisted regular files in lexical order, preserve required executable mode, reject symlink/junction/reparse escape, and emit package-tree, archive, and candidate digests. Public-tree verification SHALL reject credential-bearing bytes with redacted bounded findings without exposing a secret-category ABI. Publication SHALL verify the exact artifact subject with GitHub Artifact Attestations, download and re-hash the verified archive, and publish those same bytes without rebuild. Existing releases are idempotent only when required asset name, size, and digest match.

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

**Related AC:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-publish-only-the-attested-candidate-bytes). **Use Case:** [UC-5](USE_CASES.md#uc-5-publish-the-verified-archive).

## FR-6: Public guidance and immutable v0.3.2 evidence

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

**Related AC:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-public-history-remains-honest). **Use Case:** [UC-6](USE_CASES.md#uc-6-read-immutable-v032-evidence).

## FR-7: Response source identity and root consistency

The installed stdio MCP adapter and OMP extension SHALL resolve one canonical physical repository root through the same resolver. Every successful result and every typed read error SHALL include a `provenance` object with `serverName`, opaque `resolvedRootId`, opaque `activeProjectRootId`, `rootMode`, and `matchesActiveProject`. The two root IDs SHALL be lowercase SHA-256 identities of canonical physical roots and SHALL NOT disclose absolute paths, environment values, or document content. Without an override, `rootMode` SHALL be `active-project` and `matchesActiveProject` SHALL be true. An explicit absolute override MAY select another project only when `rootMode` is `explicit-absolute-override` and `matchesActiveProject` is false; the structured result and human-readable summary SHALL make that mismatch visible. Relative, placeholder, package-local, and escaping values SHALL retain the active project or refuse before serving. All eight MCP tools and the legacy OMP inventory tool SHALL report the same resolved root and provenance for one execution context.

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

**Related AC:** [AC-7.1](ACCEPTANCE_CRITERIA.md#ac-71-response-source-identity-and-root-consistency). **Use Case:** [UC-7](USE_CASES.md#uc-7-distinguish-the-active-and-overridden-project).
