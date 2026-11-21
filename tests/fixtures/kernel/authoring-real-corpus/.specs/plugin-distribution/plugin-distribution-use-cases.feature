Feature: plugin-distribution use cases

  @case:UC-1 @story:US-1
  Rule: Validate the target package
    Actor: Release maintainer.
    Boundary: Installed plugin and release workflow
    Trigger: Validate the target package
    Precondition: A tagged candidate and marketplace metadata exist.
    Success: Candidate identity and child containment satisfy FR-1 and FR-2.
    Covers: FR-1, FR-2
    Step: request | Read the marketplace, select the unique omp-spec-kit entry, and verify the source and entrypoints stay inside the selected child.
    Context:
      **Actor:** Release maintainer.

      **Precondition:** A tagged candidate and marketplace metadata exist.

      **Flow:** Read the marketplace, select the unique omp-spec-kit entry, and verify the source and entrypoints stay inside the selected child.

      **Postcondition:** Candidate identity and child containment satisfy FR-1 and FR-2.

      **Related:** FR-1, FR-2, @feature1, @feature2

    @feature2 @FR-2 @AC-2.1 @id:SCEN-build-deterministic-child-payload
    Scenario: Build deterministic child bytes
      Given the immutable tag commit and a clean output directory
      When the candidate is built twice
      Then the package-tree digests match
      And the archive digests match
      And unexpected or linked payload files are rejected

  @case:UC-2 @story:US-2
  Rule: Build and invoke once
    Actor: Release maintainer.
    Boundary: Installed plugin and release workflow
    Trigger: Build and invoke once
    Precondition: The selected tag and clean build environment are fixed.
    Success: Installed candidate satisfies FR-3 through FR-6 without source-checkout or ambient-dependency fallback.
    Covers: FR-3, FR-4, FR-5, FR-6
    Step: request | Build once, record package/archive hashes, invoke the installed bytes from a foreign working directory, and verify dependency absence.
    Context:
      **Actor:** Release maintainer.

      **Precondition:** The selected tag and clean build environment are fixed.

      **Flow:** Build once, record package/archive hashes, invoke the installed bytes from a foreign working directory, and verify dependency absence.

      **Postcondition:** Installed candidate satisfies FR-3 through FR-6 without source-checkout or ambient-dependency fallback.

      **Related:** FR-3, FR-4, FR-5, FR-6, @feature3, @feature4, @feature5, @feature6

    @feature4 @FR-4 @AC-4.1 @id:SCEN-require-fresh-session-activation
    Scenario: Reload does not replace fresh activation proof
      Given discovery install and reload have completed
      When the pre-install session remains active
      Then activation is not proven
      When that session ends and a fresh session invokes the candidate
      Then activation is proven

    @feature5 @FR-5 @AC-5.1 @id:SCEN-run-without-ambient-dependencies
    Scenario: Run without ambient dependencies
      Given the installed payload is isolated from the checkout and external node_modules
      When the extension and MCP launcher are started
      Then the canonical invocation succeeds
      And no undeclared runtime dependency is used

    @feature6 @FR-6 @AC-6.1 @id:SCEN-contain-installed-invocation
    Scenario: Contain the installed invocation
      Given the active project differs from the package directory
      When the installed candidate is invoked
      Then it resolves the active project
      And project hashes remain unchanged
      And no credential network model or background access occurs

  @case:UC-3 @story:US-3
  Rule: Exercise lifecycle recovery
    Actor: Release owner.
    Boundary: Installed plugin and release workflow
    Trigger: Exercise lifecycle recovery
    Precondition: A verified candidate and a preserved project baseline exist.
    Success: Lifecycle transitions are reversible and satisfy FR-7 and FR-8.
    Covers: FR-7, FR-8
    Step: request | Install, uninstall, reinstall, upgrade, and rollback the candidate while comparing project hashes and fresh-session behavior.
    Context:
      **Actor:** Release owner.

      **Precondition:** A verified candidate and a preserved project baseline exist.

      **Flow:** Install, uninstall, reinstall, upgrade, and rollback the candidate while comparing project hashes and fresh-session behavior.

      **Postcondition:** Lifecycle transitions are reversible and satisfy FR-7 and FR-8.

      **Related:** FR-7, FR-8, @feature7, @feature8

    @feature8 @FR-8 @AC-8.1 @id:SCEN-recover-with-exact-artifacts
    Scenario: Recover with uninstall reinstall and rollback
      Given the candidate is installed
      When it is uninstalled reinstalled and rolled back with exact artifacts
      Then fresh sessions observe absence candidate and predecessor in order
      And non-OMP-managed project hashes remain unchanged

  @case:UC-4 @story:US-4
  Rule: Apply public-safety checks
    Actor: Release owner.
    Boundary: Installed plugin and release workflow
    Trigger: Apply public-safety checks
    Precondition: A candidate archive and its provenance are available.
    Success: Public safety and same-byte publication satisfy FR-9 and FR-10.
    Covers: FR-9, FR-10
    Step: request | Verify provenance, licenses, secret scanning, user-state exclusion, payload allowlist, exact digest publication, and attestation.
    Context:
      **Actor:** Release owner.

      **Precondition:** A candidate archive and its provenance are available.

      **Flow:** Verify provenance, licenses, secret scanning, user-state exclusion, payload allowlist, exact digest publication, and attestation.

      **Postcondition:** Public safety and same-byte publication satisfy FR-9 and FR-10.

      **Related:** FR-9, FR-10, @feature9, @feature10

    @feature10 @FR-10 @AC-10.1 @id:SCEN-publish-same-digest-with-final-attestation
    Scenario: Publish the same digest with one final attestation
      Given every named check passed for a qualifying tag
      When the release is published
      Then the public archive digest equals the verified build digest
      And one final GitHub Artifact Attestation names that archive digest
      And no rebuild or different replacement asset is allowed

  @case:UC-5 @story:US-5
  Rule: Publish verified status
    Actor: Maintainer.
    Boundary: Installed plugin and release workflow
    Trigger: Publish verified status
    Precondition: Candidate checks and public-safety evidence are complete.
    Success: Only the documented release state is communicated, satisfying FR-11 through FR-13.
    Covers: FR-11, FR-12, FR-13
    Step: request | Evaluate the distribution-owned status, compact release decision, and practical release path against the immutable candidate record.
    Context:
      **Actor:** Maintainer.

      **Precondition:** Candidate checks and public-safety evidence are complete.

      **Flow:** Evaluate the distribution-owned status, compact release decision, and practical release path against the immutable candidate record.

      **Postcondition:** Only the documented release state is communicated, satisfying FR-11 through FR-13.

      **Related:** FR-11, FR-12, FR-13, @feature11, @feature12, @feature13

    @feature12 @FR-12 @AC-12.1 @id:SCEN-block-on-named-check-failure
    Scenario: Block on a named check failure
      Given one of target build install invoke dependencyAbsent lifecycle or publicSafety failed
      When the release decision is made
      Then publication stops
      And CI diagnostics name the failed check
      And no extra receipt envelope is required

    @feature13 @FR-13 @AC-13.1 @id:SCEN-use-one-practical-release-path
    Scenario: Use one practical release path
      Given a next candidate is ready for evaluation
      When distribution processes the candidate
      Then it validates the target and builds once
      And it runs installed lifecycle and public-safety checks
      And it publishes the same digest and attests the public archive
      And it does not emit distribution-release-eligibility at 2

  @case:UC-11 @story:US-2
  Rule: Launch from the active project
    Actor: Project user.
    Boundary: Installed plugin and release workflow
    Trigger: Launch from the active project
    Precondition: The installed plugin is invoked from a project whose active root differs from package CWD.
    Success: The installed invocation uses the active project and cannot escape the contained override.
    Covers: FR-19
    Step: request | Resolve the active project, apply a contained override when present, and compare the response root with the active project identity.
    Branch: origin | request | The project and package working directories differ | The launcher uses the active project | end
    ScenarioRef: origin | SCEN-mri-active-project-root
    Context:
      **Actor:** Project user.

      **Precondition:** The installed plugin is invoked from a project whose active root differs from package CWD.

      **Flow:** Resolve the active project, apply a contained override when present, and compare the response root with the active project identity.

      **Postcondition:** The installed invocation uses the active project and cannot escape the contained override.

      **Related:** FR-19, AC-19.1

  @case:UC-12 @story:US-2
  Rule: Recover after an invalid protocol frame
    Actor: MCP client.
    Boundary: Installed plugin and release workflow
    Trigger: Recover after an invalid protocol frame
    Precondition: The stdio adapter receives an invalid protocol frame.
    Success: The client receives bounded recovery behavior and the adapter does not silently corrupt the stream.
    Covers: FR-20
    Step: request | Emit one typed error, preserve process liveness where the contract permits, and accept the next valid request without spawning a second server.
    Context:
      **Actor:** MCP client.

      **Precondition:** The stdio adapter receives an invalid protocol frame.

      **Flow:** Emit one typed error, preserve process liveness where the contract permits, and accept the next valid request without spawning a second server.

      **Postcondition:** The client receives bounded recovery behavior and the adapter does not silently corrupt the stream.

      **Related:** FR-20, AC-20.1

    @feature20 @FR-20 @AC-20.1 @id:SCEN-mri-terminal-json-rpc @release-evidence
    Scenario: Invalid JSON-RPC requests have one terminal response
      Given an installed MCP server is running
      When the client sends JSON-RPC 1.0 with id 7 and then a valid request
      Then the first response is -32600 for id 7
      And the valid request returns one canonical envelope with no extra stdout frames
      When the client sends an unknown method with id 8 and an unknown tool with id 9
      Then the responses are -32601 for id 8 and -32602 for id 9

    @feature20 @FR-20 @AC-20.1 @id:SCEN-mri-malformed-json-recovery
    Scenario: Malformed JSON has one parse error and recovery
      Given an installed MCP server is running
      When the client sends malformed JSON and then a valid request
      Then the first response is -32700 with null id
      And the valid request returns one canonical envelope with no extra stdout frames

  @case:UC-13 @story:US-2
  Rule: Exercise the historical v0.3.2 surface
    Actor: Release verifier.
    Boundary: Installed plugin and release workflow
    Trigger: Exercise the historical v0.3.2 surface
    Precondition: The immutable v0.3.2 candidate is installed.
    Success: The historical surface remains readable as historical evidence without being promoted to a current release claim.
    Covers: FR-21
    Step: request | Enumerate the declared eight read-only handlers, invoke them through the installed adapter, and observe that no repository writes occur.
    Context:
      **Actor:** Release verifier.

      **Precondition:** The immutable v0.3.2 candidate is installed.

      **Flow:** Enumerate the declared eight read-only handlers, invoke them through the installed adapter, and observe that no repository writes occur.

      **Postcondition:** The historical surface remains readable as historical evidence without being promoted to a current release claim.

      **Related:** FR-21, AC-21.1

    @feature21 @FR-21 @AC-21.1 @id:SCEN-mri-all-tool-parity @release-evidence
    Scenario: Every historical packaged MCP handler executes
      Given a copied package has no source checkout or ambient dependencies
      When every SCHEMA-11 tool is called with its valid arguments
      Then each structured result equals the direct service envelope
      And the served corpus is byte-for-byte unchanged

  @case:UC-14 @story:US-4
  Rule: Run a future candidate journey
    Actor: Release verifier.
    Boundary: Installed plugin and release workflow
    Trigger: Run a future candidate journey
    Precondition: A future candidate has an immutable tag, build, installation, and lifecycle profile.
    Success: Candidate evidence is observed end to end without treating a plan or static text as execution proof.
    Covers: FR-22
    Step: request | Run the unfiltered candidate journey and record installed invocation, lifecycle, and public-safety observations.
    Context:
      **Actor:** Release verifier.

      **Precondition:** A future candidate has an immutable tag, build, installation, and lifecycle profile.

      **Flow:** Run the unfiltered candidate journey and record installed invocation, lifecycle, and public-safety observations.

      **Postcondition:** Candidate evidence is observed end to end without treating a plan or static text as execution proof.

      **Related:** FR-22, AC-22.1

    @feature22 @FR-22 @AC-22.1 @id:SCEN-mri-public-eligibility-separation @release-evidence
    Scenario: Meta-only producer output cannot become trusted evidence
      Given a v0.4.1 candidate and complete evidence record
      When the current candidate message artifact contains only meta
      Then the current candidate is refused for nonsemantic Cucumber evidence

  @case:UC-15 @story:US-4
  Rule: Publish the verified archive
    Actor: Release owner.
    Boundary: Installed plugin and release workflow
    Trigger: Publish the verified archive
    Precondition: The contained candidate archive has passed its named checks.
    Success: No rebuild or replacement asset can enter the published release.
    Covers: FR-23
    Step: request | Reconcile the package-tree digest, archive digest, public asset, and final attestation subject, then publish only the same bytes.
    Context:
      **Actor:** Release owner.

      **Precondition:** The contained candidate archive has passed its named checks.

      **Flow:** Reconcile the package-tree digest, archive digest, public asset, and final attestation subject, then publish only the same bytes.

      **Postcondition:** No rebuild or replacement asset can enter the published release.

      **Related:** FR-23, AC-23.1

    @feature23 @FR-23 @AC-23.1 @id:SCEN-mri-executable-launcher-archive
    Scenario: Candidate archive preserves the executable launcher
      Given a v0.3.2 candidate and complete evidence record
      When the candidate archive is extracted into a clean project
      Then the extracted launcher is executable and serves the active project

    @feature23 @FR-23 @AC-23.1 @id:SCEN-mri-symlinked-evidence-refusal
    Scenario Outline: Linked evidence parents cannot escape containment
      Given a v0.3.2 candidate and complete evidence record
      When the evidence "<directory>" directory has a symlinked parent
      Then the release evaluator reports "EVIDENCE_SYMLINK_COMPONENT" before reading evidence bytes

      Examples:
        | example_id | directory |
        | row-1 | receipts  |
        | row-2 | messages  |

    @feature23 @FR-23 @AC-23.1 @id:SCEN-mri-artifact-mismatch-refusal @release-evidence
    Scenario: Publication refuses different archive bytes
      Given the bounded v0.3.2 predecessor release status record
      When the predecessor publication identities are reconciled
      Then the predecessor record contains one exact published archive identity
      Given a v0.4.1 candidate without live distribution provenance
      When current publish verification sees a different archive identity
      Then current publication is refused before release mutation

    @feature23 @FR-23 @AC-23.1 @id:SCEN-mri-cross-platform-archive-modes
    Scenario: Canonicalize archive modes across platforms
      Given source files have arbitrary platform-specific modes
      When a candidate is assembled
      Then every file under bin/ has mode 0755 independent of its source mode
      And every other file has mode 0644 independent of its source mode
      And the package digest and tar headers encode those canonical modes

  @case:UC-16 @story:US-5
  Rule: Read immutable v0.3.2 evidence
    Actor: Maintainer.
    Boundary: Installed plugin and release workflow
    Trigger: Read immutable v0.3.2 evidence
    Precondition: Historical v0.3.2 status and validation records are available.
    Success: Public history remains honest and historical proof is not used as current execution evidence.
    Covers: FR-24
    Step: request | Read the immutable records, distinguish historical evidence from current status, and retain public guidance without rewriting the past.
    Context:
      **Actor:** Maintainer.

      **Precondition:** Historical v0.3.2 status and validation records are available.

      **Flow:** Read the immutable records, distinguish historical evidence from current status, and retain public guidance without rewriting the past.

      **Postcondition:** Public history remains honest and historical proof is not used as current execution evidence.

      **Related:** FR-24, AC-24.1

    @feature24 @FR-24 @AC-24.1 @id:SCEN-mri-public-communication-proof @release-evidence
    Scenario: Public communication reflects immutable v0.3.2 evidence
      Given the bounded v0.3.2 predecessor release status record
      When the predecessor publication identities are reconciled
      Then the predecessor record proves a trusted public release for its exact candidate
      And predecessor public guidance retains the v0.3.0 advisory

  @case:UC-17 @story:US-2
  Rule: Distinguish the active and overridden project
    Actor: Plugin consumer.
    Boundary: Installed plugin and release workflow
    Trigger: Distinguish the active and overridden project
    Precondition: An active project and a project-root override are both supplied.
    Success: Response source identity and root consistency are explicit and deterministic.
    Covers: FR-25
    Step: request | Resolve both roots canonically, compare their opaque identities, and report the selected source without exposing absolute paths.
    Context:
      **Actor:** Plugin consumer.

      **Precondition:** An active project and a project-root override are both supplied.

      **Flow:** Resolve both roots canonically, compare their opaque identities, and report the selected source without exposing absolute paths.

      **Postcondition:** Response source identity and root consistency are explicit and deterministic.

      **Related:** FR-25, AC-25.1

    @feature25 @FR-25 @AC-25.1 @id:SCEN-mri-response-provenance
    Scenario: Every installed MCP result identifies its server and root
      Given project-a, project-b, and package-decoy have distinct specifications
      When the installed package launcher probes every MCP tool for project-a without an override
      Then every installed result identifies the active project root and server
      When the installed package launcher probes every MCP tool with project-b as an explicit override
      Then every installed result identifies project-b as an explicit root and marks the active-project mismatch

    @feature25 @FR-25 @AC-25.1 @id:SCEN-mri-extension-root-consistency
    Scenario: OMP extension inventory and query tools share one root
      Given project-a, project-b, and package-decoy have distinct specifications
      When the OMP extension runs with project-a as cwd and project-b as an explicit root override
      Then its inventory and query results identify the same project-b root and server

  @case:UC-18 @story:US-2
  Rule: Discover consolidated 10-tool surface
    Actor: Plugin user / MCP client
    Boundary: Installed plugin and release workflow
    Trigger: tools/list requested
    Precondition: Server initialized
    Success: Exactly 10 consolidated tools are returned with valid schemas and annotations.
    Covers: FR-26
    Step: request | - **Actor:** Plugin user / MCP client
    Context:
      - **Actor:** Plugin user / MCP client
      - **Preconditions:** Server initialized
      - **Trigger:** tools/list requested
      - **Main Success Scenario:** Exactly 10 consolidated tools are returned with valid schemas and annotations.
      - **Postconditions:** Client invokes consolidated operations via discriminated variants.

    @feature26 @FR-26 @AC-26.1 @id:SCEN-mri-consolidated-10-tools
    Scenario: Consolidated 10-tool surface is discovered and verified
      Given a real packaged MCP server
      When tools are listed
      Then exactly 10 tools are present in contract order
      And 10 tools are annotated read-only and 1 mutating
      And no retired tool names are exposed
