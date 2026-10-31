# File Changes

Root JavaScript is the source of truth. The existing `src/v0.1/extension.js` remains the single extension factory, and `scripts/build-plugin.mjs` owns the bundled payload.

| Path | Action | State | Reason |
|---|---|---|---|
| `src/enforcement/decision.js` | create | planned | Exact two-name allowlist, closed decision matrix, four codes, and bounded redirect (FR-2, FR-4, FR-5) |
| `src/enforcement/resolve-targets.js` | create | planned | Canonical path and filesystem containment for existing and new targets (FR-3, FR-4) |
| `src/enforcement/register.js` | create | planned | Register one current `tool_call` handler on the supplied extension API (FR-1, FR-6) |
| `src/v0.1/extension.js` | edit | planned | Invoke `registerSpecEnforcement` once from the existing factory (FR-1, FR-6) |
| `scripts/build-plugin.mjs` | edit | planned | Bundle the three enforcement modules into the existing plugin artifact (FR-6) |
| `tests/enforcement/path-policy.test.js` | create | planned | Exact-name, decision precedence, bounded output, and side-effect checks (FR-2, FR-4, FR-5) |
| `tests/enforcement/containment.test.js` | create | planned | Separator, case, boundary, dot-segment, realpath, link, reparse, and new-target checks (FR-3) |
| `tests/enforcement/installed-policy.test.js` | create | planned | Dependency-absent one-factory installed smoke (FR-1, FR-6) |
| `.specs/spec-mcp-access-gate/fixtures/**` | create | planned | Real OMP call and cross-platform filesystem fixtures with provenance (FR-2 through FR-6) |

## Impact analysis

The change adds no public tool and no second writer. It only blocks non-allowlisted direct mutations when the resolved target is the canonical `.specs` tree or containment is indeterminate. Existing read-only v0.3.2 behavior and historical release receipts remain unchanged.

| src/enforcement/decision.js | extend | Apply the same closed resolver to read, search, shell, custom, and write-capable OMP calls |
| tests/enforcement/non-mcp-access.test.js | create | Real tool-call coverage for every supported bypass class |
| docs/validation/release-status-v0.6.0.json | reference | Pinned OMP source evidence and release proof |
