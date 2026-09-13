# Schema

Status: DRAFT

## Protocol envelope (extends spec-kernel@1 → spec-kernel@2)

QueryEnvelope gains two optional fields (major bump `spec-kernel@2`: `@1` callers stay parseable, but the scope-resolution rule is new protocol behavior, so the bump is honest, not cosmetic):

```json
{ "project": "stgmt/omp-spec-kit", "identity": "stigm" }
```

`project` is the composite `owner/project` scope — an ordinary call parameter checked against the caller's `token → tenant → allowed-projects` set (outside the set → refused outright). Absent → the token's configured default scope; refused when the token has no default or the allowed set is ambiguous. Exception: listing ops (`spec_registry`, `spec_drift`) treat absent `project` as "all scopes in my allowed set". `spec`/slug is always explicit on targeted ops — never inferred.

`identity` is the asserted caller label (`X-Spec-Author` header equivalent): recorded in commit trailers + access log, **not trusted** — the token proves tenant, not user. Callers hold no identity beyond the token. All other envelope fields unchanged; existing error codes reused (`CONFLICT`, `VALIDATION_FAILED`, `PATH_FORBIDDEN`, `ELICITATION_REQUIRED`, `INTERNAL_ERROR`) plus:

```json
"CLAIM_HELD"      // spec is claimed by another identity; error.holder, error.expiresAt
"UNAVAILABLE"     // service cannot reach the project worktree; retryable: true
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

## Stores (service-owned, SQLite)

```sql
tenants(id TEXT PRIMARY KEY, token_hash TEXT UNIQUE,
        allowed_scopes TEXT,          -- JSON array of "owner/project" (or "owner/*")
        created_at TEXT, revoked_at TEXT)

claims(spec_key TEXT PRIMARY KEY,  -- "owner/project/slug"
       holder TEXT, expires_at TEXT, created_at TEXT)

ledger(spec_key TEXT, version TEXT,  -- PK (spec_key, version)
       digest TEXT, commit_sha TEXT, published_at TEXT)

access_log(id INTEGER PRIMARY KEY, ts TEXT, identity TEXT,
           project TEXT, op TEXT, spec TEXT, request_id TEXT, result TEXT)
```

## Project config (compose)

```jsonc
// config/projects.json — registry of scopes inside the single specs repo
{ "schema": "registry-projects@1",
  "specsRepo": { "url": "https://github.com/stgmt/spec-database.git", "branch": "main",
                 "clone": "/data/specs-repo" },
  "projects": [{ "id": "stgmt/omp-spec-kit" }, { "id": "acme/billing" }] }
```

## Spec pack manifest (generated at publish, never authored)

```jsonc
{ "schema": "spec-pack@1", "slug": "...", "project": "owner/project",
  "version": "x.y.z", "digest": "sha256:...", "commit": "...",
  "status": "ACTIVE", "requires": [{"slug": "...", "range": "..."}],
  "publishedAt": "...", "attestation": "..." }
```
