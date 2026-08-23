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
    And every cited event contract has a corresponding TASK-1 probe receipt bound to the pinned runtime

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
  Scenario: Spec writes are blocked or redirected in enforcement mode
    Given enforcement mode is active and the authoring door is accepted
    And a write edit or bash tool call targets a path resolving under .specs/
    When the tool_call handler evaluates the match
    Then the handler returns block true with an actionable redirect reason naming the authoring door
    And non-matching tool calls return nothing
    And path matching normalizes separators rejects traversal and symlinks and stays inside the project root

  @feature4 @AC-4.1 @id:SCEN-fail-honest-policy
  Scenario: Hook errors produce explicit visible messages
    Given a fault planted one at a time among handler exception missing kernel unparseable artifact and internal error
    When the handler executes
    Then an explicit visible diagnostic message is produced through tool_result content addition or context message injection
    And silent pass-through does not occur
    And fake success indicators are not reported
    And handler exceptions are caught within the handler and do not propagate to the OMP tool wrapper

  @feature5 @AC-5.1 @id:SCEN-no-hidden-state
  Scenario: No state exists outside event-visible records
    Given the enforcement hooks execute across multiple sessions
    When the filesystem and network are audited
    Then no files are created outside the session-local temporary directory
    And no persistent logs counters or audit trails exist
    And all observable state surfaces through tool_result content context messages or session-local diagnostic records
    And no network calls or credential access occur

  @feature6 @AC-6.1 @id:SCEN-dependency-safe-distribution
  Scenario: Installed hooks execute dependency-absent
    Given the plugin artifact is installed with source checkout and root node_modules absent
    When the enforcement hook module loads from the bundled artifact
    Then the module executes without ambient dependencies dynamic downloads native addons or unresolved imports
    And hook absence degrades honestly with an explicit diagnostic per FR-4

  @feature7 @AC-7.1 @id:SCEN-no-bypass-paths
  Scenario: All write surfaces to specs are intercepted
    Given enforcement mode is active
    And tools capable of writing to .specs/ are invoked including write edit bash with file redirection and extension-registered tools
    When each tool call reaches the handler
    Then every matching call is blocked or redirected
    And no configuration option environment variable or API disables interception for specific callers or paths

  @feature8 @AC-8.1 @id:SCEN-degradation-ladder
  Scenario: Degradation is explicit at every step
    Given the kernel is unavailable or the authoring door is absent
    When the hooks initialize or execute
    Then informational summaries are absent with an explicit stated reason when the kernel is unavailable
    And enforcement mode is disabled by stage not by error when the door is absent
    And each degradation step produces one bounded diagnostic record naming the missing component

  @feature9 @AC-9.1 @id:SCEN-stage-gated-activation
  Scenario: Enforcement activates only after cumulative gate acceptance
    Given the authoring stage cumulative gate is not yet accepted
    When a session starts
    Then the hooks operate in informational mode only regardless of configuration
    And after cumulative gate acceptance enforcement mode activates automatically at session_start
    And gate status is cached for the session duration and is not re-evaluated mid-session

  @feature10 @AC-10.1 @id:SCEN-diagnostics-are-kernel-findings-only
  Scenario: Diagnostics originate from spec-kernel only
    Given diagnostic content is injected by the hooks
    When the content is inspected
    Then every finding originates from spec-kernel FR-6
    And no private rule set custom validation or independent conformance check appears
    And when the kernel produces no findings the injection states no findings
    And diagnostic format follows the kernel bounded diagnostic record contract

  @feature11 @AC-11.1 @id:SCEN-spec-enforcement-release-conjunction-fails-closed
  Scenario: Release gate is a closed conjunction
    Given the release evaluator processes spec-enforcement-release at 1
    When evidence records are presented with one mandatory check missing failed or mismatched
    Then eligibility is false and the blocker is listed deterministically
    And structural specification text and unexecuted Gherkin do not satisfy evidence
    And eligibility does not imply authorization to ship
