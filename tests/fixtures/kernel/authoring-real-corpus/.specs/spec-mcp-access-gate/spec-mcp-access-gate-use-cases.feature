@spec-mcp-access-gate
Feature: spec-mcp-access-gate use cases

  @case:UC-1 @story:US-1
  Rule: Allow an authoring transaction
    Actor: Agent using the sanctioned spec mutation door.
    Boundary: Installed extension tool_call policy
    Trigger: Allow an authoring transaction
    Precondition: The existing extension receives a `tool_call` event.
    Success: The authoring MCP operation continues and remains responsible for validation and atomicity.
    Covers: FR-2
    Step: request | 1. The handler reads the exact hook-visible tool name.
    Context:
      **Primary actor:** Agent using the sanctioned spec mutation door.

      **Precondition:** The existing extension receives a `tool_call` event.

      **Flow:**
      1. The handler reads the exact hook-visible tool name.
      2. The name equals `spec_patch`.
      3. The handler returns ALLOW `AUTHORING_TOOL_ALLOWED` before target containment.

      **Postcondition:** The authoring MCP operation continues and remains responsible for validation and atomicity.

      **Related:** FR-2, AC-2.1, `@feature2`

  @case:UC-2 @story:US-1
  Rule: Block a direct spec write
    Actor: Agent invoking a non-allowlisted direct mutator.
    Boundary: Installed extension tool_call policy
    Trigger: Block a direct spec write
    Precondition: The call supplies a target that resolves to the canonical `.specs` root or a descendant.
    Success: The raw mutator does not execute.
    Covers: FR-3, FR-4
    Step: request | 1. Exact authoring-name comparison fails.
    Context:
      **Primary actor:** Agent invoking a non-allowlisted direct mutator.

      **Precondition:** The call supplies a target that resolves to the canonical `.specs` root or a descendant.

      **Flow:**
      1. Exact authoring-name comparison fails.
      2. The resolver normalizes and resolves the target.
      3. Component-boundary containment classifies it as `SPEC`.
      4. The handler returns BLOCK `RAW_SPEC_WRITE` with a bounded repository-relative redirect.

      **Postcondition:** The raw mutator does not execute.

      **Related:** FR-3, FR-4, AC-4.1, `@feature4`

    @feature4 @FR-4 @AC-4.1 @id:SCEN-closed-path-policy
    Scenario Outline: Every direct mutator has one closed decision
      Given the tool name is not exactly allowlisted
      And target resolutions are "<resolutions>"
      When the path-policy decision runs
      Then it returns "<decision>"

      Examples:
        | example_id | resolutions                  | decision                   |
        | row-1 | SPEC                         | BLOCK RAW_SPEC_WRITE        |
        | row-2 | NON_SPEC                     | ALLOW NON_SPEC_ALLOWED      |
        | row-3 | INDETERMINATE                | BLOCK TARGET_INDETERMINATE  |
        | row-4 | NON_SPEC,SPEC                | BLOCK RAW_SPEC_WRITE        |
        | row-5 | SPEC,INDETERMINATE           | BLOCK TARGET_INDETERMINATE  |
        | row-6 | NON_SPEC,NON_SPEC            | ALLOW NON_SPEC_ALLOWED      |

  @case:UC-3 @story:US-1
  Rule: Allow a proven non-spec write
    Actor: Agent invoking a non-allowlisted direct mutator.
    Boundary: Installed extension tool_call policy
    Trigger: Allow a proven non-spec write
    Precondition: Every mutation target can be proven outside the canonical `.specs` root.
    Success: The direct non-spec mutation proceeds unchanged.
    Covers: FR-4
    Step: request | 1. The resolver canonicalizes each target.
    Context:
      **Primary actor:** Agent invoking a non-allowlisted direct mutator.

      **Precondition:** Every mutation target can be proven outside the canonical `.specs` root.

      **Flow:**
      1. The resolver canonicalizes each target.
      2. Exact component comparison proves every target is outside `.specs`.
      3. The handler returns ALLOW `NON_SPEC_ALLOWED`.

      **Postcondition:** The direct non-spec mutation proceeds unchanged.

      **Related:** FR-4, AC-4.1, `@feature4`

  @case:UC-4 @story:US-4
  Rule: Block indeterminate containment
    Actor: Agent whose direct mutator target cannot be resolved safely.
    Boundary: Installed extension tool_call policy
    Trigger: Block indeterminate containment
    Precondition: Path syntax, filesystem access, link resolution, reparse handling, or nearest-existing-ancestor resolution cannot prove containment.
    Success: Uncertainty cannot become a write bypass.
    Covers: FR-3, FR-5
    Step: request | 1. Exact authoring-name comparison fails.
    Context:
      **Primary actor:** Agent whose direct mutator target cannot be resolved safely.

      **Precondition:** Path syntax, filesystem access, link resolution, reparse handling, or nearest-existing-ancestor resolution cannot prove containment.

      **Flow:**
      1. Exact authoring-name comparison fails.
      2. Resolution returns `INDETERMINATE` with a closed code.
      3. The handler returns BLOCK `TARGET_INDETERMINATE`.
      4. The reason omits absolute paths and raw operating-system errors.

      **Postcondition:** Uncertainty cannot become a write bypass.

      **Related:** FR-3, FR-5, AC-3.1, `@feature3`, `@feature5`

  @case:UC-5 @story:US-3
  Rule: Load the installed policy
    Actor: Plugin maintainer.
    Boundary: Installed extension tool_call policy
    Trigger: Load the installed policy
    Precondition: The built plugin is installed without source files or ambient modules.
    Success: Installed results equal reviewed ground truth and no second extension entry exists.
    Covers: FR-1, FR-6
    Step: request | 1. The existing extension factory imports the bundled registration function.
    Context:
      **Primary actor:** Plugin maintainer.

      **Precondition:** The built plugin is installed without source files or ambient modules.

      **Flow:**
      1. The existing extension factory imports the bundled registration function.
      2. The function registers one `tool_call` handler.
      3. Captured allowlist and path fixtures are replayed.

      **Postcondition:** Installed results equal reviewed ground truth and no second extension entry exists.

      **Related:** FR-1, FR-6, AC-6.1, `@feature1`, `@feature6`

    @feature6 @FR-6 @AC-6.1 @id:SCEN-single-factory-installed-policy
    Scenario: Installed artifact runs the policy through one factory
      Given the built plugin is installed without source checkout or ambient node_modules
      When real allowlist and path fixtures are replayed
      Then the existing extension factory registers the policy once
      And decisions equal reviewed ground truth
      And no download native addon unresolved import or second extension entry exists

  @case:UC-6 @story:US-5
  Rule: Reject a non-MCP specification read
    Actor: OMP agent and MCP adapter.
    Boundary: Installed extension tool_call policy
    Trigger: Reject a non-MCP specification read
    Precondition: A host tool_call has a complete or missing registered MCP authority and zero or more raw targets.
    Success: Non-MCP specification access, empty/unknown/special targets, and resolver faults are blocked; valid registered MCP operations reach the adapter; proven non-spec targets remain governed by normal OMP policy.
    Covers: FR-7
    Step: request | 1. Classify the authority envelope and exact registered operation.
    Context:
      **Actor:** OMP agent and MCP adapter.

      **Precondition:** A host tool_call has a complete or missing registered MCP authority and zero or more raw targets.

      **Flow:**
      1. Classify the authority envelope and exact registered operation.
      2. Block missing or invalid authority before execution for same-name authoring calls.
      3. Resolve each target using canonical root, metadata, and special-path rules.
      4. Return the closed decision and bounded redacted reason, or reach the registered MCP adapter.

      **Postcondition:** Non-MCP specification access, empty/unknown/special targets, and resolver faults are blocked; valid registered MCP operations reach the adapter; proven non-spec targets remain governed by normal OMP policy.

      **Related:** FR-7, AC-7.1, @feature7

