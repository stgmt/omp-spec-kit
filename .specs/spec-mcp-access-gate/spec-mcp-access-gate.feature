@spec-mcp-access-gate
Feature: OMP MCP access gate
  The existing extension allows the two proposal-first authoring operations,
  blocks direct writes to the canonical .specs tree, allows proven non-spec
  writes, and blocks when containment cannot be proven.

  @feature1 @FR-1 @AC-1.1 @id:SCEN-current-tool-call-registration
  Scenario: Existing extension registers only the current tool call handler
    Given the installed omp-spec-kit extension factory
    When spec enforcement is registered
    Then exactly one tool_call handler is added
    And no other enforcement event extension entry or background component is added

  @feature2 @FR-2 @AC-2.1 @id:SCEN-exact-authoring-allowlist
  Scenario Outline: Only exact authoring names bypass path denial
    Given a tool_call has hook-visible name "<name>"
    When the exact authoring-name check runs
    Then the result is "<result>"

    Examples:
      | name                         | result                                      |
      | spec_patch                   | ALLOW AUTHORING_TOOL_ALLOWED                 |
      | Spec_patch                   | continue to direct-mutation path policy      |
      | spec_patch_extra             | continue to direct-mutation path policy      |
      | mcp__service__spec_patch     | continue to direct-mutation path policy      |

  @feature3 @FR-3 @AC-3.1 @id:SCEN-filesystem-containment
  Scenario Outline: Canonical containment handles path and filesystem boundaries
    Given canonical project and .specs roots on "<platform>"
    And a direct mutation target in condition "<condition>"
    When filesystem containment resolves the target
    Then resolution is "<resolution>"

    Examples:
      | platform | condition                                          | resolution    |
      | POSIX    | exact .specs root                                  | SPEC          |
      | POSIX    | descendant with slash and dot segments             | SPEC          |
      | POSIX    | component named .specs2                            | NON_SPEC      |
      | Windows  | mixed separators and case variant of .specs        | SPEC          |
      | POSIX    | symlink whose real target is under .specs          | SPEC          |
      | Windows  | reparse point whose real target is outside         | NON_SPEC      |
      | POSIX    | new leaf under resolved .specs ancestor            | SPEC          |
      | Windows  | unreadable or unstable ancestor                    | INDETERMINATE |
      | POSIX    | missing physical spec root with future spec target | SPEC          |
      | POSIX    | missing physical spec root with external target    | NON_SPEC      |
      | POSIX    | valid case-insensitive xd device uri              | NON_SPEC      |
      | Windows  | malformed xd or other scheme uri                  | INDETERMINATE |

  @feature4 @FR-4 @AC-4.1 @id:SCEN-closed-path-policy
  Scenario Outline: Every direct mutator has one closed decision
    Given the tool name is not exactly allowlisted
    And target resolutions are "<resolutions>"
    When the path-policy decision runs
    Then it returns "<decision>"

    Examples:
      | resolutions                  | decision                   |
      | SPEC                         | BLOCK RAW_SPEC_WRITE        |
      | NON_SPEC                     | ALLOW NON_SPEC_ALLOWED      |
      | INDETERMINATE                | BLOCK TARGET_INDETERMINATE  |
      | NON_SPEC,SPEC                | BLOCK RAW_SPEC_WRITE        |
      | SPEC,INDETERMINATE           | BLOCK TARGET_INDETERMINATE  |
      | NON_SPEC,NON_SPEC            | ALLOW NON_SPEC_ALLOWED      |

  @feature5 @FR-5 @AC-5.1 @id:SCEN-bounded-stateless-block
  Scenario: Block output is bounded redacted actionable and stateless
    Given a direct spec target and a resolver fault variant
    When repeated tool_call decisions block
    Then each reason is at most 512 UTF-8 bytes
    And the reason preserves the decision code and spec_patch redirect
    And only a repository-relative target is shown when known
    And TARGET_INDETERMINATE reasons include "Recovery: provide one explicit repository-relative target, or use spec_patch with dryRun: true for preview or dryRun: false to apply."
    And no absolute path environment credential stack or raw operating-system error is shown
    And no file log counter cache network subprocess credential read or alternate tool is created

  @feature6 @FR-6 @AC-6.1 @id:SCEN-single-factory-installed-policy
  Scenario: Installed artifact runs the policy through one factory
    Given the built plugin is installed without source checkout or ambient node_modules
    When real allowlist and path fixtures are replayed
    Then the existing extension factory registers the policy once
    And decisions equal reviewed ground truth
    And no download native addon unresolved import or second extension entry exists

  @feature7 @FR-7 @AC-7.1 @id:SCEN-mcp-access-gate-non-mcp-spec-access
  Scenario: Non-MCP specification access is blocked
    Given an OMP tool call that can read or write canonical .specs
    When the call is not a registered omp-spec-kit MCP operation
    Then the gate blocks it before execution with a bounded reason
    And a registered omp-spec-kit MCP operation reaches the MCP adapter without access-gate denial
    And a proven non-spec target remains subject to normal OMP policy


  @feature10 @FR-10 @AC-10.1 @id:SCEN-direct-specification-read-redirect
  Scenario: Direct specification reads redirect to MCP
    Given a direct read, grep, or glob call targeting a canonical .specs document
    When the target resolves inside the specification corpus
    Then the gate blocks it with SPEC_READ_REDIRECT
    And the reason provides the spec_documents read recovery without an absolute path
    And a direct mutator or code/command payload with .specs remains RAW_SPEC_WRITE
