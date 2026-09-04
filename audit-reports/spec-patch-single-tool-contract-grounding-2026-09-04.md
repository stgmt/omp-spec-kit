# Spec Patch Single-Tool Contract Grounding (2026-09-04)

## Scope and Intent

This audit report grounds the consolidation of `spec_propose_patch` and `apply_proposed_patch` into a single closed `spec_patch` tool with `dryRun` semantics in the pinned runtime source of `@oh-my-pi/pi-coding-agent` (version 18.1.6 on host, 17.3.7 pinned discovery baseline).

It verifies:
1. The static write-level assignment of bridged MCP tools in Oh My Pi.
2. The absence of dynamic argument-dependent annotation (e.g. `dryRun: true` lowering permissions at runtime).
3. The removal of the string `approval: "approve"` parameter in favor of native OMP approval gates.
4. The exact candidate tool census (10 tools: 9 read-only, 1 mutating `spec_patch`).
5. Transactional invariants and fail-closed security boundaries under `.specs/**`.

---

## 1. Pinned OMP Runtime Source Grounding

### A. Static Write Level for All MCP Tools

In `@oh-my-pi/pi-coding-agent/src/mcp/tool-bridge.ts`:

```typescript
// Line 536-545
export class MCPTool implements CustomTool<TSchema, MCPToolDetails> {
	readonly name: string;
	readonly label: string;
	readonly description: string;
	readonly parameters: TSchema;
	readonly mcpToolName: string;
	readonly mcpServerName: string;
	readonly approval = "write" as const;
```

And in `DeferredMCPTool`:

```typescript
// Line 648-657
export class DeferredMCPTool implements CustomTool<TSchema, MCPToolDetails> {
	readonly name: string;
	readonly label: string;
	readonly description: string;
	readonly parameters: TSchema;
	readonly mcpToolName: string;
	readonly mcpServerName: string;
	readonly approval = "write" as const;
```

Both `MCPTool` and `DeferredMCPTool` declare `readonly approval = "write" as const`.
Unlike internal tools (e.g. `write` which delegates to `xd://` devices via an `approval(args)` function), MCP tools bridge to OMP with a fixed, static capability tier (`"write"`).

### B. Approval Resolution and Enforcement

In `@oh-my-pi/pi-coding-agent/src/tools/approval.ts`:

```typescript
// Line 80-87
function getToolDecision(
	tool: ApprovalSubject,
	args: unknown,
): Omit<ResolvedApproval, "policy"> & { policy?: ApprovalPolicy } {
	const approval = tool.approval;
	const decision: ToolApprovalDecision | undefined = typeof approval === "function" ? approval(args) : approval;
	return normalizeDecision(decision);
}
```

Because `approval` on MCP tools is a static string (`"write"`), `decision` is always `{ tier: "write", override: false }`.

In `@oh-my-pi/pi-coding-agent/src/extensibility/extensions/wrapper.ts`:

```typescript
// Line 248-275
const resolvedArgs = approvalArgs(effectiveParams, context);
const resolved = resolveApproval(this.tool, resolvedArgs, approvalMode, userPolicies);
```

The approval gate checks the tool tier against the user's active approval mode (`always-ask`, `write`, `yolo`) and per-tool user configuration (`tools.approval.<tool>`).
This gate fires **before** the tool call is dispatched to the server.

### C. Architectural Consequences

1. **No Dynamic Approval Switching**: OMP cannot dynamically adjust an MCP tool's permission tier from `write` to `read` based on the value of `args.dryRun`. If a tool can write, its static annotations must reflect that potential capability.
2. **Conservative Annotation**: `spec_patch` is statically annotated as mutating:
   - `readOnlyHint: false`
   - `destructiveHint: true`
   - `idempotentHint: true`
   - `openWorldHint: false`
3. **Elimination of String `approval` Argument**: Previous versions required clients to pass `approval: "approve"` in tool arguments. In OMP, real authorization is handled out-of-band by the harness before execution. A second, in-band string `approval` in the tool arguments was redundant and has been completely excised from the public contract.

---

## 2. The Single `spec_patch` Contract

