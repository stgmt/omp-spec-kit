@spec-enforcement @authoring-gated
Feature: Native OMP spec-discipline enforcement through hook events
  The enforcement hooks intercept agent writes to .specs/** in enforcement mode
  and inject kernel diagnostics in informational mode. Every internal fault
  produces an explicit visible message. These scenarios specify required behavior
  and have no executed status here.

  @feature1 @AC-1.1 @id:SCEN-event-surface-selection
  Scenario: Event subscriptions match the pinned claim set
    Given the enforcement hooks are loaded into an OMP session
    When the extension factory executes
    Then exactly tool_call tool_result context and session_start events are subscribed
    And no other event subscriptions exist
    And the TASK-1 receipt proves v17.3.7 tool_call lacks provider server and schema identity so enforcement remains DEFERRED_HOST_ABI

  @feature2 @AC-2.1 @id:SCEN-informational-mode-diagnostic-injection
  Scenario: Informational mode injects kernel diagnostics on spec-file reads
    Given informational mode is active and the kernel is available
    And a tool call targets a path under .specs/
    When the tool_result handler fires after successful execution
    Then at most two kilobytes of spec-kernel findings are appended to the result content
    And the handler does not block execution
    And the handler does not mutate repository state
    And kernel diagnostics contain only spec-kernel FR-6 findings

  @feature2 @AC-2.2 @id:SCEN-corpus-census-session-start
  Scenario: Corpus census is injected on session start
    Given informational mode is active and the kernel is available
    When session_start fires
    Then a corpus census is computed and stored for injection
    And the next context event receives at most one bounded census message of at most four kilobytes appended to the outgoing messages
    And the injection modifies only the event deep copy
    And session-stored messages and repository bytes are unchanged

  @feature3 @AC-3.1 @id:SCEN-enforcement-mode-write-interception
  Scenario Outline: Every tool effect has one conservative enforcement decision
    Given enforcement mode is active and classification is "<classification>"
    When the tool call classifier resolver and decision policy run
    Then "<outcome>"

    Examples:
      | classification                                  | outcome                                      |
      | exact accepted authoring MCP authority           | the call is allowed                          |
      | known read-only tool                             | the call is allowed                          |
      | exhaustive writer with all non-spec targets      | the call is allowed                          |
      | exhaustive writer with one .specs target         | RAW_SPEC_WRITE blocks with qualified redirect|
      | unknown or incomplete dynamic target             | TARGET_INDETERMINATE blocks visibly          |
      | authority or containment mismatch                | the call blocks visibly                      |

  @feature4 @AC-4.1 @id:SCEN-fail-honest-policy
  Scenario Outline: Fault policy preserves visibility and no-bypass
    Given mode is "<mode>" and fault class is "<fault>"
    When the handler catches the fault before the outer wrapper
    Then "<outcome>"

    Examples:
      | mode          | fault                                      | outcome                                      |
      | informational | kernel or diagnostic render failure        | one visible diagnostic and no block          |
      | enforcement   | kernel or census failure                    | visible degradation without fake conformance |
      | enforcement   | registry extractor authority or resolver failure | TARGET_INDETERMINATE blocks             |

  @feature5 @AC-5.1 @id:SCEN-no-hidden-state
  Scenario: No state exists outside event-visible records
    Given the enforcement hooks execute across multiple sessions
    When filesystem network process credential and registered-tool surfaces are audited
    Then no files exist outside session-local temporary state
    And no persistent log counter audit network subprocess credential access or alternate query/agent tool exists
    And every observable record uses declared tool_result context or session diagnostics

  @feature6 @AC-6.1 @id:SCEN-dependency-safe-distribution
  Scenario: Installed hooks execute dependency-absent
    Given the plugin artifact is installed with source checkout and root node_modules absent
    When the enforcement hook module loads from the bundled artifact
    Then the module executes without ambient dependencies dynamic downloads native addons or unresolved imports
    And hook absence degrades honestly with an explicit diagnostic per FR-4

  @feature7 @AC-7.1 @id:SCEN-no-bypass-paths
  Scenario Outline: Closed registry prevents raw and future-tool bypasses
    Given enforcement mode is active with accepted host authority ABI and installed tool condition is "<condition>"
    When the host-authenticated call is compared with the candidate installed effect and authority manifests
    Then "<outcome>"
    And no config environment caller exception raw endpoint or alternate tool disables the result

    Examples:
      | condition                                 | outcome                                      |
      | exact accepted authoring facade           | authority-bound call is allowed              |
      | raw writer to .specs                      | call is blocked and redirected               |
      | new renamed or changed installed or host-event tool          | call is UNKNOWN and blocks                    |
      | shell target uses unsupported dynamic syntax | extraction is incomplete and blocks       |
      | raw tool only names the authoring door    | authority mismatch blocks                    |

  @feature8 @AC-8.1 @id:SCEN-degradation-ladder
  Scenario Outline: Degradation preserves product truth and no-bypass
    Given runtime state is "<state>"
    When handlers initialize
    Then "<outcome>" and one bounded diagnostic names the missing component

    Examples:
      | state                                      | outcome                                                     |
      | product or authoring capability absent     | enforcement is inactive and status is informational/degraded|
      | accepted enforcement but kernel unavailable| kernel projections are unavailable while write enforcement remains active |

  @feature9 @AC-9.1 @id:SCEN-stage-gated-activation
  Scenario Outline: Product capability and registry drift are handled separately
    Given session-start state is "<state>"
    When mode installed registry and host authority ABI binding are evaluated
    Then "<outcome>"

    Examples:
      | state                                                    | outcome                                           |
      | SPEC_ENFORCEMENT not accepted                            | informational or degraded mode only               |
      | same-candidate product and authoring authority accepted  | enforcement mode activates                         |
      | product candidate authoring authority or host ABI missing or mismatched | enforcement activation is refused                  |
      | accepted enforcement with one new installed or host-event tool              | enforcement stays active and the new tool is UNKNOWN |

  @feature10 @AC-10.1 @AC-10.2 @id:SCEN-diagnostics-are-kernel-findings-only
  Scenario: Conformance findings and policy diagnostics never alias
    Given the extension emits kernel findings and enforcement-policy diagnostics
    When the installed bundle and event output are inspected
    Then every conformance finding traces to a runtime spec-kernel FR-6 record
    And registry authority containment mode and adapter faults use a separate policy-diagnostic kind
    And no private spec parser rule catalog validator or independent finding producer exists
    And an empty kernel result says no findings while an unavailable kernel says unavailable

  @feature11 @AC-11.1 @id:SCEN-spec-enforcement-release-conjunction-fails-closed
  Scenario: Release eligibility is capability-only and closed
    Given a spec-enforcement-release@2 manifest binds one candidate baseline authoring manifests supported and live registries plus evidence bytes
    When one of the exact twelve candidate checks or any binding is missing extra duplicate failed stale mismatched unverifiable or unbound
    Then eligibility is false with a closed blocker after bytes are re-hashed
    And CHK-FR11-01 tests the evaluator but is not a candidate record
    And eligibility does not itself mark SPEC_ENFORCEMENT delivered
