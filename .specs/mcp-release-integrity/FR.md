# Functional Requirements (FR)

## FR-1: Active-project MCP root

The installed MCP configuration SHALL locate its packaged server executable without setting `cwd`; when OMP launches it, the server SHALL read the active project directory supplied by OMP. `OMP_SPEC_KIT_ROOT` MAY override that root only when it is a validated absolute non-package path. The launcher SHALL export its canonical package root as internal `OMP_SPEC_KIT_PACKAGE_ROOT`; an override equal to it SHALL retain the active project, and an inherited cwd equal to it SHALL fail closed with `PACKAGE_ROOT_REFUSED`. A package directory, an unresolved placeholder, a bare environment-variable name, and a relative override SHALL NOT become the served repository root; a different valid absolute project root SHALL be honored.

```yaml metadata
schemaVersion: 1
verificationMethod: test
contract:
  version: 1
  kind: behavior
  subject: Installed MCP root selection
  behavior:
    actor: OMP user
    trigger: Fresh session discovers the installed package MCP configuration
    preconditions:
      - The package launcher and server are present in an allowlisted package copy
      - The active project contains a valid specification corpus
    observable_outcomes:
      - Every MCP envelope is built from the active project corpus
      - An explicit validated absolute override selects only its named corpus
    forbidden_outcomes:
      - Package-local decoy specifications appear in an ordinary request
      - A relative or unresolved override changes the active project root
  observables:
    - when: The launcher starts from project-a without an override
      then: The overview reports project-a identifiers and excludes package and project-b identifiers
  negative_cases:
    - when: The override is relative or the unresolved literal OMP_SPEC_KIT_ROOT
      then: The server retains the supplied active project directory
  verification:
    method: bdd
    required_evidence: [bdd, integration, implementation]
    scenario:
      refs: [SCEN-mri-active-project-root]
    implementation_surface:
      refs: ["plugins/omp-spec-kit/.mcp.json", "plugins/omp-spec-kit/bin/omp-spec-kit-mcp", "src/adapters/query-service.js"]
    evidence_policy:
      source: runtime
      freshness: current
      independent: true
```

