# Host setup matrix — 3.0.7

Release `v3.0.7` (peeled tag recorded in the GitHub release). This matrix
records the host checks that actually ran in 3.0.7. It does not claim a live
session for a host whose account or CLI blocked the run.

| Host | Setup warning | `.specs` boundary | MCP transport | Verification level |
|---|---|---|---|---|
| Claude Code | `SessionStart` emits one bounded warning; silent for a configured hosted project | `PreToolUse` blocks raw `.specs` access | `type: "http"` in the packaged `.mcp.json` | real hook process (`tests/claude/hook.test.mjs`), CI `verify` plugin job |
| Codex | `SessionStart` adapter reads `~/.codex/config.toml` + guard; silent when the registry is remote | `PreToolUse` guard | `[mcp_servers.spec_registry]` with `url` | adapter-level (`tests/codex/hook.test.mjs`); a live `codex exec` was attempted but the local ChatGPT account rejected `gpt-6.1-terra`, `gpt-5.2`, and `gpt-5.1-codex` with `model_not_found`, so no Codex session transcript is claimed |
| OpenCode | `session.created` re-arms, `chat.message` injects the warning part once; silent when `opencode.json` has the remote server | `tool.execute.before` guard | `mcp.<server>.type = "remote"` | **live** `opencode run` 1.19.3, configured project: direct `.specs` read blocked with `SPEC_READ_REDIRECT`; `spec_catalog` over MCP returned 10 specs. This run caught the `.mjs` loader gap; 3.0.7 installs `.js` bridges and the installed bridge is covered by `tests/unit/service/opencode-loader.test.mjs` |
| OMP 18.14.1 | `session_start` handler calls `pi.sendMessage` with the typed setup message; silent when the project is configured | `tool_call` enforcement handler | packaged `.mcp.json` (hosted) | **live** `omp -p` 18.14.1, configured project: direct `read` of `.specs/...` returned `SPEC_READ_REDIRECT`; `spec_catalog` returned 10 specs. Print mode does not surface the setup-required custom message, so that half remains adapter/BDD-level (`tests/unit/service/setup-warning.test.mjs`) |

## Guard conflicts

`skills/spec-stack-setup/setup.mjs` treats an existing global agent config that
points at another registry as a **reported skip** with the installer's reason.
The guard still refuses to overwrite the other stack; the demo-stack setup no
longer fails phases 9/10 because of an operator configuration it does not own.
Covered by `tests/unit/service/stack-guards.test.mjs`.

## Delivery

The six `youtrack-spec-delivery` acceptance scenarios run through Cucumber
against the live compose stack (`npm run test:delivery-live`): placement,
setup health, a second user on the shared dashboard, upgrade preservation, demo
load/delete, and the agent warning. The release workflow runs the suite after
`tool:e2e:live`.

## Scope note

OpenCode and OMP now have recorded live guard/MCP sessions. Codex remains
adapter-level because the local CLI account cannot run a model. P12-9 is
therefore **not** a complete four-host live matrix: three hosts have a real
execution (Claude hook process, OpenCode and OMP CLI sessions), one is blocked
by the host account. No transcript is fabricated.
