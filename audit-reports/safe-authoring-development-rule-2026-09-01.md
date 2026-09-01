# Safe-authoring development verification rule

## Decision

Use a reusable development-time managed rule, not a new OMP runtime hook. The rule triggers when work mentions OMP, MCP authoring, `propose_patch`, `apply_proposed_patch`, specification mutation, release verification, or OMP E2E. It requires the candidate build, exact ten-tool census, safe-authoring scenarios, and real OMP manager handoff before reporting the change as working.

The rule does not change OMP execution semantics. The repository's real MCP server and the pinned OMP manager remain the executable proof.

## Grounded facts

| Claim | Evidence in pinned OMP 18.0.11 source | Consequence |
|---|---|---|
| A hook receives the tool name, call id, and input, but no session id | `C:/Users/stigm/.omp/plugins/node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/hooks/types.ts:306-316` | A development checklist must not invent session identity from a `tool_call` event. |
| Hook errors and explicit blocks throw before tool execution | `C:/Users/stigm/.omp/plugins/node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/hooks/tool-wrapper.ts:39-75` | A runtime hook would be fail-closed and could block development tools; the reusable rule stays outside the execution path. |
| Extension runner exposes the session id through `runner.sessionId` | `C:/Users/stigm/.omp/plugins/node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/extensions/runner.ts:641-643` | If a future runtime gate needs attribution, use the runner value, not event payload inference. |
| MCP tools are converted to OMP custom tools and the bridge formats returned content | `C:/Users/stigm/.omp/plugins/node_modules/@oh-my-pi/pi-coding-agent/src/mcp/tool-bridge.ts:188-214`, `:430-490` | The E2E must exercise `MCPManager`/`MCPTool.execute`, not only direct stdio requests. |
| Managed tool execution uses the MCP transport and returns formatted content | `C:/Users/stigm/.omp/plugins/node_modules/@oh-my-pi/pi-coding-agent/src/mcp/tool-bridge.ts:420-490` | Candidate authoring responses must be usable through OMP's content channel, not only `structuredContent`. |
| The manager connects configured servers and exposes loaded tools | `C:/Users/stigm/.omp/plugins/node_modules/@oh-my-pi/pi-coding-agent/src/mcp/manager.ts:436-440`, `:638-660` | The proof must assert the connected server, ten loaded tools, and successful managed calls. |

## Proof architecture

```text
matched development task
        |
        v
managed safe-authoring rule
        |
        +--> build + verify + exact ten-tool census
        +--> live safe-authoring BDD on disposable real corpus
        +--> pinned OMP 18.0.11 MCPManager handoff
                  |
                  +--> spec_overview through OMP
                  +--> propose_patch through OMP
                  +--> apply_proposed_patch through OMP
                  +--> inspect changed bytes and final graph
```

## Failure modes

| Failure | Required result |
|---|---|
| Missing or unknown OMP stage | Stop; do not select another tool profile. |
| Tool count or names drift | Stop; report the exact census mismatch. |
| Proposal succeeds but bytes change before apply | Stop; proposal test failed. |
| Stale or concurrent apply is accepted | Stop; require `CONFLICT` and unchanged concurrent bytes. |
| OMP manager cannot connect the verified package | Stop; no claim that the tools work in OMP. |
| OMP manager exposes tools but proposal/apply cannot complete | Stop; direct MCP success is insufficient. |
| Hook or manager call times out | Stop; preserve the bounded failure receipt. |
| Historical release tests conflict with the candidate | Keep historical fixtures immutable; report the candidate/release-suite mismatch rather than relabeling old proof. |

## Rejected alternatives

| Alternative | Rejection reason |
|---|---|
| Trust direct `server.js` tests as OMP proof | Bypasses the OMP manager bridge and would miss content/registration failures. |
| Add a new runtime hook solely to remind the developer | Changes the execution path and inherits fail-closed hook errors/timeouts. |
| Use a model turn as proof | Non-deterministic and does not prove the installed MCP manager route. |
| Reuse the old v0.3.2 corpus as current authoring proof | It is immutable historical ground truth and does not represent the current 45-document corpus. |
| Treat a passing parser or tools/list call as sufficient | Does not prove mutation, conflict, rollback, or resulting graph behavior. |

## Numbered probes

- З-1 (blocking before publication): obtain commit-bound GitHub artifact attestation and tag-time lifecycle receipts.
- З-2 (non-blocking for local development): verify OMP manager behavior on each supported host OS where the pinned runtime can be installed.

## Work order

1. Build the candidate and verify the package.
2. Run the exact v0.4.0 ten-tool census.
3. Run safe-authoring edge/mutation scenarios on disposable real bytes.
4. Run the pinned OMP 18.0.11 manager handoff and execute overview, proposal, and apply through OMP.
5. Report publication only after tag-bound evidence and the canonical release suite pass.

## Acceptance scenarios

- Exact ten-tool inventory contains only the eight reads plus the two public mutation tools.
- Empty, malformed, unsupported, duplicate-target, bad-fingerprint, unknown-document, and cross-spec proposals refuse without byte or staging residue.
- One same-spec proposal can change three documents atomically and leaves a valid graph.
- Simultaneous applies produce one `APPLIED` result and one `CONFLICT` refusal; final bytes contain one generation only.
- Raw spec paths, absolute paths, empty/NUL targets, junction paths, and same-name unauthorised calls fail closed.
- OMP 18.0.11 connects the verified package, exposes ten tools, and completes `spec_overview` -> `propose_patch` -> `apply_proposed_patch` against the disposable 45-document corpus.
- The development rule is loaded for future OMP safe-authoring and release work, so the OMP E2E proof cannot be omitted silently.
