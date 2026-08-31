@plan-gate @manual-validation
Feature: Validate exact plan bytes
  A manual caller receives a truthful, bounded result for one supplied plan.
  Scenario text is not execution evidence.

  @feature1 @AC-1.1 @id:SCEN-exact-plan-request
  Scenario: Exact plan content produces the closed result shape
    Given a request contains exact UTF-8 plan content and optional display metadata
    When validateExactPlan is called
    Then the result status is VALID INVALID or UNAVAILABLE
    And the result contains the computed SHA-256 complete bounded findings and exact omitted count

  @feature2 @AC-2.1 @id:SCEN-unavailable-is-not-valid
  Scenario Outline: Requests that cannot be evaluated are unavailable
    Given exact plan content has condition "<condition>"
    When validateExactPlan is called
    Then status is UNAVAILABLE with diagnostic "<code>"
    And the result does not claim that plan content passed or failed semantic validation

    Examples:
      | condition | code |
      | expected SHA-256 differs from the computed digest | INPUT_MISMATCH |
      | plan content exceeds one MiB | INPUT_TOO_LARGE |
      | expected SHA-256 is malformed | INVALID_REQUEST |
      | the validator catches an unexpected exception | VALIDATOR_FAILURE |

  @feature3 @AC-3.1 @id:SCEN-actionable-plan-content
  Scenario Outline: Native-compatible semantic fields are required
    Given a plan uses accepted headings in any order and has variant "<variant>"
    When validateExactPlan is called
    Then status is "<status>" with content code "<code>"
    And unrelated headings are ignored

    Examples:
      | variant | status | code |
      | all semantic fields are non-empty with non-destructive actions | VALID | none |
      | objective is absent | INVALID | MISSING_OBJECTIVE |
      | approach is absent | INVALID | MISSING_APPROACH |
      | no valid repository-relative file and action exists | INVALID | MISSING_FILE_ACTIONS |
      | verification is absent | INVALID | MISSING_VERIFICATION |
      | assumptions are absent | INVALID | MISSING_ASSUMPTIONS |
      | a destructive action has no impact disclosure | INVALID | MISSING_DESTRUCTIVE_IMPACT |

  @feature4 @AC-4.1 @id:SCEN-request-alignment-warning
  Scenario: Optional request alignment remains advisory
    Given a complete plan and request text have disjoint significant-word sets
    When validateExactPlan is called
    Then status is VALID with REQUEST_ALIGNMENT_WARNING
    And omitting request text emits no alignment warning

  @feature5 @AC-5.1 @id:SCEN-bounded-deterministic-findings
  Scenario: Findings are bounded without retained data
    Given one plan produces sixty ordered content findings
    When the identical request is validated twice
    Then both serialized results are byte-identical
    And each result contains fifty complete findings and omittedCount ten

  @feature6 @AC-6.1 @id:SCEN-installed-validator-is-pure
  Scenario: Installed validation is self-contained and side-effect free
    Given the built validator is loaded outside the source checkout without external node_modules
    When exact content with a source URI is validated under filesystem network process and credential instrumentation
    Then source URI is never dereferenced
    And no read scan write network provider credential subprocess or persistence operation occurs

  @feature7 @AC-7.1 @id:SCEN-real-plan-fixtures-reconcile
  Scenario: Captured plan fixtures reconcile with reviewed truth
    Given real positive and one-fault negative plans have complete provenance manifests
    When fixture hashes sizes and validator results are recomputed
    Then every manifest value and ordered expected finding matches
    And synthetic scale fixtures do not satisfy the real-fixture requirement
