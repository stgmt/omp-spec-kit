# Host setup matrix — 3.0.6

Release `v3.0.6` (peeled tag recorded in `docs/validation/release-status-*` and
the GitHub release). This matrix records the host checks that actually ran; it
does not claim a live session for a host whose hook was exercised through its
API contract.

| Host | Setup warning | `.specs` boundary | MCP transport | Verification level |
|---|---|---|---|---|
| Claude Code | `SessionStart` emits one bounded warning; silent for a configured hosted project | `PreToolUse` blocks raw `.specs` access | `type: "http"` in the packaged `.mcp.json` | real hook process (`tests/claude/hook.test.mjs`), CI `verify` plugin job |
| Codex | `SessionStart` adapter reads `~/.codex/config.toml` + guard; silent when the registry is remote | `PreToolUse` guard | `[mcp_servers.spec_registry]` with `url` | adapter-level (`tests/codex/hook.test.mjs`); no recorded interactive `codex` session |
| OpenCode | `session.created` re-arms, `chat.message` injects the warning part once; silent when `opencode.json` has the remote server | `tool.execute.before` guard | `mcp.<server>.type = "remote"` | adapter test + the live delivery Cucumber scenario (`SCEN-delivery-agent-warning`) exercises the real plugin object: one bounded part, no secret, silent afterwards and for a configured home; no recorded interactive `opencode` session |
| OMP 18.0.11 | `session_start` handler calls `pi.sendMessage` with the typed setup message; silent when the project is configured | `tool_call` enforcement handler | packaged `.mcp.json` (hosted) / stdio archive smoke | API-level (`tests/unit/service/setup-warning.test.mjs`) + real extension load in `test:safe-authoring`; no recorded interactive session |

## Guard conflicts

`skills/spec-stack-setup/setup.mjs` treats an existing global agent config that
points at another registry as a **reported skip** with the installer's reason.
The guard still refuses to overwrite the other stack; the demo-stack setup no
longer fails phases 9/10 because of an operator configuration it does not own.
The behavior is covered by `tests/unit/service/stack-guards.test.mjs`.

## Delivery

The six `youtrack-spec-delivery` acceptance scenarios run through Cucumber
against the live compose stack (`npm run test:delivery-live`): placement,
setup health, a second user on the shared dashboard, upgrade preservation, demo
load/delete, and the agent warning. The release workflow runs the suite after
`tool:e2e:live`.

## Scope note

Only the Claude row runs a real host process (the hook binary with a host-shaped
payload). Codex, OpenCode, and OMP rows prove the adapter/API contract and the
extension registration; they do not include a recorded interactive session.
P12-9 is therefore **adapter-level complete**, not a four-host live matrix.
This limitation is explicit: no host session transcript is fabricated.
