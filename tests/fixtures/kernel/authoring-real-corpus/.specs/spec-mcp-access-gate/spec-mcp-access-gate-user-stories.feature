@spec-mcp-access-gate
Feature: spec-mcp-access-gate user stories

  @story:US-1
  Rule: Spec owner protected from direct writes
    Actor: spec owner
    Goal: direct mutation of `.specs` blocked while the two proposal-first authoring operations remain available
    Benefit: reviewed atomic changes are the only mutation route.
    Covers: FR-2, FR-4
    Context:
      **Priority:** Must


      **Why:** A raw write can bypass proposal review and atomic application.

      **Independent Test:** Call both exact allowlisted names, near-miss names, a direct mutator against `.specs`, and a direct mutator against a non-spec path; only exact authoring calls and proven non-spec writes pass.

      **Acceptance Scenarios:** `@feature2`, `@feature4`

    @feature2 @FR-2 @AC-2.1 @id:SCEN-exact-authoring-allowlist
    Scenario Outline: Only exact authoring names bypass path denial
      Given a tool_call has hook-visible name "<name>"
      When the exact authoring-name check runs
      Then the result is "<result>"

      Examples:
        | example_id | name                         | result                                      |
        | row-1 | spec_patch                   | ALLOW AUTHORING_TOOL_ALLOWED                 |
        | row-2 | Spec_patch                   | continue to direct-mutation path policy      |
        | row-3 | spec_patch_extra             | continue to direct-mutation path policy      |
        | row-4 | mcp__service__spec_patch     | continue to direct-mutation path policy      |

  @story:US-2
  Rule: User receiving an actionable block
    Actor: OMP user
    Goal: an unsafe or unresolved target blocked with one short repository-relative reason
    Benefit: I know which path was refused and which two operations to use instead.
    Covers: FR-3, FR-5
    Context:
      **Priority:** Must


      **Why:** Absolute paths and raw filesystem errors are noisy and may disclose workstation details.

      **Independent Test:** Exercise spec, unresolved, symlink, reparse, and new-target cases and compare the bounded result with reviewed ground truth.

      **Acceptance Scenarios:** `@feature3`, `@feature5`

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

  @story:US-3
  Rule: Maintainer shipping one extension
    Actor: maintainer
    Goal: the policy registered only on `tool_call` in the existing extension factory and bundled without ambient dependencies
    Benefit: the installed artifact has one reachable enforcement path.
    Covers: FR-1, FR-6
    Context:
      **Priority:** Must


      **Why:** A second factory or background component is needless and can drift from the product entrypoint.

      **Independent Test:** Load the installed artifact without the source checkout or root `node_modules`; observe one handler registration and the same path decisions as source fixtures.

      **Acceptance Scenarios:** `@feature1`, `@feature6`

    @feature1 @FR-1 @AC-1.1 @id:SCEN-current-tool-call-registration
    Scenario: Existing extension registers only the current tool call handler
      Given the installed omp-spec-kit extension factory
      When spec enforcement is registered
      Then exactly one tool_call handler is added
      And no other enforcement event extension entry or background component is added

  @story:US-4
  Rule: Operator with no hidden state
    Actor: operator
    Goal: each decision derived from the current call and filesystem only
    Benefit: enforcement leaves no logs, counters, caches, or private state.
    Covers: FR-5
    Context:
      **Priority:** Must


      **Why:** Hidden state is unnecessary for a pre-execution path decision.

      **Independent Test:** Run repeated calls and verify byte-identical decisions and no created files, network access, subprocesses, or credential reads.

      **Acceptance Scenarios:** `@feature5`

    @feature3 @FR-3 @AC-3.1 @id:SCEN-filesystem-containment
    Scenario Outline: Canonical containment handles path and filesystem boundaries
      Given canonical project and .specs roots on "<platform>"
      And a direct mutation target in condition "<condition>"
      When filesystem containment resolves the target
      Then resolution is "<resolution>"

      Examples:
        | example_id | platform | condition                                          | resolution    |
        | row-1 | POSIX    | exact .specs root                                  | SPEC          |
        | row-2 | POSIX    | descendant with slash and dot segments             | SPEC          |
        | row-3 | POSIX    | component named .specs2                            | NON_SPEC      |
        | row-4 | Windows  | mixed separators and case variant of .specs        | SPEC          |
        | row-5 | POSIX    | symlink whose real target is under .specs          | SPEC          |
        | row-6 | Windows  | reparse point whose real target is outside         | NON_SPEC      |
        | row-7 | POSIX    | new leaf under resolved .specs ancestor            | SPEC          |
        | row-8 | Windows  | unreadable or unstable ancestor                    | INDETERMINATE |
        | row-9 | POSIX    | missing physical spec root with future spec target | SPEC          |
        | row-10 | POSIX    | missing physical spec root with external target    | NON_SPEC      |
        | row-11 | POSIX    | valid case-insensitive xd device uri              | NON_SPEC      |
        | row-12 | Windows  | malformed xd or other scheme uri                  | INDETERMINATE |

  @story:US-5
  Rule: Read specifications only through MCP
    Actor: product owner
    Goal: agent reads and writes of canonical specifications to pass only through MCP
    Benefit: the MCP server remains the single auditable authority.
    Covers: FR-7
    Context:
      **Priority:** Must

      **Why:** A registered MCP authority provides the only auditable specification-access boundary.

      **Independent Test:** Replay registered-authority, same-name non-MCP, unknown-target, special-path, empty-target, and proven-outside calls and compare decisions with the closed matrix.

      **Acceptance Scenarios:** @feature7, SCEN-mcp-access-gate-non-mcp-spec-access

    @feature7 @FR-7 @AC-7.1 @id:SCEN-mcp-access-gate-non-mcp-spec-access
    Scenario: Non-MCP specification access is blocked
      Given an OMP tool call that can read or write canonical .specs
      When the call is not a registered omp-spec-kit MCP operation
      Then the gate blocks it before execution with a bounded reason
      And a registered omp-spec-kit MCP operation reaches the MCP adapter without access-gate denial
      And a proven non-spec target remains subject to normal OMP policy