### A. Closed Surface Census (10 Tools)

The MCP server exposes exactly 10 tools:
1. `mcp_preflight` (read)
2. `spec_catalog` (read)
3. `spec_entities` (read)
4. `spec_graph` (read)
5. `spec_documents` (read)
6. `spec_inspect` (read)
7. `spec_tasks` (read)
8. `spec_evidence` (read)
9. `spec_markdown` (read)
10. `spec_patch` (mutating)

### B. Consolidated `spec_patch` Interface

- **Tool Name**: `spec_patch`
- **Operation**: `specPatch`
- **Discriminator**: `intent` (13 canonical variants: `patch`, `amendRequirement`, `addAcceptanceCriterion`, `addPhase`, `setEntityStatus`, `setSpecStatus`, `setRequirementMetadata`, `deleteSpecDoc`, `renameSpecDoc`, `createSpec`, `archiveSpec`, `addBacklogTask`, `registerIncidentBacklog`)
- **Common Fields**:
  - `requestId`: string (required)
  - `reason`: string (required, max 512 bytes)
  - `spec`: string (required, valid spec slug)
  - `dryRun`: boolean (optional, default `true`)
  - `actorRef`: nullable string (optional, max 64 chars)
- **Strict Validation**: `additionalProperties: false` on all branches. Unknown or legacy fields (`approval`, `proposalId`, `proposalSha256`, `expectedDocuments`, `dry_run`) are rejected with `UNKNOWN_FIELD` or `INVALID_REQUEST`.

### C. Execution Semantics

1. **`dryRun: true` (or omitted)**:
   - Evaluates operations purely in memory against an immutable kernel graph snapshot.
   - Runs full kernel invariants and resulting-spec validation.
   - Computes bounded unified diffs and before/after hashes.
   - Returns `outcome: "PREVIEW"` with diffs and findings.
   - Does **not** acquire the write lock, does **not** create staging directories, and makes **zero** filesystem mutations.
2. **`dryRun: false`**:
   - Compiles the internal proposal in memory.
   - Checks idempotent replay using a canonical request key.
   - Acquires the exclusive spec lock (`.specs/.omp-spec-kit-write.lock`).
   - Re-verifies graph snapshot fingerprint and document preimage hashes under the lock.
   - Executes atomic commit via same-filesystem staging and rename swap.
   - On conflict or error, returns `outcome: "REFUSED"` with structured error and recovery guidance.
   - Returns `outcome: "APPLIED"` with a redacted `MutationReceipt` on success.

---

## 3. Hard Tool Cut Without Migration Shims or Fallbacks

- Superseded tools `spec_propose_patch` and `apply_proposed_patch` are excised outright from the tool surface.
- In accordance with repository hard-cut policy, no migration hints, compat wrappers, or fallback aliases are introduced.
- All 38 superseded tools return standard JSON-RPC protocol error `-32602` (`Unknown tool: <name>`).
- Dead argument aliases (`proposal_id`, `proposal_sha256`, `expected_documents`) and dead schema validators were purged from `src/mcp/server.js` and `src/adapters/tool-contracts.js`.

---

## 4. Verification Evidence

All candidate validation suites pass:
1. **Verification Gate**: `npm run verify` passes clean (marketplace, package, spec corpus, spec port, blast limit, mutation testing with 160/160 killed mutants).
2. **Safe Authoring**: `npx cucumber-js tests/features/safe-authoring.feature --tags @safe-authoring` passes (17 scenarios, 102 steps).
3. **Staged MCP**: `npx cucumber-js tests/features/staged-mcp.feature` passes (64 scenarios, 384 steps).
4. **Tool E2E**: `npx cucumber-js tests/features/staged-mcp.feature --tags @tool-e2e` passes (56 scenarios, 336 steps).
5. **Release Integrity**: `npx cucumber-js tests/features/release-evidence.feature --tags @mcp-release-integrity` passes (7 scenarios, 69 steps).
6. **OMP Manager Dogfood**: Real OMP discovery probe confirms connected server, toolCount=10, preview without byte change, and atomic apply.