**Related AC:** [AC-1.1](ACCEPTANCE_CRITERIA.md#ac-11-active-project-wins-over-package-cwd). **Use Case:** [UC-1](USE_CASES.md#uc-1-fresh-project-scoped-mcp-discovery).

## FR-2: Terminal JSON-RPC protocol responses

The MCP server SHALL emit exactly one newline-delimited JSON-RPC response for every malformed or invalid request object that carries an id. It SHALL return `-32600` for a non-2.0 request object, `-32700` for malformed JSON, `-32601` for an unknown method, and `-32602` for an unknown tool. Valid requests after an invalid frame SHALL remain processable; no diagnostic, trace, or launcher output SHALL appear on stdout.

```yaml metadata
schemaVersion: 1
verificationMethod: test
contract:
  version: 1
  kind: behavior
  subject: MCP request framing and errors
  behavior:
    actor: MCP client
    trigger: A newline-delimited request frame reaches the running server
    preconditions:
      - The server process owns one immutable shared query service
    observable_outcomes:
      - The client receives one terminal response with the original request id
      - Unknown method and unknown tool return -32601 and -32602 with their ids
      - A later valid request succeeds on the same process
    forbidden_outcomes:
      - Invalid request objects silently time out
      - Stdout contains a non-JSON-RPC line
  observables:
    - when: A JSON-RPC 1.0 object with id 7 is sent
      then: One response has id 7 and error code -32600
  negative_cases:
    - when: Malformed JSON, an unknown method, or an unknown tool is sent
      then: One response has the matching null/original id and error code -32700, -32601, or -32602
  verification:
    method: bdd
    required_evidence: [bdd, implementation]
    scenario:
      refs: [SCEN-mri-terminal-json-rpc]
    implementation_surface:
      refs: ["src/mcp/server.js", "tests/helpers/mcp-world.mjs"]
    evidence_policy:
      source: runtime
      freshness: current
      independent: true
```

**Related AC:** [AC-2.1](ACCEPTANCE_CRITERIA.md#ac-21-invalid-frames-are-terminal-and-framed). **Use Case:** [UC-2](USE_CASES.md#uc-2-invalid-protocol-request-receives-one-answer).

## FR-3: Installed-package all-tool parity

For the v0.3.2 candidate lineage, the isolated installed package SHALL expose exactly the eight SCHEMA-11 read-only MCP tools that constitute the historical v0.3 first slice. This release-specific parity requirement is not the destination registry ceiling. For every tool, a valid call SHALL return one complete canonical `QueryEnvelope` that deep-equals the direct shared query-service answer over the same manifest-verified corpus. The server SHALL run without repository source files or ambient `node_modules` ancestry and SHALL not modify any served specification bytes.

```yaml metadata
schemaVersion: 1
verificationMethod: test
contract:
  version: 1
  kind: behavior
  subject: Installed MCP package parity
  behavior:
    actor: Release verification
    trigger: An isolated package launcher serves the pinned corpus
    preconditions:
      - The corpus manifest hash and byte sizes are verified
      - The source checkout and ambient dependency ancestry are absent
    observable_outcomes:
      - The tool set equals the eight SCHEMA-11 names
      - Each structured response equals its direct-service oracle
    forbidden_outcomes:
      - A tool descriptor exists without executing its handler
      - The corpus changes while the server is queried
  observables:
    - when: Every SCHEMA-11 tool is called through the isolated launcher
      then: Each response has one canonical full envelope equal to the direct service result
  negative_cases:
    - when: The served corpus is changed after its snapshot
      then: The immutability assertion fails rather than accepting a stale or different corpus
  verification:
    method: bdd
    required_evidence: [bdd, integration, implementation]
    scenario:
      refs: [SCEN-mri-all-tool-parity]
    implementation_surface:
      refs: ["src/adapters/tool-contracts.js", "src/mcp/server.js", "tests/features/spec-mcp.feature", "tests/helpers/mcp-world.mjs"]
    evidence_policy:
      source: runtime
      freshness: current
      independent: true
```

**Related AC:** [AC-3.1](ACCEPTANCE_CRITERIA.md#ac-31-the-packaged-mcp-surface-is-complete-and-immutable). **Use Case:** [UC-3](USE_CASES.md#uc-3-all-eight-tool-parity-from-an-installed-package).

## FR-4: Candidate-bound lifecycle eligibility

The release evaluator SHALL accept MRI evidence for a v0.3.2 candidate only when its version authorities, peeled tag commit, package tree digest, archive digest, candidate manifest, public-safety result, Docker BDD result, and all mandatory MRI requirement receipts agree. For v0.3.2, the MRI lifecycle set SHALL include a named public v0.3.0 tagged-source proof, upgrade from v0.3.0, and rollback to v0.3.0; a stage/job summary, any arbitrary SHA, or a missing transition SHALL not establish MRI eligibility. MRI, distribution, and public eligibility SHALL remain separate results. Self-attested distribution producer receipts SHALL block public release. The trusted path SHALL verify the exact copied distribution-evidence subject through GitHub Artifact Attestations against repository `stgmt/omp-spec-kit`, signer workflow `stgmt/omp-spec-kit/.github/workflows/distribution-evidence.yml`, and source ref `refs/tags/<candidate-tag>`; v0.3.2 is the bounded historical successful instance recorded in `docs/validation/release-status-v0.3.2.json`; local Docker tests prove fail-closed evaluator branches, while that external record (not a synthetic local verifier) is the positive publication readback.

```yaml metadata
schemaVersion: 1
verificationMethod: test
contract:
  version: 1
  kind: behavior
  subject: Candidate release eligibility
  behavior:
    actor: Release evaluator
    trigger: A candidate manifest and its evidence receipts are evaluated
    preconditions:
      - The candidate was assembled after one clean package build
      - The required evidence matrix names the candidate version and tag commit
    observable_outcomes:
      - MRI eligibility is true only for a complete mutually consistent candidate
      - Public eligibility is false when structurally complete distribution evidence is self-attested or attestation verification fails
      - Public eligibility is true only when separately eligible MRI and attestation-verified distribution results share the exact candidate identity
      - Blocking details name every failed identity, missing lifecycle item, or failed trust-root check
    forbidden_outcomes:
      - An arbitrary receipt commit satisfies RELEASE_COMMIT
      - Upgrade or rollback is inferred from a release job success
      - Self-authored distribution metadata authorizes public release
  observables:
    - when: The v0.3.2 candidate has matching complete MRI evidence and the copied distribution subject passes the fixed GitHub attestation trust root
      then: The evaluator emits distinct eligible MRI, eligible distribution, and eligible public results for one candidate identity
  negative_cases:
    - when: One receipt, mandatory scenario execution, archive byte, tag commit, upgrade, rollback, or attestation identity is missing or different
      then: The evaluator emits public eligible false and publication is blocked
  verification:
    method: bdd
    required_evidence: [bdd, integration, implementation, operational-proof]
    scenario:
      refs: [SCEN-mri-public-eligibility-separation, SCEN-mri-self-attested-distribution-refusal]
    implementation_surface:
      refs: ["scripts/create-release-candidate.mjs", "scripts/verify-public-tree.mjs", "scripts/verify-release.mjs"]
    evidence_policy:
      source: external
      freshness: current
      independent: true
```

**Related AC:** [AC-4.1](ACCEPTANCE_CRITERIA.md#ac-41-candidate-evidence-is-complete-and-bound). **Use Case:** [UC-4](USE_CASES.md#uc-4-candidate-release-upgrade-and-rollback).

## FR-5: Artifact-only publication

The verification workflow SHALL build and validate one candidate archive. The publish workflow SHALL download that artifact, recompute its digest, recheck tag and receipt identity, and attach the exact archive plus candidate manifest to the release. It SHALL NOT rebuild the plugin, publish an unverified checkout, overwrite a release with a mismatched asset, or treat matching `targetCommitish` alone as idempotent success.

```yaml metadata
schemaVersion: 1
verificationMethod: test
contract:
  version: 1
  kind: behavior
  subject: Artifact-only GitHub release publication
  behavior:
    actor: GitHub Actions publish job
    trigger: A matching semantic-version tag starts the release workflow
    preconditions:
      - The verify job uploaded a complete candidate bundle
      - The candidate eligibility result is true
    observable_outcomes:
      - Publish consumes the uploaded archive and manifest
      - Existing matching releases remain idempotent only when every required asset identity matches
    forbidden_outcomes:
      - Publish invokes the package build command
      - Publish replaces a release with a missing or different asset
  observables:
    - when: Publish receives a verified candidate artifact
      then: The released asset digest equals the verified candidate archive digest
  negative_cases:
    - when: A candidate digest or existing release asset differs
      then: Publish exits before creating or modifying the release
  verification:
    method: integration
    required_evidence: [integration, implementation, review]
    scenario:
      refs: [SCEN-mri-artifact-mismatch-refusal]
    implementation_surface:
      refs: [".github/workflows/verify.yml", ".github/workflows/release.yml", "scripts/render-release-notes.mjs"]
    evidence_policy:
      source: external
      freshness: current
      independent: true
```

**Related AC:** [AC-5.1](ACCEPTANCE_CRITERIA.md#ac-51-publish-consumes-the-verified-artifact-only). **Use Case:** [UC-5](USE_CASES.md#uc-5-safe-release-publication-and-recovery-information).

## FR-6: Honest release communication

The repository SHALL retain v0.3.0 history without rewriting its tag, but SHALL publish a clear reversible advisory that names the MCP active-project defect and directs users to v0.3.2. The root README, package README, changelog, and v0.3.2 release notes SHALL derive their version and capability claims from the verified candidate data and SHALL not claim first-release lifecycle exemptions or v0.1-only MCP behavior.

```yaml metadata
schemaVersion: 1
verificationMethod: test
contract:
  version: 1
  kind: behavior
  subject: Release advisory and generated public documentation
  behavior:
    actor: Existing or prospective plugin user
    trigger: The user reads a release page or installation document
    preconditions:
      - The v0.3.2 candidate passed its eligibility gate
    observable_outcomes:
      - v0.3.0 is visibly superseded for the MCP root defect
      - v0.3.2 documentation reports the candidate version and fresh-session requirement
    forbidden_outcomes:
      - Documentation claims unverified scenario counts or lifecycle proof
      - Public history is deleted or force-moved
  observables:
    - when: Release notes are rendered from a verified v0.3.2 candidate
      then: The version and digest references equal the candidate manifest values
  negative_cases:
    - when: Candidate evidence is missing or stale
      then: Notes rendering fails instead of emitting a readiness claim
  verification:
    method: integration
    required_evidence: [integration, implementation, review]
    scenario:
      refs: [SCEN-mri-public-communication-proof]
    implementation_surface:
      refs: ["docs/advisories/v0.3.0-mcp-root.md", "scripts/render-release-notes.mjs", "README.md", "CHANGELOG.md"]
    evidence_policy:
      source: external
      freshness: current
      independent: true
```

**Related AC:** [AC-6.1](ACCEPTANCE_CRITERIA.md#ac-61-public-status-tells-users-the-truth). **Use Case:** [UC-5](USE_CASES.md#uc-5-safe-release-publication-and-recovery-information).
