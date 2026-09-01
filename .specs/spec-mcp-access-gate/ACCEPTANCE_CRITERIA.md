# Acceptance Criteria

These criteria define future verification obligations. Scenario text alone is not execution evidence.

## AC-1.1: Only tool call is registered

**EARS:** WHEN the existing extension factory loads the enforcement capability THEN it SHALL register exactly one `tool_call` handler and SHALL register no other enforcement event, extension entry, or background component.

**Requirement:** [FR-1](FR.md#fr-1-current-tool-call-registration)

**Scenario:** `@feature1`, `@id:SCEN-current-tool-call-registration`

## AC-2.1: Only the two exact authoring names bypass path denial

**EARS:** WHEN the hook-visible name is exactly propose_patch or apply_proposed_patch AND the host-generated authority is a registered omp-spec-kit MCP authority THEN the handler SHALL ALLOW AUTHORING_TOOL_ALLOWED before containment; WHEN the exact name has no valid registered authority THEN it SHALL BLOCK UNREGISTERED_AUTHORING_CALL; WHEN the name differs by case prefix suffix qualification or embedding THEN it SHALL not receive the authoring allowance.

**Requirement:** [FR-2](FR.md#fr-2-exact-two-name-authoring-allowlist)

**Scenario:** `@feature2`, `@id:SCEN-exact-authoring-allowlist`

## AC-3.1: Containment covers path and filesystem boundaries

**EARS:** WHEN a non-allowlisted direct mutation target uses either separator, case variants on Windows, dot segments, exact .specs root, descendants, .specs2, a POSIX symlink, a Windows reparse point, a non-existing leaf, NUL, ADS, UNC/device, or absolute input THEN the resolver SHALL use canonical component-aware filesystem resolution and SHALL return exactly SPEC, NON_SPEC, or INDETERMINATE; empty targets and unsupported metadata SHALL be INDETERMINATE.

**Requirement:** [FR-3](FR.md#fr-3-filesystem-backed-containment)

**Scenario:** `@feature3`, `@id:SCEN-filesystem-containment`

## AC-4.1: Path-policy matrix is closed

**EARS:** WHEN a non-allowlisted direct mutator has an empty or indeterminate target THEN it SHALL BLOCK TARGET_INDETERMINATE; WHEN it resolves to canonical .specs or a descendant THEN it SHALL BLOCK RAW_SPEC_WRITE; WHEN every target is proven outside THEN it SHALL ALLOW NON_SPEC_ALLOWED; AND no target list SHALL be a vacuous allow.

**Requirement:** [FR-4](FR.md#fr-4-closed-path-policy-decision)

**Scenario:** `@feature4`, `@id:SCEN-closed-path-policy`

## AC-5.1: Blocks are bounded visible and stateless

**EARS:** WHEN a call blocks THEN the reason SHALL be deterministic and at most 512 UTF-8 bytes, SHALL use only a repository-relative target when known, SHALL name the decision code, and SHALL redirect to `propose_patch` then `apply_proposed_patch`; AND repeated calls SHALL create no file log counter cache network subprocess credential access or alternate tool.

**Requirement:** [FR-5](FR.md#fr-5-bounded-visible-and-stateless-results)

**Scenario:** `@feature5`, `@id:SCEN-bounded-stateless-block`

## AC-6.1: Installed artifact uses one factory

**EARS:** WHEN the built plugin runs without the source checkout or ambient `node_modules` THEN the existing extension factory SHALL register the policy once and replay the allowlist and path matrix without downloads native addons unresolved imports or a second extension entry.

**Requirement:** [FR-6](FR.md#fr-6-single-factory-installed-delivery)

**Scenario:** `@feature6`, `@id:SCEN-single-factory-installed-policy`

## AC-7.1: Non-MCP specification access is blocked

**EARS:** WHEN an OMP read, search, enumeration, edit, write, shell, or unknown tool call can reach canonical .specs THEN the access gate SHALL block it before execution unless the host-generated authority is a registered omp-spec-kit MCP authority; WHEN the authority is valid and the registered operation is invoked THEN it SHALL reach the MCP adapter; WHEN the target is proven outside .specs THEN this gate SHALL not block it.

**Requirement:** [FR-7](FR.md#fr-7-non-mcp-read-and-execution-denial)

**Check:** CHK-FR7-01, CHK-FR7-02

**Scenario:** @feature7, @id:SCEN-mcp-access-gate-non-mcp-spec-access