# Host setup matrix — 3.0.0

Release `v3.0.0` (peeled `52d2324deaedb199ee185e9230b35aebaf2ed790`).
This matrix records the host checks that actually ran; it does not claim a live
session for a host whose session hook was exercised through its API contract.

| Host | Setup warning | `.specs` boundary | MCP transport | Evidence |
|---|---|---|---|---|
| Claude Code | `SessionStart` emits one bounded warning; silent for a configured hosted project | `PreToolUse` blocks raw `.specs` access | `type: "http"` in the packaged `.mcp.json` | `tests/claude/hook.test.mjs`; CI `verify` plugin job (`41207833845`) |
| Codex | `SessionStart` adapter reads `~/.codex/config.toml` + guard; silent when the registry is remote | `PreToolUse` guard | `[mcp_servers.spec_registry]` with `url` | `tests/codex/hook.test.mjs`; CI `verify` plugin job |
| OpenCode | `session.created` re-arms, `chat.message` injects the warning part; silent when `opencode.json` has the remote server | `tool.execute.before` guard | `mcp.<server>.type = "remote"` | `tests/opencode/hook.test.mjs`; CI `verify` plugin job |
| OMP 18.0.11 | `session_start` handler calls `pi.sendMessage` with the typed setup message; silent when the project is configured | `tool_call` enforcement handler | packaged `.mcp.json` (hosted) / stdio archive smoke | `tests/unit/service/setup-warning.test.mjs`; `test:safe-authoring` OMP manager E2E in release run `41209753044` |

## Scope note

The OMP row proves registration against the pinned `session_start` API and the
typed message payload, not a recorded interactive OMP session transcript. The
pinned runtime's extension types define `SessionStartEvent { type: "session_start" }`
and `pi.sendMessage(...)`; the release `test:safe-authoring` job proves the same
extension loads and registers its `tool_call` handler. A live interactive
session remains the only unrecorded step and is listed as such rather than
claimed.
