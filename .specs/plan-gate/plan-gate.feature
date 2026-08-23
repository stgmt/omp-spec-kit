@plan-gate @authoring-gated
Feature: Native OMP plan approval content gate
  The gate intercepts plan approval at the model-issued write to xd://propose,
  validates plan content deterministically, and blocks with actionable reasons.
  Every internal fault allows. These scenarios specify required behavior and
  have no executed status here.

  @feature1 @AC-1.1 @id:SCEN-approval-interception-and-plan-resolution
  Scenario: Approval interception and deterministic plan resolution
    Given plan mode is active and a session-local plan directory exists
    And the model issues a write whose target is an xd URL of kind propose carrying a plan title
    When the gate observes the tool_call event stream
    Then exactly the model-issued propose write matches and the plan file resolves from the session-local directory by normalized slug
    And nested device dispatches other tools and other xd targets do not match
    And an absent unreadable or over-budget resolved plan takes the allow path without location guessing

  @feature2 @AC-2.1 @id:SCEN-every-gate-fault-allows
  Scenario: Every gate fault path allows
    Given a matched propose event and a fault planted one at a time among handler exception absent plan file over-budget bytes malformed prompt cache subsystem failure missing template and deadline expiry
    When the gate handler executes
    Then no blocking result is returned and the approval flow continues
    And one bounded diagnostic record with closed code and no absolute path is appended
    And blocking is observed only after a complete successful validation returning blocking errors

  @feature3 @AC-3.1 @id:SCEN-plan-mode-contract-injection
  Scenario: Plan-mode contract injection is scoped and bounded
    Given plan mode is active and the context event supplies a deep copy of outgoing messages
    When the injection handler runs for each LLM call
    Then at most one injection message of at most two kilobytes is appended containing skeleton names in order the spec-reference obligation and the template pointer
    And session-stored messages and repository bytes are unchanged
    And outside plan mode or on a second injection within one event nothing is injected

  @feature4 @AC-4.1 @id:SCEN-skeleton-structure-validation-blocks
  Scenario: Mandatory skeleton failures block with line hints
    Given plan fixtures each missing one of the ten mandatory sections or violating order human-summary inventory subsections requirements subsections todos format verification commands file-change path action reason or impact-analysis obligations
    When the pure validator runs over each fixture
    Then each violation yields exactly one bounded error with one-based line closed message and remediation hint
    And the run blocks with every planted violation named and a structurally complete fixture passes every structure phase

  @feature5 @AC-5.1 @id:SCEN-duplicate-plan-blocked
  Scenario: Duplicate plans are detected by content hash
    Given the session directory contains an existing plan file
    And a submitted plan has identical bytes and a sibling candidate differs in size by more than ten bytes
    When duplicate detection runs before structure validation
    Then the identical plan blocks naming the duplicate by session-relative name and the size-differing sibling is never read
    And an unreadable sibling is skipped and resubmission after the original removal does not block

  @feature6 @AC-6.1 @id:SCEN-grounding-blocks-and-cache-degrades-open
  Scenario: Grounding is deterministic and an empty cache degrades open
    Given a prompt cache with ten entries and a plan authored for a different recorded task
    When the relevance score is computed against the selected window
    Then a score at or below the deny threshold blocks with the prompt window excerpt embedded in the reason
    And repeated runs over the same plan and cache produce identical scores and decisions
    And an empty absent or malformed cache skips grounding without blocking

  @feature7 @AC-7.1 @id:SCEN-file-change-cross-reference-blocks
  Scenario: File changes must be discussed in the plan body
    Given a plan whose file changes table lists paths with more than half unmentioned outside that table
    When cross-reference validation runs
    Then the run blocks naming up to five unmentioned paths with separator-normalized case-sensitive matching
    And a plan at or below the half-unmentioned threshold passes this phase

  @feature8 @AC-8.1 @id:SCEN-extracted-requirements-enforced
  Scenario: Extracted requirements are mandatory in Context
    Given plans whose Context section has no Extracted Requirements block one numbered item or two numbered items
    When phase two validation runs
    Then the absent and one-item variants block with the prompt excerpt embedded and the two-item variant passes the phase

  @feature9 @AC-9.1 @id:SCEN-spec-references-enforced-against-disk
  Scenario: Spec-touching plans require existing qualified references
    Given a project root containing specs with canonical FR and AC headings
    And plan file changes touch a specs document or a guarded path
    When spec-reference enforcement runs
    Then a plan citing an existing qualified slug and ID passes and a plan with a fabricated slug a fabricated ID or no reference blocks
    And slug and ID existence are verified against disk bytes with symlink and traversal attempts refused
    And a plan touching no spec or guarded path skips the phase entirely

  @feature10 @AC-10.1 @id:SCEN-deny-format-is-actionable
  Scenario: Deny reason is actionable and bounded
    Given a plan with two planted blocking errors in different phases and a cache with five prompts
    When validation blocks
    Then the reason contains one line-N entry with hint per error then the template excerpt within eight kilobytes then the five prompt excerpts within sixteen kilobytes total
    And truncation preserves complete error entries first and marks itself explicitly
    And advisory findings appear only in diagnostic state and never in the blocking decision

  @feature11 @AC-11.1 @id:SCEN-self-contained-gate-artifact
  Scenario: Installed gate executes dependency-absent
    Given the exact candidate artifact is installed outside the source checkout with root and external module trees unavailable
    When a simulated propose event drives the complete pipeline
    Then validation runs to a decision using only bundled code and resources with zero daemon network subprocess and credential activity
    And bundled template and section-model resources match their shipped hash inventory

  @feature12 @AC-12.1 @id:SCEN-plan-gate-real-fixture-provenance
  Scenario: Real fixture bytes reconcile with ground truth
    Given a gate-owned fixture manifest records capture producer source date hash size license trimming and expected blocking errors per phase with lines and codes
    When fixture bytes are verified and validated
    Then hashes and sizes match and observed errors reconcile with reviewed ground truth
    And synthetic-labeled fixtures do not satisfy the real-fixture obligation

  @feature13 @AC-13.1 @id:SCEN-plan-gate-release-conjunction-fails-closed
  Scenario: Release eligibility is a closed conjunction
    Given a candidate manifest declaring a known stage and profile pair with one passing hash-bound record per mandatory check FR-1 through FR-12 including live ABI probe dependency-absent budget and adversarial-review records bound to one artifact
    When release eligibility is evaluated
    Then eligibility is true for the exact complete profile
    But removing duplicating failing staling mismatching or unbinding any one record yields deterministic blockers and eligibility false
    And structural specification text unexecuted scenarios and v0.1 through v0.3 stage claims are each rejected
