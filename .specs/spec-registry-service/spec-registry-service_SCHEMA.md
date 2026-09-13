# Schema

Status: DRAFT

## Protocol envelope (extends spec-kernel@1 → spec-kernel@2)

QueryEnvelope gains one optional field:

```json
{ "project": "omp-spec-kit" }
```

Absent → caller's bound default project. All other envelope fields unchanged; existing error codes reused (`CONFLICT`, `VALIDATION_FAILED`, `PATH_FORBIDDEN`, `ELICITATION_REQUIRED`, `INTERNAL_ERROR`) plus:

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
{ "project": "a" }   // optional; absent → all projects the caller may see
// → { ok, data: { projects: [{ id, specs: [{ slug, status, version, digest, owner, claim, published, updatedAt }] }] } }

// spec_drift
{ "project": "a" }
// → { ok, data: { events: [{ commit, author, divergentPaths, detectedAt }] } }
```

## Stores (service-owned, SQLite)

```sql
claims(spec_key TEXT PRIMARY KEY,  -- "project/slug"
       holder TEXT, expires_at TEXT, created_at TEXT)

ledger(spec_key TEXT, version TEXT,  -- PK (spec_key, version)
       digest TEXT, commit_sha TEXT, published_at TEXT)

access_log(id INTEGER PRIMARY KEY, ts TEXT, identity TEXT,
           project TEXT, op TEXT, spec TEXT, request_id TEXT, result TEXT)
```

## Consumer pin file (committed in product repos)

```jsonc
// spec-refs.json
{ "schema": "spec-refs@1",
  "specs": { "plugin-distribution": { "version": "1.4.0", "digest": "sha256:..." } } }
```

## Project config (compose)

```jsonc
// config/projects.json
{ "schema": "registry-projects@1",
  "projects": [{ "id": "kebab-id", "repo": "clone-url",
                 "branch": "specs", "worktree": "/data/worktrees/<id>" }] }
```

## Spec pack manifest (generated at publish, never authored)

```jsonc
{ "schema": "spec-pack@1", "slug": "...", "project": "...",
  "version": "x.y.z", "digest": "sha256:...", "commit": "...",
  "status": "ACTIVE", "requires": [{"slug": "...", "range": "..."}],
  "publishedAt": "...", "attestation": "..." }
```
