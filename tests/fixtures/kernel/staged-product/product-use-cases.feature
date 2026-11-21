Feature: Product lifecycle use cases

  @case:UC-1 @story:US-2
  Rule: Freeze the upstream source
    Actor: provenance reviewer
    Boundary: Product publication and status
    Trigger: Freeze the upstream source
    Precondition: an immutable upstream commit is selected; no target publication has occurred.
    Success: The freeze is eligible only if the copied bytes match the manifest.
    Covers: FR-2
    Step: step-1 | Read only Git-object bytes from the selected commit and allowlisted subtree.
    Step: step-2 | Record repository URL, commit, source path, target path, SHA-256, disposition, import status, and license status for every inventoried path.
    Step: step-3 | Copy approved reference bytes under `docs/upstream/` without editing them.
    Step: step-4 | Compare copied bytes to the manifest.
    Step: step-5 | Mark source-freeze evidence eligible only if every inventory row is accounted for and every copied hash matches.
    Context:
      **Primary actor:** provenance reviewer

      **Preconditions:** an immutable upstream commit is selected; no target publication has occurred.

      **Main flow:**

      1. Read only Git-object bytes from the selected commit and allowlisted subtree.
      2. Record repository URL, commit, source path, target path, SHA-256, disposition, import status, and license status for every inventoried path.
      3. Copy approved reference bytes under `docs/upstream/` without editing them.
      4. Compare copied bytes to the manifest.
      5. Mark source-freeze evidence eligible only if every inventory row is accounted for and every copied hash matches.

      **Alternatives:** a missing path, dirty-worktree read, unrecorded file, or hash mismatch makes the freeze ineligible and stops publication.

      **Trace:** `product:FR-2`, `product:AC-2.1`, `product:AC-2.2`, `@feature2`.

    @feature2 @FR-2 @AC-2.2 @id:SCEN-mismatched-imported-byte
    Scenario: A mismatched imported byte blocks publication
      Given an imported target differs from its recorded source-object bytes
      When source-freeze eligibility is evaluated
      Then source-freeze eligibility fails
      And the mismatched path is reported
      And publication remains blocked

  @case:UC-2 @story:US-3
  Rule: Decide redistribution eligibility
    Actor: legal reviewer
    Boundary: Product publication and status
    Trigger: Decide redistribution eligibility
    Precondition: source-freeze evidence exists.
    Success: Publication is permitted for imports with an accepted redistribution basis.
    Covers: FR-3
    Step: step-1 | Review the upstream license evidence and each imported row's status.
    Step: step-2 | Record the decision and its evidence without changing the imported bytes.
    Step: step-3 | Permit publication only when every copied item has an accepted redistribution basis.
    Context:
      **Primary actor:** legal reviewer

      **Preconditions:** source-freeze evidence exists.

      **Main flow:**

      1. Review the upstream license evidence and each imported row's status.
      2. Record the decision and its evidence without changing the imported bytes.
      3. Permit publication only when every copied item has an accepted redistribution basis.

      **Hypothetical alternative:** a future or changed import lacks sufficient evidence; status stays `NOT_READY_FOR_PUBLICATION`, and removal/replacement of the affected bytes remains an acceptable remediation.

      **Trace:** `product:FR-3`, `product:AC-3.1`, `product:AC-3.2`, `@feature3`.

    @feature3 @FR-3 @AC-3.2 @id:SCEN-root-license-import-separation
    Scenario: New material license cannot relabel an import
      Given the repository has a root MIT license for repository-owned material
      And a hypothetical future or changed imported item has an unresolved upstream license status
      When the imported item's license status is evaluated
      Then the imported status remains unresolved
      And the root license is not used as redistribution evidence for that item

  @case:UC-3 @story:US-4
  Rule: Produce a clean public export
    Actor: security reviewer
    Boundary: Product publication and status
    Trigger: Produce a clean public export
    Precondition: an allowlist and prohibited-path policy exist.
    Success: The candidate is eligible when every file passes the allowlist and review.
    Covers: FR-4
    Step: step-1 | Build the candidate tree only from approved repository-owned files and manifest-approved imported bytes.
    Step: step-2 | Reject credentials, `.env` material, logs, caches, user state, mutable test evidence, inherited Git history, and unapproved binary/generated assets.
    Step: step-3 | Run the configured secret scan over the complete candidate history/tree.
    Step: step-4 | Record zero unresolved findings and public-diff review.
    Context:
      **Primary actor:** security reviewer

      **Preconditions:** an allowlist and prohibited-path policy exist.

      **Main flow:**

      1. Build the candidate tree only from approved repository-owned files and manifest-approved imported bytes.
      2. Reject credentials, `.env` material, logs, caches, user state, mutable test evidence, inherited Git history, and unapproved binary/generated assets.
      3. Run the configured secret scan over the complete candidate history/tree.
      4. Record zero unresolved findings and public-diff review.

      **Alternatives:** any unknown path or unresolved scan finding blocks publication; a scanner exception requires a recorded reviewer decision tied to the exact finding and bytes.

      **Trace:** `product:FR-4`, `product:AC-4.1`, `product:AC-4.2`, `@feature4`.

    @feature4 @FR-4 @AC-4.2 @id:SCEN-unresolved-secret-finding
    Scenario: An unresolved secret finding blocks publication
      Given the complete candidate scan contains an unresolved secret finding
      And no complete reviewer exception covers the exact finding and revision
      When remote publication eligibility is evaluated
      Then remote creation and push remain blocked
      And the finding is named as a blocker

  @case:UC-4 @story:US-1
  Rule: Publish specification-first init
    Actor: product manager
    Boundary: Product publication and status
    Trigger: Publish specification-first init
    Precondition: source freeze, redistribution rights, clean export, specification review, and public documentation gates are eligible.
    Success: The specification-first candidate is public only after its gates pass.
    Covers: FR-1
    Step: step-1 | Confirm the repository contains product specifications and policies but no marketplace catalog or plugin payload.
    Step: step-2 | Confirm the README says no plugin is installable.
    Step: step-3 | Confirm the roadmap separates delivered, planned, and deferred stages.
    Step: step-4 | Publish from fresh history only after all blockers are zero.
    Context:
      **Primary actor:** product manager

      **Preconditions:** source freeze, redistribution rights, clean export, specification review, and public documentation gates are eligible.

      **Main flow:**

      1. Confirm the repository contains product specifications and policies but no marketplace catalog or plugin payload.
      2. Confirm the README says no plugin is installable.
      3. Confirm the roadmap separates delivered, planned, and deferred stages.
      4. Publish from fresh history only after all blockers are zero.

      **Alternative:** any blocker keeps the repository local/non-public and status fail-closed.

      **Trace:** `product:FR-1`, `product:FR-8`, `product:AC-1.1`, `product:AC-8.1`, `@feature1`, `@feature8`.

    @feature1 @FR-1 @AC-1.2 @id:SCEN-premature-installable-artifact
    Scenario: Premature installable artifact blocks public init
      Given the candidate is in the public-init stage
      And the candidate contains a marketplace catalog
      When public-init eligibility is evaluated
      Then the result is "BLOCKED"
      And the premature marketplace artifact is identified

  @case:UC-5 @story:US-6
  Rule: Advance one product through releases
    Actor: release owner
    Boundary: Product publication and status
    Trigger: Advance one product through releases
    Precondition: the exact product revision, current candidate artifact SHA-256, and artifact lineage to be evaluated are identified; each evidence reference declares a typed current-candidate or v0.2-predecessor binding; a preceding-stage label or historical proof is not itself gate evidence.
    Success: Delivered status is published only when cumulative requirement evidence is complete.
    Covers: FR-6
    Step: step-1 | Derive the proposed stage's complete cumulative canonical cross-spec gate set; do not caller-select a subset.
    Step: step-2 | Require `plugin-distribution:FR-1` separately for the one marketplace/plugin/extension identity invariant.
    Step: step-3 | Require accepted `plugin-distribution:FR-13` bound to the current candidate before claiming v0.1.0.
    Step: step-4 | Require accepted current-candidate `plugin-distribution:FR-13` plus accepted current-candidate `spec-kernel:FR-14` with `targetStage: "v0.2"` before claiming v0.2 graph/query capability.
    Step: step-5 | For v0.3, require accepted current-candidate distribution and accepted current-candidate `spec-kernel:FR-14` with `targetStage: "v0.3"`. Separately identify the required accepted `targetStage: "v0.2"` result as the predecessor; permit its artifact SHA-256 to differ only when the v0.3 result's `v02ParentArtifactSha256` equals it, both kernel results share the status product revision and lineage, their stage/profile pair is ordered v0.2 before v0.3, and neither is stale or revoked.
    Step: step-6 | For authoring/mutation, require current-candidate distribution, current-candidate v0.3 kernel, and current-candidate `spec-authoring-workflow:FR-13`, plus the same linked, accepted v0.2 predecessor. Do not collapse the two kernel target-stage results into one unqualified reference.
    Step: step-7 | Confirm every cumulative aggregate accepted its complete mandatory member/dependency set. Only then publish `DELIVERED`.
    Context:
      **Primary actor:** release owner

      **Preconditions:** the exact product revision, current candidate artifact SHA-256, and artifact lineage to be evaluated are identified; each evidence reference declares a typed current-candidate or v0.2-predecessor binding; a preceding-stage label or historical proof is not itself gate evidence.

      **Main flow:**

      1. Derive the proposed stage's complete cumulative canonical cross-spec gate set; do not caller-select a subset.
      2. Require `plugin-distribution:FR-1` separately for the one marketplace/plugin/extension identity invariant.
      3. Require accepted `plugin-distribution:FR-13` bound to the current candidate before claiming v0.1.0.
      4. Require accepted current-candidate `plugin-distribution:FR-13` plus accepted current-candidate `spec-kernel:FR-14` with `targetStage: "v0.2"` before claiming v0.2 graph/query capability.
      5. For v0.3, require accepted current-candidate distribution and accepted current-candidate `spec-kernel:FR-14` with `targetStage: "v0.3"`. Separately identify the required accepted `targetStage: "v0.2"` result as the predecessor; permit its artifact SHA-256 to differ only when the v0.3 result's `v02ParentArtifactSha256` equals it, both kernel results share the status product revision and lineage, their stage/profile pair is ordered v0.2 before v0.3, and neither is stale or revoked.
      6. For authoring/mutation, require current-candidate distribution, current-candidate v0.3 kernel, and current-candidate `spec-authoring-workflow:FR-13`, plus the same linked, accepted v0.2 predecessor. Do not collapse the two kernel target-stage results into one unqualified reference.
      7. Confirm every cumulative aggregate accepted its complete mandatory member/dependency set. Only then publish `DELIVERED`.

      **Alternatives:** any missing or member-subset aggregate, current distribution/current-stage/current-authoring result bound away from the current candidate, historical or different-lineage v0.2 result, missing or mismatched `v02ParentArtifactSha256`, reversed/duplicate/wrong target-stage pair, or stale/revoked result retains the last proven stage. A second product/control plane fails the identity gate.

      **Trace:** `product:FR-5`, `product:FR-6`, `product:AC-5.1`, `product:AC-6.1`, `@feature5`, `@feature6`.

    @feature6 @FR-6 @AC-6.2 @id:SCEN-owning-aggregate-cannot-be-bypassed
    Scenario Outline: A later stage cannot bypass its cumulative aggregate gate set
      Given the <stage> stage is proposed for product revision R, current candidate artifact B, and artifact lineage L
      And <aggregate_state>
      And <artifact_binding>
      When ordered stage gates are evaluated
      Then the <stage> delivered claim is <decision>
      And <reason>

      Examples:
        | example_id | stage     | aggregate_state                                                                                         | artifact_binding                                                                                                                                | decision | reason                                                  |
        | row-1 | v0.2      | every mandatory distribution and targetStage v0.2 aggregate is accepted                               | distribution and v0.2 kernel evidence both use CURRENT_CANDIDATE artifact B and lineage L                                                       | accepted | the complete all-not-any v0.2 gate set is satisfied       |
        | row-2 | v0.2      | targetStage v0.2 is accepted but plugin-distribution:FR-13 is missing                                  | the v0.2 kernel evidence uses CURRENT_CANDIDATE artifact B and lineage L                                                                         | refused  | plugin-distribution:FR-13 is a cumulative blocker          |
        | row-3 | v0.3      | distribution plus separate targetStage v0.2 and targetStage v0.3 results are complete and accepted    | distribution and v0.3 use CURRENT_CANDIDATE B; v0.2 uses PREDECESSOR_V0_2 A; v0.3 names parent A; both kernel results use revision R and lineage L | accepted | the distinct-artifact A-to-B parent chain is valid         |
        | row-4 | v0.3      | the complete cumulative aggregate set is accepted                                                     | v0.2 uses predecessor A but v0.3 names parent C                                                                                                  | refused  | the exact parent artifact SHA-256 does not match           |
        | row-5 | v0.3      | the complete cumulative aggregate set is accepted                                                     | v0.2 uses predecessor A in lineage X while the current v0.3 candidate uses lineage L                                                             | refused  | predecessor evidence belongs to another lineage            |
        | row-6 | v0.3      | the complete cumulative aggregate set is otherwise accepted                                           | v0.2 predecessor A is stale or revoked                                                                                                           | refused  | predecessor evidence is not active                         |
        | row-7 | v0.3      | the complete cumulative aggregate set is accepted                                                     | distribution or targetStage v0.3 evidence binds to predecessor A instead of current candidate B                                                  | refused  | current evidence does not bind to the current candidate    |
        | row-8 | authoring | distribution, both kernel target stages, and spec-authoring-workflow:FR-13 are complete and accepted | distribution, v0.3, and authoring use CURRENT_CANDIDATE B; linked active v0.2 predecessor A uses revision R and lineage L                        | accepted | every cumulative gate and artifact-binding rule is satisfied |
        | row-9 | authoring | distribution and spec-authoring-workflow:FR-13 are accepted but either kernel target result is absent | current evidence uses candidate B and lineage L                                                                                                  | refused  | the missing kernel target result is a cumulative blocker   |

  @case:UC-6 @story:US-6
  Rule: Report honest status
    Actor: public reader
    Boundary: Product publication and status
    Trigger: Report honest status
    Precondition: stage definitions and evidence records exist.
    Success: The reader can tell which stage is supported by current evidence.
    Covers: FR-7
    Step: step-1 | Read the current status, evidence timestamp/source, blockers, and next gate.
    Step: step-2 | Distinguish `DELIVERED`, `PLANNED`, `DEFERRED`, and `BLOCKED` claims.
    Step: step-3 | Treat specification text, imported scenarios, structural validity, and roadmap entries as intent—not executed proof.
    Step: step-4 | Present the most conservative status when required evidence is missing, stale, revoked, contradictory, parent-mismatched, or failed.
    Context:
      **Primary actor:** public reader

      **Preconditions:** stage definitions and evidence records exist.

      **Main flow:**

      1. Read the current status, evidence timestamp/source, blockers, and next gate.
      2. Distinguish `DELIVERED`, `PLANNED`, `DEFERRED`, and `BLOCKED` claims.
      3. Treat specification text, imported scenarios, structural validity, and roadmap entries as intent—not executed proof.
      4. Present the most conservative status when required evidence is missing, stale, revoked, contradictory, parent-mismatched, or failed.

      **Trace:** `product:FR-7`, `product:AC-7.1`, `product:AC-7.2`, `@feature7`.

    @feature7 @FR-7 @AC-7.1 @id:SCEN-status-fails-closed
    Scenario: Status fails closed when evidence is missing
      Given a non-public-init capability claim lacks one accepted aggregate from its cumulative gate set for the candidate artifact lineage
      When public status is rendered
      Then the capability state is not "DELIVERED"
      And the status includes every missing cumulative aggregate blocker and next gate

    @feature7 @FR-7 @AC-7.2 @id:SCEN-unexecuted-bdd-not-evidence
    Scenario: Unexecuted BDD cannot produce a delivered claim
      Given a Gherkin scenario exists for a product requirement
      And no executed result is tied to the same requirement and revision
      When evidence-derived status is calculated
      Then the scenario is labeled specification text only
      And it contributes no passing or delivered evidence
