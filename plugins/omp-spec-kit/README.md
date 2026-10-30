# omp-spec-kit

`omp-spec-kit` gives Oh My Pi (OMP) and Claude Code a bounded view of a project's specifications through exactly 10 task-oriented MCP tools: 9 bounded read-only tools (`mcp_preflight`, `spec_catalog`, `spec_entities`, `spec_graph`, `spec_documents`, `spec_inspect`, `spec_tasks`, `spec_evidence`, `spec_markdown`) and one transactional patch tool, `spec_patch`. Only a hash-checked `spec_patch` apply with `dryRun: false` can write specification bytes.

## Install

OMP, at project scope:

```text
omp plugin marketplace add stgmt/omp-spec-kit
omp plugin install omp-spec-kit@omp-spec-kit --scope project
```

Restart OMP in the target project.

Claude Code 2.1.292 or newer:

```text
/plugin marketplace add stgmt/omp-spec-kit
/plugin install omp-spec-kit@omp-spec-kit
/reload-plugins
```

Both hosts read the same payload from the single catalog `.claude-plugin/marketplace.json`. Update an OMP project install with `omp plugin upgrade omp-spec-kit@omp-spec-kit --scope project`, then restart OMP.

## Use

MCP tools read the project from which the host session starts; the packaged server locates only its own code and does not select the data root. `OMP_SPEC_KIT_ROOT` is optional diagnostic configuration: only an explicit absolute value is accepted, and a missing, relative, placeholder, or bare variable name leaves the active project as the root.

Every MCP `QueryEnvelope` includes `provenance` with the fixed server name, opaque resolved/active root IDs, `rootMode`, and `matchesActiveProject`. An explicit absolute override is allowed for diagnostics but is reported as `explicit-absolute-override` with `matchesActiveProject: false`; absolute paths and environment values are never returned.

The payload ships three skills: `spec-inventory` (lists specifications through `spec_catalog`), `spec-elicitation` (source and gap assessment before the first specification write), and `engineering-anti-bike`. The skills are guidance only and implement no scanner or runtime of their own.

In Claude Code, a `PreToolUse` hook blocks direct reads and writes of `.specs`. It is a barrier, not a sandbox: Bash-level checks are regex based.

## Remote mode

The shipped `.mcp.json` declares the registry endpoint, not a local server. Set the environment
before the host starts:

- `OMP_SPEC_REGISTRY_URL` — the registry `/mcp` endpoint (for example `http://127.0.0.1:8650/mcp`)
- `OMP_SPEC_REGISTRY_TOKEN` — the caller's verified YouTrack token
- `OMP_SPEC_PROJECT` — `owner/project` for scoped tokens

There is no stdio fallback and no local corpus: a host that cannot expand these placeholders does
not connect, which is deliberate. The bundled `dist/mcp/server.js` runs inside the registry image;
it is not a host launch path. `scripts/probe-managed-remote.mjs` proves the managed resolution.

On hosts with a global HTTP proxy, add the endpoint host to `NO_PROXY` (`127.0.0.1,localhost` for a
local stack): the runtime routes HTTP through the proxy otherwise and the connection times out.

## Advisory

v0.3.0 MCP results can use package cwd rather than active project cwd. See [the advisory](../../docs/advisories/v0.3.0-mcp-root.md); current releases are not affected.

License: MIT.
