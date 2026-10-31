# Schema

Status: DRAFT

## Protocol envelope (extends spec-kernel@1 → spec-kernel@2)

QueryEnvelope gains one optional field (major bump `spec-kernel@2`: `@1` callers stay parseable, but the scope-resolution rule is new protocol behavior, so the bump is honest, not cosmetic):

```json
{ "project": "stgmt/omp-spec-kit" }
```

`project` is the composite `owner/project` scope — an ordinary call parameter checked against the caller's `user → groups → tenant → allowed-projects` set (outside the set → refused outright). Absent → the caller's configured default scope, which exists only when exactly one tenant matched the user's groups; otherwise refused and `project` must be explicit. Multiple tenant matches union their scopes. Exception: listing ops (`spec_registry`, `spec_drift`) treat absent `project` as "all scopes in my allowed set". `spec`/slug is always explicit on targeted ops — never inferred.

`identity` (the old asserted `X-Spec-Author` equivalent) is **retired**: callers hold no identity beyond their verified YouTrack credential, the service records the verified login in commit trailers + access log, and any `identity`/`X-Spec-Author` value is ignored and logged as a warning. All other envelope fields unchanged; existing error codes reused (`CONFLICT`, `VALIDATION_FAILED`, `PATH_FORBIDDEN`, `ELICITATION_REQUIRED`, `INTERNAL_ERROR`) plus:

```json
"CLAIM_HELD"      // spec is claimed by another user; error.holder (login), error.expiresAt
"UNAVAILABLE"     // service cannot reach the project worktree, or YouTrack cannot verify the caller; retryable: true
"VERSION_EXISTS"  // publish attempted with a version already bound to a different digest
```

## New MCP ops (served alongside existing 9 + spec_patch)

```jsonc
// spec_claim
{ "project": "a", "spec": "slug", "ttlMinutes": 30 }
// → { ok, data: { spec, holder, expiresAt } }

// spec_release
{ "project": "a", "spec": "slug" }

// spec_registry — projected index
{ "project": "a" }   // optional; absent → all projects in the caller's allowed set (listing op)
// → { ok, data: { projects: [{ id, specs: [{ slug, status, version, digest, owner, claim, published, updatedAt }] }] } }

// spec_drift
{ "project": "a" }
// → { ok, data: { events: [{ commit, author, divergentPaths, detectedAt }] } }
```

## Stores

**Users, groups, roles, and tokens live only in YouTrack** — the service never stores or issues tokens (no `tenants` table). Tenant definitions and role-group mappings live in the operator config. The service keeps only:

```sql
-- SQLite (claims/ledger/access_log)

claims(spec_key TEXT PRIMARY KEY,  -- "owner/project/slug"
       holder TEXT,                -- verified YouTrack login
       expires_at TEXT, created_at TEXT)

ledger(spec_key TEXT, version TEXT,  -- PK (spec_key, version)
       digest TEXT, commit_sha TEXT, published_at TEXT)

access_log(id INTEGER PRIMARY KEY, ts TEXT, login TEXT, role TEXT,
           project TEXT, op TEXT, spec TEXT, request_id TEXT, result TEXT)
```

Verification cache (token hash → verified user + groups + role) is **in-memory only**, TTL 60 s (`SPEC_REGISTRY_AUTH_CACHE_MS`); it is not persisted — a restart re-verifies against YouTrack.

## Project config (compose)

```jsonc
// config/projects.json — registry of scopes inside the single specs repo + auth
{ "schema": "registry-projects@1",
  "specsRepo": { "url": "https://github.com/stgmt/spec-database.git", "branch": "main",
                 "clone": "/data/specs-repo" },
  "projects": [{ "id": "stgmt/omp-spec-kit" }, { "id": "acme/billing" }],
  "tenants": [
    { "tenant": "stgmt", "projects": ["stgmt/omp-spec-kit"],
      "hubGroups": ["spec-stgmt"], "defaultProject": "stgmt/omp-spec-kit" }
  ],
  "auth": {
    "youtrack": { "baseUrl": "https://youtrack.example.com",
                  "serviceToken": "<service account permanent token>" },
    "appBridge": { "token": "<secret shared with the YouTrack app>" },
    "roleGroups": { "owner": ["spec-owners"], "writer": ["spec-writers"], "reader": ["spec-readers"] }
  }
}
```

## Spec pack manifest (generated at publish, never authored)

```jsonc
{ "schema": "spec-pack@1", "slug": "...", "project": "owner/project",
  "version": "x.y.z", "digest": "sha256:...", "commit": "...",
  "status": "ACTIVE", "requires": [{"slug": "...", "range": "..."}],
  "publishedAt": "...", "attestation": "..." }
```
