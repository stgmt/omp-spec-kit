Feature: Centralized spec registry service

  Specs live only on a dedicated per-project `specs` branch.
  The hosted service is the single write path; agents use remote MCP,
  humans use the YouTrack app.

  @id:SCEN-specs-branch-isolation
  Scenario: Spec content is rejected on code branches
    Given a managed repository with a `specs` branch
    When a pull request on `main` adds a file under `.specs/`
    Then the required check fails
    And the `specs` branch remains the only carrier of `.specs/`

  @id:SCEN-service-only-writes
  Scenario: Direct push to specs branch is rejected
    Given a managed repository
    When a non-bot identity pushes a commit touching `.specs/` to `specs`
    Then the push is rejected by repository rules

  @id:SCEN-optimistic-concurrency
  Scenario: Concurrent patch loses safely
    Given spec "alpha" with document sha S on the service
    And writer A submits spec_patch with expectedSha S
    And writer B submits spec_patch with expectedSha S
    When both requests complete
    Then exactly one commit lands on `specs`
    And the losing response is CONFLICT with retryable true

  @id:SCEN-claim-lease
  Scenario: Claim blocks unmanaged writes
    Given user A holds a claim on spec "alpha" with 30 minutes TTL
    When user B submits spec_patch on "alpha" without force
    Then the response refuses naming holder A and the expiry
    When the lease expires
    Then B can claim "alpha" and write normally

  @id:SCEN-multi-project-routing
  Scenario: Project scoping isolates mounts
    Given projects "a" and "b" both contain spec "shared-name"
    When a request addresses project "b"
    Then only project "b" content is reachable
    And no project "a" path or slug is touched

  @id:SCEN-remote-mcp-parity
  Scenario: Remote MCP serves the same contract
    Given an agent connected to the remote MCP endpoint
    When it invokes the nine read operations and spec_patch
    Then every envelope matches the stdio contract field-for-field

  @id:SCEN-youtrack-proposal
  Scenario: Human proposes edit via YouTrack
    Given a human edits a requirement in the YouTrack app
    When the app calls /rpc with the patch intent
    Then the response contains document previews and a proposalHash
    And applying without that proposalHash is refused

  @id:SCEN-read-outage-fallback
  Scenario: Read survives service outage
    Given the service is stopped
    When a consumer clones the `specs` branch
    Then `.specs/` validates offline with the kernel rules

  @id:SCEN-pin-verification
  Scenario: Spec pin detects divergence
    Given a consumer repo pins spec "alpha" at version 1.4.0 with digest D
    When the ledger record for alpha@1.4.0 has a different digest
    Then `omp spec verify` fails closed naming "alpha"

  @id:SCEN-drift-report
  Scenario: Break-glass push is visible
    Given an admin pushed directly to `specs`
    When the service next syncs the worktree
    Then the commit appears in the drift report
    And the index is reprojected
