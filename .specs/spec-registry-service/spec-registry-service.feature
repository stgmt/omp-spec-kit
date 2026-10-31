Feature: Centralized spec registry service

  Specs live only in the dedicated specs repository
  (owner/project/.specs layout). The hosted service is the single
  write path; agents use remote MCP, humans use the YouTrack app.

  @id:SCEN-specs-branch-isolation
  Scenario: Spec content is rejected on code branches
    Given a migrated product repository
    When a pull request on `main` adds a file under `.specs/`
    Then the required check fails
    And the specs repo remains the only carrier of `.specs/`

  @id:SCEN-service-only-writes
  Scenario: Direct push to specs repo is rejected
    Given the specs repository
    When a non-bot identity pushes a commit touching `.specs/`
    Then the push is rejected by repository rules

  @id:SCEN-optimistic-concurrency
  Scenario: Concurrent patch loses safely
    Given spec "alpha" with document sha S on the service
    And writer A submits spec_patch with expectedSha S
    And writer B submits spec_patch with expectedSha S
    When both requests complete
    Then exactly one commit lands in the specs repo
    And the losing response is CONFLICT with retryable true

  @id:SCEN-claim-lease
  Scenario: Claim blocks unmanaged writes
    Given user A holds a claim on spec "alpha" with 30 minutes TTL
    When user B submits spec_patch on "alpha" without force
    Then the response refuses naming holder A and the expiry
    When the lease expires
    Then B can claim "alpha" and write normally

  @id:SCEN-multi-project-routing
  Scenario: Project scoping isolates namespaces
    Given scopes "stgmt/a" and "acme/b" both contain spec "shared-name"
    When a request addresses project "acme/b"
    Then only "acme/b" content is reachable
    And no "stgmt/a" path or slug is touched

  @id:SCEN-remote-mcp-parity
  Scenario: Remote MCP serves the same contract
    Given an agent connected to the remote MCP endpoint
    When it invokes the nine read operations and spec_patch
    Then every envelope matches the stdio contract field-for-field

  @id:SCEN-youtrack-proposal
  Scenario: Human proposes edit via YouTrack
    Given a human edits a requirement in the YouTrack app
    When the app backend calls /mcp (tools/call) with the patch intent
    Then the response contains document previews and a proposalHash
    And applying without that proposalHash is refused

  @id:SCEN-read-outage-fallback
  Scenario: Operator read survives service outage
    Given the service is stopped
    When the operator clones the specs repo
    Then every owner/project/.specs tree validates offline with the kernel rules

  @id:SCEN-versioned-read-integrity
  Scenario: Versioned read resolves through the ledger
    Given spec "alpha" is published at version 1.4.0 with ledger digest D
    When a read requests alpha at version "1.4.0"
    Then the returned content matches digest D
    And a version unknown to the ledger fails closed

  @id:SCEN-verified-identity
  Scenario: Identity is verified, never asserted
    Given a request arrives with a caller-supplied X-Spec-Author header
    When the service authenticates the caller against the live YouTrack
    Then the header value is ignored and logged as a warning
    And the commit trailer and access log carry the verified YouTrack login

  @id:SCEN-role-gates
  Scenario: Roles gate operations
    Given a user whose role groups resolve to "reader"
    When the user lists tools
    Then no write tool is listed
    And a write attempt is refused as requiring the writer role
    When an owner forces a write over another user's active claim
    Then the write is applied and the forced override is logged

  @id:SCEN-drift-report
  Scenario: Break-glass push is visible
    Given an admin pushed directly to the specs repo
    When the service next syncs the clone
    Then the commit appears in the drift report
    And the index is reprojected
