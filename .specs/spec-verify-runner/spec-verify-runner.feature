Feature: Verify runner

  @feature1 @FR-1 @AC-1.1 @id:SCEN-executable-checks
  Scenario: Executable task checks
    Given a task declaring a verify command with a timeout
    When the task listing is read
    Then the command, its flags and its timeout SHALL be readable
    And a task without a check SHALL appear as having no check

  @feature2 @FR-2 @AC-2.1 @id:SCEN-allowlisted-run
  Scenario: Run under an allowlist and a timeout
    Given one command whose executable is not allowlisted and one that outlives its timeout
    When each run is attempted
    Then the first SHALL be refused before any spawn
    And the second SHALL terminate at the timeout with partial output recorded

  @feature3 @FR-3 @AC-3.1 @id:SCEN-evidence-record
  Scenario: Evidence records
    Given a completed run
    When the evidence is read for that task and for the task history
    Then the record SHALL carry commit, dirty state, exit code, duration, output tail and output hash
    And the history SHALL return the run in order

  @feature4 @FR-4 @AC-4.1 @AC-4.2 @id:SCEN-completion-gate
  Scenario: Completion requires a fresh green run
    Given a task with no green record for the current commit
    When its status is set to done with and without a written override reason
    Then the plain transition SHALL be refused naming the missing record
    And the override SHALL apply and SHALL appear in the receipt and history

  @feature5 @FR-5 @AC-5.1 @id:SCEN-spend-authorization
  Scenario: Spend authorization
    Given a command marked as spending with no authorization record
    When the run is attempted
    Then it SHALL be refused naming the missing authorization
    And the same command without the flag SHALL run without authorization

  @feature6 @FR-6 @AC-6.1 @id:SCEN-external-writers
  Scenario: External writers and last-green answers
    Given two runs at different commits producing scenario results
    When a scenario is queried
    Then it SHALL report the last green run with its commit and timestamp
    And both runs SHALL remain in the history
