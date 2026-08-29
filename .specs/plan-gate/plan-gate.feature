@plan-gate @authoring-gated
Feature: Deterministic manual validation and future automatic plan approval gate
  Manual mode validates explicit plan bytes. Automatic mode consumes only a future
  post-native-resolver OMP event and is deferred on v17.3.7. Scenario text is not evidence.

  @feature1 @AC-1.1 @id:SCEN-approval-interception-and-plan-resolution
  Scenario Outline: Exact plan input is validated without fallback guessing
    Given mode is "<mode>" with one exact plan URL content hash title and slug
    When validation admission runs under host contract "<host>"
    Then the admission result is "<result>" and no directory scan occurs

    Examples:
      | mode      | host                    | result               |
      | MANUAL    | explicit-plan-input@1 | accepted             |
      | AUTOMATIC | selected-plan-event@1 | accepted             |
      | AUTOMATIC | OMP v17.3.7              | HOST_ABI_UNSUPPORTED |

  @feature1 @AC-1.2 @id:SCEN-session-transition-plan-resolution
  Scenario: Session transitions preserve the selected plan identity
    Given native selection session A chose one exact plan URL content and hash
    And approval session B carries HOST_APPROVAL_FORK with the same transition plan hash
    When the gate receives the selected-plan-event@1 input
    Then it validates the exact A to B transition without scanning fallback plans
    And inconsistent IDs kind or copied-plan hash yields PLAN_IDENTITY_MISMATCH

  @feature2 @AC-2.1 @id:SCEN-every-gate-fault-allows
  Scenario Outline: Internal gate faults allow before the outer host timeout
    Given one exact plan request has adapter fault "<fault>"
    When the gate returns within twenty seconds
    Then decision is ALLOW with diagnostic "<diagnostic>" and zero validation errors
    And a complete successful validation with ERROR findings is the only BLOCK path
    And an outer host timeout is reported as a fail-closed implementation defect

    Examples:
      | fault                                  | diagnostic                    |
      | manual plan source unreadable before exact input construction | PLAN_INPUT_UNAVAILABLE      |
      | declared duplicate unreadable                                 | DUPLICATE_INPUT_UNAVAILABLE |
      | prompt cache malformed or over budget                         | PROMPT_CACHE_UNAVAILABLE    |
      | spec document unreadable or index partial                     | SPEC_INDEX_UNAVAILABLE      |
      | realpath or reparse containment refusal                       | SPEC_INDEX_UNAVAILABLE      |
      | bundled resource hash mismatch                                | RESOURCE_HASH_MISMATCH      |
      | validator exception                                           | VALIDATOR_EXCEPTION         |
      | internal deadline expiry                                      | VALIDATOR_TIMEOUT           |

  @feature3 @AC-3.1 @id:SCEN-plan-mode-contract-injection
  Scenario Outline: Preventive contract output is mode scoped
    Given validation mode is "<mode>" under host contract "<host>" with planMode "<plan_mode>"
    When preventive contract handling runs
    Then "<outcome>"

    Examples:
      | mode      | host                    | plan_mode | outcome                                      |
      | MANUAL    | explicit-plan-input@1 | false     | advisory output is returned                  |
      | MANUAL    | explicit-plan-input@1 | true      | advisory output is returned                  |
      | AUTOMATIC | selected-plan-event@1 | true      | one bounded deep-copy context message may exist |
      | AUTOMATIC | OMP v17.3.7              | false     | HOST_ABI_UNSUPPORTED is returned             |

  @feature4 @AC-4.1 @id:SCEN-skeleton-structure-validation-blocks
  Scenario: Mandatory skeleton failures block with line hints
    Given plan fixtures each missing one of the ten mandatory sections or violating order human-summary inventory subsections requirements subsections todos format verification commands file-change path action reason or impact-analysis obligations
    When the pure validator runs over each fixture
    Then each violation yields exactly one bounded error with one-based line closed message and remediation hint
    And the run blocks with every planted violation named and a structurally complete fixture passes every structure phase

  @feature5 @AC-5.1 @id:SCEN-duplicate-plan-blocked
  Scenario: Duplicate plans use an explicit bounded candidate set
    Given a request supplies exact plan bytes and no more than twenty candidate URLs within eight mebibytes
    And one candidate has identical bytes and another differs in size by more than ten bytes
    When duplicate validation runs without scanning a directory
    Then the identical candidate blocks naming its URL and the size-differing candidate is not hashed
    And an unreadable declared candidate returns ALLOW with DUPLICATE_INPUT_UNAVAILABLE

  @feature6 @AC-6.1 @id:SCEN-grounding-blocks-and-cache-degrades-open
  Scenario: Grounding is deterministic and an empty cache degrades open
    Given a prompt cache with five entries and a plan authored for a different recorded task
    When the relevance score is computed against the selected window
    Then a score at or below exact threshold negative twenty blocks with the selected excerpt
    And repeated runs over the same plan and cache produce identical scores and decisions
    And an empty cache skips grounding while malformed or over-budget input ALLOWs with PROMPT_CACHE_UNAVAILABLE

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
  Scenario Outline: Spec references distinguish validation errors from adapter faults
    Given a spec-touching plan and spec-index condition "<condition>"
    When manual admission and spec-reference validation run
    Then "<outcome>"

    Examples:
      | condition                         | outcome                                                   |
      | complete index with existing ID   | the phase passes                                          |
      | complete index missing slug or ID | validation BLOCKS                                         |
      | no qualified reference            | validation BLOCKS                                         |
      | unreadable canonical document     | ALLOW with SPEC_INDEX_UNAVAILABLE and no partial index     |
      | absent or partial index            | ALLOW with SPEC_INDEX_UNAVAILABLE and no validation         |
      | spec index byte budget exhausted   | ALLOW with SPEC_INDEX_UNAVAILABLE and no partial index       |
      | symlink or reparse escapes root    | ALLOW with SPEC_INDEX_UNAVAILABLE and contained diagnostic |
      | plan touches no guarded path       | the phase is skipped                                      |

  @feature10 @AC-10.1 @id:SCEN-deny-format-is-actionable
  Scenario: Deny output is complete through paging and bounded in the host reason
    Given a plan has more blocking errors than fit in sixteen kilobytes
    When validation blocks
    Then total error count and cursor-paged complete findings are returned
    And the host reason contains only complete rows plus exact omitted count and cursor
    And warnings remain diagnostics and never block

  @feature11 @AC-11.1 @id:SCEN-self-contained-gate-artifact
  Scenario Outline: Installed gate executes dependency-absent by profile
    Given the exact candidate artifact is installed without source checkout or external module trees
    When "<profile>" input drives the complete pipeline
    Then validation runs using only bundled code and resources with zero daemon network subprocess and credential activity
    And bundled resources match their shipped hash inventory

    Examples:
      | profile                                                  |
      | plan-gate-manual@1 explicit request             |
      | plan-gate-automatic@1 captured selected-plan event |

  @feature12 @AC-12.1 @id:SCEN-plan-gate-real-fixture-provenance
  Scenario: Real fixture bytes reconcile with ground truth
    Given a gate-owned fixture manifest records capture producer source date hash size license trimming and expected blocking errors per phase with lines and codes
    When fixture bytes are verified and validated
    Then hashes and sizes match and observed errors reconcile with reviewed ground truth
    And synthetic-labeled fixtures do not satisfy the real-fixture obligation

  @feature13 @AC-13.1 @id:SCEN-plan-gate-release-conjunction-fails-closed
  Scenario Outline: Release eligibility is profile-specific and closed
    Given candidate profile "<profile>" has its exact mandatory hash-bound records
    When release eligibility is evaluated
    Then "<outcome>"
    And removing duplicating failing staling mismatching or unbinding any mandatory record yields deterministic blockers
    And structural specification text and unexecuted scenarios are rejected as evidence

    Examples:
      | profile               | outcome                                                        |
      | plan-gate-manual@1 | eligibility may pass without a host ABI receipt                 |
      | plan-gate-automatic@1 | eligibility also requires CHK-HOST-ABI-01 for the exact host pin |
