Feature: Product lifecycle user stories

  @story:US-1
  Rule: Product manager: promises before code
    Actor: product manager
    Goal: the public repository to start from reviewed specifications and an explicit non-installable status
    Benefit: early readers do not mistake plans or imported scenarios for delivered software.
    Covers: FR-1
    Context:
      **Priority:** Must



      **Why:** A public name, README, or scenario can otherwise become an accidental product promise.

      **Independent test:** Inspect the public-init tree and status summary without relying on runtime files.

      **Acceptance scenarios:** `@feature1`, `@feature7`.

    @feature1 @FR-1 @AC-1.1 @id:SCEN-specification-only-init @spec-ready
    Scenario: Specification-only init reports no installable plugin
      Given the candidate is in the public-init stage
      And no marketplace catalog, plugin package, release, or runtime evidence exists
      When a reader opens the product status
      Then the state is "SPEC_ONLY"
      And the status says there is no installable plugin
      And no install command is presented as usable

  @story:US-2
  Rule: Provenance reviewer: reproducible source freeze
    Actor: provenance reviewer
    Goal: every imported byte tied to one immutable commit, path, hash, and disposition
    Benefit: the clean export can be reproduced without reading a dirty working tree.
    Covers: FR-2
    Context:
      **Priority:** Must



      **Why:** The source repository had concurrent local changes and state-like files that are unsafe to inherit.

      **Independent test:** Reconstruct the allowlisted export from the recorded Git object and compare hashes.

      **Acceptance scenarios:** `@feature2`.

    @feature2 @FR-2 @AC-2.1 @id:SCEN-pinned-source-export
    Scenario: Pinned source export is reproducible
      Given the source repository and immutable commit are recorded
      And every inventoried source path has a hash, disposition, import status, and license status
      When the approved export is reconstructed from Git-object bytes
      Then every copied target matches its recorded SHA-256
      And every excluded path remains absent from the snapshot

  @story:US-3
  Rule: Legal reviewer: redistribution gate
    Actor: legal reviewer
    Goal: ambiguous imported-material rights to block publication
    Benefit: a new root license does not silently relabel upstream content.
    Covers: FR-3
    Context:
      **Priority:** Must



      **Why:** The pinned source lacked a root license file at the frozen commit; a later source-owner attestation now covers those exact bytes, while the gate must still reject hypothetical future or changed imports with insufficient evidence.

      **Independent test:** Evaluate the current MIT-attested manifest and a bounded hypothetical manifest with unresolved redistribution evidence.

      **Acceptance scenarios:** `@feature3`.

    @feature3 @FR-3 @AC-3.1 @id:SCEN-unresolved-import-license
    Scenario: Unresolved imported license status blocks publication
      Given a hypothetical future or changed copied item has an unresolved redistribution basis
      When publication eligibility is evaluated
      Then the state is "NOT_READY_FOR_PUBLICATION"
      And the affected imported item is identified
      And the remediation includes authorization or removal or replacement

  @story:US-4
  Rule: Security reviewer: clean public tree
    Actor: security reviewer
    Goal: an allowlisted export and a zero-finding secret/state scan
    Benefit: credentials, local state, logs, caches, and mutable evidence cannot enter public history.
    Covers: FR-4
    Context:
      **Priority:** Must



      **Why:** Public history is durable and deleting a later commit does not reliably erase disclosure.

      **Independent test:** Plant a prohibited file or scanner finding and observe fail-closed publication eligibility.

      **Acceptance scenarios:** `@feature4`.

    @feature4 @FR-4 @AC-4.1 @id:SCEN-prohibited-state-path
    Scenario: A prohibited state path blocks the clean export
      Given the candidate public tree contains user-local runtime state
      When the public-tree allowlist is evaluated
      Then public eligibility fails
      And the prohibited path and class are reported

  @story:US-5
  Rule: OMP user: one recognizable product
    Actor: OMP user
    Goal: one product and one future installed identity
    Benefit: I never have to choose among competing marketplace entries, plugin packages, or extension control planes.
    Covers: FR-5
    Context:
      **Priority:** Must



      **Why:** Product evolution should add capabilities without splitting identity.

      **Independent test:** Compare repository identity and future distribution evidence against the single-product invariant.

      **Acceptance scenarios:** `@feature5`.

    @feature5 @FR-5 @AC-5.1 @id:SCEN-single-product-identity
    Scenario: Future distribution preserves one product identity
      Given an installable distribution candidate exists
      When its product cardinality is evaluated by plugin-distribution:FR-1
      Then the product name is "omp-spec-kit"
      And the installed identity is "omp-spec-kit@omp-spec-kit"
      And exactly one marketplace entry exists
      And exactly one plugin package exists
      And exactly one extension entry exists

  @story:US-6
  Rule: Release owner: evidence-gated roadmap
    Actor: release owner
    Goal: stage claims derived from current exit evidence
    Benefit: public init, v0.1.0, kernel, MCP, and authoring stages cannot be skipped or conflated.
    Covers: FR-6
    Context:
      **Priority:** Must



      **Why:** A release tag, completed document, or green subset of an owning specification is not proof that the complete stage contract is eligible.

      **Independent test:** Withhold one mandatory result from any aggregate in the proposed stage's complete cumulative gate set and confirm that the roadmap/status remains at the last proven stage and cannot become `DELIVERED`.

      **Acceptance scenarios:** `@feature6`, `@feature7`.

    @feature6 @FR-6 @AC-6.1 @id:SCEN-incomplete-aggregate-remains-planned
    Scenario: A stage with missing evidence remains planned
      Given the proposed v0.1.0 stage has evidence for only some mandatory distribution requirements
      And plugin-distribution:FR-13 has not accepted complete mandatory evidence for plugin-distribution:FR-1 through plugin-distribution:FR-12
      When the product stage is evaluated
      Then v0.1.0 remains "PLANNED" or "BLOCKED"
      And the last proven stage remains authoritative
      And plugin-distribution:FR-13 is the next gate

  @story:US-7
  Rule: Contributor: clear boundary and next work
    Actor: contributor
    Goal: a manager-readable roadmap with owned cross-spec boundaries
    Benefit: I can work on the next gate without copying plugin, kernel, or authoring internals into the product spec.
    Covers: FR-8
    Context:
      **Priority:** Should



      **Why:** Non-overlapping specifications reduce contradiction and scope creep.

      **Independent test:** Follow every stage link to its canonical requirement owner and identify what remains non-public.

      **Acceptance scenarios:** `@feature8`.

    @feature8 @FR-8 @AC-8.1 @id:SCEN-roadmap-separates-states
    Scenario: Roadmap separates delivered planned deferred and blocked
      Given the public-init candidate has resolved license evidence, completed validation gates, and later planned stages
      When a manager reads the README and roadmap
      Then current, planned, deferred, and blocked states are visibly distinct
      And the validated non-public state and remaining publication action are stated explicitly
      And excluded harness machinery is not presented as delivered

  @contract
  Rule: Independent product constraints

    @feature5 @FR-5 @AC-5.2 @id:SCEN-second-control-plane-refusal
    Scenario: A second product control plane is refused
      Given one omp-spec-kit plugin and extension already own the product runtime
      And a later stage introduces a second extension control plane
      When product identity continuity is evaluated
      Then the stage gate fails
      And the competing control plane is identified

    @feature8 @FR-8 @AC-8.2 @id:SCEN-canonical-owner-delegation
    Scenario: Product spec delegates internals to canonical owners
      Given the product documents refer to distribution, kernel, and authoring behavior
      When their boundary references are inspected
      Then distribution uses canonical plugin-distribution requirement IDs
      And kernel uses canonical spec-kernel requirement IDs
      And authoring uses canonical spec-authoring-workflow requirement IDs
      And product documents do not redefine their internal contracts
