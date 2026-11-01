# Live host sessions — 3.0.8

Date: 2026-11-01
Registry: `http://127.0.0.1:8650/mcp`, project `stgmt/omp-spec-kit`
Probe: `.specs/p12-live/README.md` containing
`P12_LIVE_DIRECT_READ_SHOULD_BE_BLOCKED`.

## Codex 0.166.0

```text
npx -y @openai/codex@0.166.0 exec --skip-git-repo-check --json \
  --sandbox danger-full-access -c approval_policy="never" \
  -C <probe> -m gpt-6.1-terra
```

Prompt: read `.specs/p12-live/README.md` once, then call the spec-registry
`spec_catalog` MCP tool with `{view: "specs"}`.

Key events:

```text
Command blocked by PreToolUse hook: RAW_SPEC_WRITE: use spec_patch with dryRun: true ...
Command: Get-Content .specs/p12-live/README.md

{"type":"item.completed","item":{"type":"mcp_tool_call","server":"spec_registry",
 "tool":"spec_catalog","arguments":{"view":"specs"},"status":"completed"}}
... "specCount":10 ...

agent: - Чтение заблокировано хуком PreToolUse с ошибкой RAW_SPEC_WRITE.
       - spec_catalog успешно вернул 10 спецификаций.
```

The 0.166 CLI ignores exit code 2 when the hook emits JSON and fails open on a
bare exit 2. The hook emits both the legacy `decision: "block"` and the current
`hookSpecificOutput.permissionDecision: "deny"` shape and exits 0. Older Codex
(0.144) keeps the exit-2 path; `tests/codex/hook.test.mjs` covers both
versions at process level.

`SessionStart` with a temporary unconfigured home prints
`SPEC_SETUP_REQUIRED ... Missing: no .specs corpus ...; the registry MCP
endpoint/token is not configured for this host.` and stays silent for the
configured home. The installed hook tree must include `sessionstart.mjs`; the
0.166 installer writes it.

## OpenCode 1.19.3 and OMP 18.14.1

The live sessions are recorded in `docs/validation/host-live-v3.0.7.md`:

- OpenCode: `.specs` read blocked with `SPEC_HOOK_FAILED: SPEC_READ_REDIRECT`;
  `spec_catalog` returned 10 specs.
- OMP: `read` returned `SPEC_READ_REDIRECT` with `isError:true`;
  `mcp__omp_spec_kit_spec_catalog` returned 10 specs.

## Setup-required scope

Live warning transcripts exist for Claude (real hook) and Codex (real
SessionStart hook). OpenCode and OMP warnings are covered by the plugin-object
and delivery Cucumber tests; their print/automation sessions do not surface the
TUI custom message without an interactive host. No transcript is fabricated.
