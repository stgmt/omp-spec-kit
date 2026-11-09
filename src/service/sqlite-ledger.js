import { randomUUID } from "node:crypto";
import { teamStoreError } from "./ledger-team-helpers.js";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS claims (
  spec_key TEXT PRIMARY KEY,
  holder TEXT,
  expires_at_ms INTEGER,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS ledger (
  spec_key TEXT,
  version TEXT,
  digest TEXT,
  commit_sha TEXT,
  published_at TEXT,
  PRIMARY KEY (spec_key, version)
);
CREATE TABLE IF NOT EXISTS access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT,
  login TEXT,
  role TEXT,
  tenant TEXT,
  project TEXT,
  op TEXT,
  spec TEXT,
  request_id TEXT,
  result TEXT
);
CREATE TABLE IF NOT EXISTS repo_bindings (
  project TEXT PRIMARY KEY,
  repo_url TEXT NOT NULL,
  branch TEXT NOT NULL,
  status TEXT NOT NULL,
  bound_by TEXT,
  bound_at TEXT,
  migrated_from TEXT,
  migrated_from_branch TEXT,
  last_error TEXT,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS repo_credentials (
  project TEXT PRIMARY KEY,
  repo_url TEXT NOT NULL,
  token_enc TEXT NOT NULL,
  username TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS project_registrations (
  project TEXT PRIMARY KEY,
  repo_url TEXT NOT NULL,
  branch TEXT NOT NULL,
  status TEXT NOT NULL,
  registered_by TEXT,
  registered_at TEXT,
  updated_at TEXT,
  phase TEXT,
  message TEXT,
  started_at TEXT,
  phase_started_at TEXT,
  finished_at TEXT
);
CREATE TABLE IF NOT EXISTS idp_bindings (
  tenant TEXT PRIMARY KEY,
  youtrack_url TEXT NOT NULL UNIQUE,
  projects TEXT NOT NULL,
  hub_groups TEXT NOT NULL,
  role_groups TEXT NOT NULL,
  default_project TEXT,
  bridge_token_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  bound_by TEXT,
  bound_at TEXT,
  last_error TEXT,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS idp_credentials (
  tenant TEXT PRIMARY KEY,
  service_token_enc TEXT NOT NULL,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS registry_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS team_records (
  team_id TEXT PRIMARY KEY,
  owner_principal TEXT NOT NULL,
  registration_project TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS team_spec_bindings (
  team_id TEXT NOT NULL,
  project TEXT NOT NULL,
  spec TEXT NOT NULL,
  linked_at TEXT NOT NULL,
  PRIMARY KEY (team_id, project, spec)
);
CREATE TABLE IF NOT EXISTS team_spec_requests (
  owner_principal TEXT NOT NULL,
  request_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  team_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (owner_principal, request_id)
);
CREATE TABLE IF NOT EXISTS team_task_bindings (
  project TEXT NOT NULL,
  spec TEXT NOT NULL,
  task_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  linked_at TEXT NOT NULL,
  PRIMARY KEY (project, spec, task_id)
);
`;

/**
 * Columns added after first release: CREATE TABLE IF NOT EXISTS never alters
 * an existing table, so the ledger gains its repo dimensions via ALTER when
 * they are missing (repo_url/branch tell versioned reads which clone owns a
 * recorded commit after a project migrated repos).
 */
function migrateLedger(db) {
  const columns = new Set(db.prepare("PRAGMA table_info(ledger)").all().map((row) => row.name));
  if (!columns.has("repo_url")) db.exec("ALTER TABLE ledger ADD COLUMN repo_url TEXT");
  if (!columns.has("repo_branch")) db.exec("ALTER TABLE ledger ADD COLUMN repo_branch TEXT");
  const bindingColumns = new Set(db.prepare("PRAGMA table_info(repo_bindings)").all().map((row) => row.name));
  if (!bindingColumns.has("migrated_from_branch")) db.exec("ALTER TABLE repo_bindings ADD COLUMN migrated_from_branch TEXT");
  const credentialColumns = new Set(db.prepare("PRAGMA table_info(repo_credentials)").all().map((row) => row.name));
  if (!credentialColumns.has("repo_url")) db.exec("ALTER TABLE repo_credentials ADD COLUMN repo_url TEXT");
  // Registrations gained their progress columns after the first deploy of the
  // table: a registration that outlives a client timeout has to say what it is
  // doing, so the row carries phase and timing.
  const registrationColumns = new Set(db.prepare("PRAGMA table_info(project_registrations)").all().map((row) => row.name));
  for (const column of ["phase", "message", "started_at", "phase_started_at", "finished_at"]) {
    if (!registrationColumns.has(column)) db.exec(`ALTER TABLE project_registrations ADD COLUMN ${column} TEXT`);
  }
}

export class SqliteStore {
  constructor(db) {
    this.db = db;
    this.driver = "sqlite";
  }

  getSecurityStoreId() {
    this.db.prepare("INSERT OR IGNORE INTO registry_metadata (key, value) VALUES (?, ?)").run("securityStoreId", randomUUID());
    const value = this.db.prepare("SELECT value FROM registry_metadata WHERE key = ?").get("securityStoreId")?.value;
    if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value)) {
      throw teamStoreError("TEAM_STORE_UNAVAILABLE", "registry security store identity is invalid");
    }
    return value;
  }

  #teamTransaction(run) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = run();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      try { this.db.exec("ROLLBACK"); } catch {}
      throw error;
    }
  }

  #teamRecord(teamId) {
    const row = this.db.prepare("SELECT team_id, owner_principal, registration_project, created_at FROM team_records WHERE team_id = ?").get(teamId);
    return row ? { teamId: row.team_id, ownerPrincipal: row.owner_principal, registrationProject: row.registration_project, createdAt: row.created_at } : null;
  }

  #teamBindings(teamId) {
    return this.db.prepare("SELECT project, spec FROM team_spec_bindings WHERE team_id = ? ORDER BY project, spec")
      .all(teamId).map(({ project, spec }) => ({ project, spec }));
  }

  #teamRequest(ownerPrincipal, requestId, payload) {
    const row = this.db.prepare("SELECT payload, team_id FROM team_spec_requests WHERE owner_principal = ? AND request_id = ?").get(ownerPrincipal, requestId);
    if (!row) return null;
    if (row.payload !== payload) throw teamStoreError("TEAM_REQUEST_ID_REUSED", "requestId was already used for a different team-spec operation");
    return { teamId: row.team_id };
  }
  static async open(file) {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(file);
    db.exec(SCHEMA_SQL);
    migrateLedger(db);
    return new SqliteStore(db);
  }

  getClaim(key) {
    const row = this.db.prepare("SELECT spec_key, holder, expires_at_ms, created_at FROM claims WHERE spec_key = ?").get(key);
    return row ? { specKey: row.spec_key, holder: row.holder, expiresAtMs: Number(row.expires_at_ms), createdAt: row.created_at } : null;
  }

  putClaim(record) {
    this.db.prepare(
      "INSERT INTO claims (spec_key, holder, expires_at_ms, created_at) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT(spec_key) DO UPDATE SET holder = excluded.holder, expires_at_ms = excluded.expires_at_ms",
    ).run(record.specKey, record.holder, record.expiresAtMs, record.createdAt ?? new Date().toISOString());
  }

  deleteClaim(key) {
    this.db.prepare("DELETE FROM claims WHERE spec_key = ?").run(key);
  }

  listClaims() {
    return this.db.prepare("SELECT spec_key, holder, expires_at_ms, created_at FROM claims").all()
      .map((row) => ({ specKey: row.spec_key, holder: row.holder, expiresAtMs: Number(row.expires_at_ms), createdAt: row.created_at }));
  }

  appendLedger(entry) {
    this.db.prepare(
      "INSERT INTO ledger (spec_key, version, digest, commit_sha, published_at, repo_url, repo_branch) VALUES (?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(spec_key, version) DO UPDATE SET digest = excluded.digest, commit_sha = excluded.commit_sha, published_at = excluded.published_at, repo_url = excluded.repo_url, repo_branch = excluded.repo_branch",
    ).run(entry.specKey, entry.version, entry.digest, entry.commitSha ?? null, entry.publishedAt ?? new Date().toISOString(), entry.repoUrl ?? null, entry.repoBranch ?? null);
  }

  /**
   * Publish-path insert: a recorded publication is immutable evidence, so an
   * existing (spec_key, version) row is never overwritten — unlike appendLedger
   * the conflicting row wins and false is returned for the caller to compare.
   */
  insertLedgerIfAbsent(entry) {
    const info = this.db.prepare(
      "INSERT INTO ledger (spec_key, version, digest, commit_sha, published_at, repo_url, repo_branch) VALUES (?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(spec_key, version) DO NOTHING",
    ).run(entry.specKey, entry.version, entry.digest, entry.commitSha ?? null, entry.publishedAt ?? new Date().toISOString(), entry.repoUrl ?? null, entry.repoBranch ?? null);
    return Number(info.changes) === 1;
  }

  getLedger(specKey) {
    return this.db.prepare("SELECT spec_key, version, digest, commit_sha, published_at, repo_url, repo_branch FROM ledger WHERE spec_key = ? ORDER BY published_at DESC").all(specKey)
      .map((row) => ({ specKey: row.spec_key, version: row.version, digest: row.digest, commitSha: row.commit_sha, publishedAt: row.published_at, repoUrl: row.repo_url, repoBranch: row.repo_branch }));
  }

  putBinding(binding) {
    this.db.prepare(
      "INSERT INTO repo_bindings (project, repo_url, branch, status, bound_by, bound_at, migrated_from, migrated_from_branch, last_error, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(project) DO UPDATE SET repo_url = excluded.repo_url, branch = excluded.branch, status = excluded.status, " +
      "bound_by = excluded.bound_by, bound_at = excluded.bound_at, migrated_from = excluded.migrated_from, migrated_from_branch = excluded.migrated_from_branch, last_error = excluded.last_error, updated_at = excluded.updated_at",
    ).run(
      binding.project, binding.repoUrl, binding.branch, binding.status,
      binding.boundBy ?? null, binding.boundAt ?? null, binding.migratedFrom ?? null, binding.migratedFromBranch ?? null,
      binding.lastError ?? null, binding.updatedAt ?? new Date().toISOString(),
    );
  }

  #bindingRow(row) {
    return row ? { project: row.project, repoUrl: row.repo_url, branch: row.branch, status: row.status, boundBy: row.bound_by, boundAt: row.bound_at, migratedFrom: row.migrated_from, migratedFromBranch: row.migrated_from_branch, lastError: row.last_error, updatedAt: row.updated_at } : null;
  }

  getBinding(project) {
    return this.#bindingRow(this.db.prepare("SELECT * FROM repo_bindings WHERE project = ?").get(project));
  }

  listBindings() {
    return this.db.prepare("SELECT * FROM repo_bindings").all().map((row) => this.#bindingRow(row));
  }

  deleteBinding(project) {
    this.db.prepare("DELETE FROM repo_bindings WHERE project = ?").run(project);
  }

  putRegistration(registration) {
    this.db.prepare(
      "INSERT INTO project_registrations (project, repo_url, branch, status, registered_by, registered_at, updated_at, phase, message, started_at, phase_started_at, finished_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(project) DO UPDATE SET repo_url = excluded.repo_url, branch = excluded.branch, status = excluded.status, " +
      "registered_by = excluded.registered_by, updated_at = excluded.updated_at, phase = excluded.phase, message = excluded.message, " +
      "started_at = excluded.started_at, phase_started_at = excluded.phase_started_at, finished_at = excluded.finished_at",
    ).run(
      registration.project, registration.repoUrl, registration.branch, registration.status,
      registration.registeredBy ?? null, registration.registeredAt ?? new Date().toISOString(), new Date().toISOString(),
      registration.phase ?? null, registration.message ?? null, registration.startedAt ?? null,
      registration.phaseStartedAt ?? null, registration.finishedAt ?? null,
    );
  }

  /** Merge a progress patch into an existing registration row. */
  updateRegistration(project, patch) {
    const current = this.getRegistration(project);
    if (current === null) return null;
    const next = { ...current, ...patch };
    this.putRegistration(next);
    return next;
  }

  #registrationRow(row) {
    return row
      ? {
        project: row.project, repoUrl: row.repo_url, branch: row.branch, status: row.status,
        registeredBy: row.registered_by, registeredAt: row.registered_at, updatedAt: row.updated_at,
        phase: row.phase ?? null, message: row.message ?? null, startedAt: row.started_at ?? null,
        phaseStartedAt: row.phase_started_at ?? null, finishedAt: row.finished_at ?? null,
      }
      : null;
  }

  getRegistration(project) {
    return this.#registrationRow(this.db.prepare("SELECT * FROM project_registrations WHERE project = ?").get(project));
  }

  listRegistrations({ registeredBy = null } = {}) {
    const rows = registeredBy === null
      ? this.db.prepare("SELECT * FROM project_registrations").all()
      : this.db.prepare("SELECT * FROM project_registrations WHERE registered_by = ?").all(registeredBy);
    return rows.map((row) => this.#registrationRow(row));
  }

  deleteRegistration(project) {
    this.db.prepare("DELETE FROM project_registrations WHERE project = ?").run(project);
  }

  putCredential(project, { repoUrl, tokenEnc, username }) {
    this.db.prepare(
      "INSERT INTO repo_credentials (project, repo_url, token_enc, username, created_at) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT(project) DO UPDATE SET repo_url = excluded.repo_url, token_enc = excluded.token_enc, username = excluded.username",
    ).run(project, repoUrl ?? null, tokenEnc, username ?? null, new Date().toISOString());
  }

  getCredential(project) {
    const row = this.db.prepare("SELECT repo_url, token_enc, username FROM repo_credentials WHERE project = ?").get(project);
    return row ? { repoUrl: row.repo_url, tokenEnc: row.token_enc, username: row.username } : null;
  }

  deleteCredential(project) {
    this.db.prepare("DELETE FROM repo_credentials WHERE project = ?").run(project);
  }

  putIdpBinding(binding) {
    this.db.prepare(
      "INSERT INTO idp_bindings (tenant, youtrack_url, projects, hub_groups, role_groups, default_project, bridge_token_hash, status, bound_by, bound_at, last_error, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(tenant) DO UPDATE SET youtrack_url = excluded.youtrack_url, projects = excluded.projects, hub_groups = excluded.hub_groups, " +
      "role_groups = excluded.role_groups, default_project = excluded.default_project, bridge_token_hash = excluded.bridge_token_hash, " +
      "status = excluded.status, bound_by = excluded.bound_by, bound_at = excluded.bound_at, last_error = excluded.last_error, updated_at = excluded.updated_at",
    ).run(
      binding.tenant, binding.youtrackUrl, JSON.stringify(binding.projects), JSON.stringify(binding.hubGroups), JSON.stringify(binding.roleGroups),
      binding.defaultProject ?? null, binding.bridgeTokenHash, binding.status,
      binding.boundBy ?? null, binding.boundAt ?? null, binding.lastError ?? null, binding.updatedAt ?? new Date().toISOString(),
    );
  }

  #idpBindingRow(row) {
    if (!row) return null;
    return {
      tenant: row.tenant, youtrackUrl: row.youtrack_url,
      projects: JSON.parse(row.projects), hubGroups: JSON.parse(row.hub_groups), roleGroups: JSON.parse(row.role_groups),
      defaultProject: row.default_project, bridgeTokenHash: row.bridge_token_hash, status: row.status,
      boundBy: row.bound_by, boundAt: row.bound_at, lastError: row.last_error, updatedAt: row.updated_at,
    };
  }

  getIdpBinding(tenant) {
    return this.#idpBindingRow(this.db.prepare("SELECT * FROM idp_bindings WHERE tenant = ?").get(tenant));
  }

  getIdpBindingByUrl(youtrackUrl) {
    return this.#idpBindingRow(this.db.prepare("SELECT * FROM idp_bindings WHERE youtrack_url = ?").get(youtrackUrl));
  }

  listIdpBindings() {
    return this.db.prepare("SELECT * FROM idp_bindings").all().map((row) => this.#idpBindingRow(row));
  }

  deleteIdpBinding(tenant) {
    this.db.prepare("DELETE FROM idp_bindings WHERE tenant = ?").run(tenant);
  }

  putIdpCredential(tenant, { serviceTokenEnc }) {
    this.db.prepare(
      "INSERT INTO idp_credentials (tenant, service_token_enc, created_at) VALUES (?, ?, ?) " +
      "ON CONFLICT(tenant) DO UPDATE SET service_token_enc = excluded.service_token_enc",
    ).run(tenant, serviceTokenEnc, new Date().toISOString());
  }

  getIdpCredential(tenant) {
    const row = this.db.prepare("SELECT service_token_enc FROM idp_credentials WHERE tenant = ?").get(tenant);
    return row ? { serviceTokenEnc: row.service_token_enc } : null;
  }

  deleteIdpCredential(tenant) {
    this.db.prepare("DELETE FROM idp_credentials WHERE tenant = ?").run(tenant);
  }

  getTeamSpecsTeam(teamId) {
    return this.#teamRecord(teamId);
  }

  listTeamSpecsBindings(teamId) {
    return this.#teamBindings(teamId);
  }
  listTeamSpecsTeamsForBinding({ project, spec }) {
    const rows = this.db.prepare(
      "SELECT binding.team_id, team.owner_principal FROM team_spec_bindings AS binding " +
      "LEFT JOIN team_records AS team ON team.team_id = binding.team_id " +
      "WHERE binding.project = ? AND binding.spec = ? ORDER BY binding.team_id",
    ).all(project, spec);
    return rows.map((row) => {
      if (typeof row.owner_principal !== "string") {
        throw teamStoreError("TEAM_REGISTRY_CORRUPT", `team spec binding has no team record: ${row.team_id}`);
      }
      return { teamId: row.team_id, ownerPrincipal: row.owner_principal };
    });
  }


  getTeamSpecsTaskBinding({ project, spec, taskId }) {
    const row = this.db.prepare(
      "SELECT project, spec, task_id, team_id, linked_at FROM team_task_bindings WHERE project = ? AND spec = ? AND task_id = ?",
    ).get(project, spec, taskId);
    return row ? { project: row.project, spec: row.spec, taskId: row.task_id, teamId: row.team_id, linkedAt: row.linked_at } : null;
  }
  listTeamSpecsTaskBindings({ teamId, project, spec }) {
    return this.db.prepare(
      "SELECT project, spec, task_id, team_id, linked_at FROM team_task_bindings " +
      "WHERE team_id = ? AND project = ? AND spec = ? ORDER BY task_id",
    ).all(teamId, project, spec).map((row) => ({
      project: row.project,
      spec: row.spec,
      taskId: row.task_id,
      teamId: row.team_id,
      linkedAt: row.linked_at,
    }));
  }


  applyTeamSpecsTaskBindings({ action, bindings }) {
    if (!Array.isArray(bindings)) throw teamStoreError("TEAM_ACTION_INVALID", "team task bindings must be an array");
    return this.#teamTransaction(() => {
      for (const binding of bindings) {
        const team = this.#teamRecord(binding.teamId);
        if (!team || team.ownerPrincipal !== binding.ownerPrincipal) {
          throw teamStoreError("TEAM_ACCESS_DENIED", "team task binding is not authorized for this authenticated principal");
        }
        const existing = this.getTeamSpecsTaskBinding(binding);
        if (action === "bind") {
          if (binding.requireUnambiguous === true) {
            const candidates = this.listTeamSpecsTeamsForBinding(binding);
            if (candidates.length !== 1 || candidates[0].teamId !== binding.teamId) {
              throw teamStoreError("TEAM_ID_REQUIRED", "the team selection is no longer unambiguous for this project/spec");
            }
          }
          if (!this.#teamBindings(binding.teamId).some((item) => item.project === binding.project && item.spec === binding.spec)) {
            throw teamStoreError("TEAM_SPEC_NOT_LINKED", `team is not linked to ${binding.project}/${binding.spec}`);
          }
          if (existing && existing.teamId !== binding.teamId) {
            throw teamStoreError("TEAM_TASK_ACCESS_DENIED", `task is already owned by another team: ${binding.project}/${binding.spec}/${binding.taskId}`);
          }
          this.db.prepare(
            "INSERT OR IGNORE INTO team_task_bindings (project, spec, task_id, team_id, linked_at) VALUES (?, ?, ?, ?, ?)",
          ).run(binding.project, binding.spec, binding.taskId, binding.teamId, binding.createdAt);
        } else if (action === "unlink") {
          if (existing && existing.teamId !== binding.teamId) {
            throw teamStoreError("TEAM_TASK_ACCESS_DENIED", `task is already owned by another team: ${binding.project}/${binding.spec}/${binding.taskId}`);
          }
          this.db.prepare("DELETE FROM team_task_bindings WHERE project = ? AND spec = ? AND task_id = ? AND team_id = ?")
            .run(binding.project, binding.spec, binding.taskId, binding.teamId);
        } else {
          throw teamStoreError("TEAM_ACTION_INVALID", `unsupported team task binding action: ${String(action)}`);
        }
      }
      return bindings.map((binding) => this.getTeamSpecsTaskBinding(binding)).filter(Boolean);
    });
  }

  getTeamSpecsRequest({ ownerPrincipal, requestId, payload }) {
    const existing = this.#teamRequest(ownerPrincipal, requestId, payload);
    if (!existing) return null;
    const team = this.#teamRecord(existing.teamId);
    if (!team || team.ownerPrincipal !== ownerPrincipal) {
      throw teamStoreError("TEAM_REGISTRY_CORRUPT", "recorded team-spec request has no matching owner record");
    }
    return { teamId: existing.teamId };
  }

  registerTeamSpecsTeam({ teamId, ownerPrincipal, requestId, payload, project, createdAt }) {
    return this.#teamTransaction(() => {
      const existing = this.#teamRequest(ownerPrincipal, requestId, payload);
      if (existing) {
        const team = this.#teamRecord(existing.teamId);
        if (!team || team.ownerPrincipal !== ownerPrincipal) {
          throw teamStoreError("TEAM_REGISTRY_CORRUPT", "recorded registration has no matching owner record");
        }
        return { teamId: existing.teamId, bindings: this.#teamBindings(existing.teamId) };
      }

      this.db.prepare("INSERT INTO team_records (team_id, owner_principal, registration_project, created_at) VALUES (?, ?, ?, ?)")
        .run(teamId, ownerPrincipal, project, createdAt);
      this.db.prepare("INSERT INTO team_spec_requests (owner_principal, request_id, payload, team_id, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(ownerPrincipal, requestId, payload, teamId, createdAt);
      return { teamId, bindings: [] };
    });
  }

  applyTeamSpecsBinding({ teamId, ownerPrincipal, requestId, payload, action, project, spec, createdAt, allowedProjects }) {
    return this.#teamTransaction(() => {
      const team = this.#teamRecord(teamId);
      if (!team || team.ownerPrincipal !== ownerPrincipal) {
        throw teamStoreError("TEAM_ACCESS_DENIED", "team_specs access is not authorized for this authenticated principal");
      }
      const existing = this.#teamRequest(ownerPrincipal, requestId, payload);
      if (existing && existing.teamId !== teamId) {
        throw teamStoreError("TEAM_REQUEST_ID_REUSED", "requestId belongs to another team");
      }
      if (existing === null) {
        if (action === "link") {
          this.db.prepare("INSERT OR IGNORE INTO team_spec_bindings (team_id, project, spec, linked_at) VALUES (?, ?, ?, ?)")
            .run(teamId, project, spec, createdAt);
        } else if (action === "unlink") {
          const task = this.db.prepare(
            "SELECT task_id FROM team_task_bindings WHERE team_id = ? AND project = ? AND spec = ? LIMIT 1",
          ).get(teamId, project, spec);
          if (task) {
            throw teamStoreError("TEAM_TASKS_STILL_BOUND", `team spec ${project}/${spec} still has a bound task: ${task.task_id}`);
          }
          this.db.prepare("DELETE FROM team_spec_bindings WHERE team_id = ? AND project = ? AND spec = ?")
            .run(teamId, project, spec);
        } else {
          throw teamStoreError("TEAM_ACTION_INVALID", `unsupported team_specs binding action: ${String(action)}`);
        }
        this.db.prepare("INSERT INTO team_spec_requests (owner_principal, request_id, payload, team_id, created_at) VALUES (?, ?, ?, ?, ?)")
          .run(ownerPrincipal, requestId, payload, teamId, createdAt);
      }
      const bindings = this.#teamBindings(teamId);
      if (bindings.some((binding) => !allowedProjects.includes(binding.project))) {
        throw teamStoreError("PROJECT_NOT_ALLOWED", "one or more team bindings are outside the caller's allowed project set");
      }
      return { teamId, bindings };
    });
  }

  logAccess(entry) {
    this.db.prepare("INSERT INTO access_log (ts, login, role, tenant, project, op, spec, request_id, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(entry.ts ?? new Date().toISOString(), entry.login ?? null, entry.role ?? null, entry.tenant ?? null, entry.project ?? null, entry.op ?? null, entry.spec ?? null, entry.requestId ?? null, entry.result ?? null);
  }

  listAccess({ resultPrefix, limit = 50 } = {}) {
    return this.db.prepare("SELECT ts, login, role, tenant, project, op, spec, request_id, result FROM access_log WHERE result LIKE ? ORDER BY id DESC LIMIT ?")
      .all(`${resultPrefix}%`, limit)
      .map((row) => ({ ts: row.ts, login: row.login, role: row.role, tenant: row.tenant, project: row.project, op: row.op, spec: row.spec, requestId: row.request_id, result: row.result }));
  }

  close() {
    this.db.close();
  }
}
