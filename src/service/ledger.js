import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Service-owned store (DESIGN "Authority split"): fields git cannot express
 * live here — claims, publish ledger, access events. Users, groups, and
 * tokens live only in YouTrack; the verification cache is in-memory (auth.js).
 * Driver:
 * `node:sqlite` when the runtime provides it, documented JSONL fallback
 * otherwise. Both drivers implement the same interface.
 */

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
}

class SqliteStore {
  constructor(db) {
    this.db = db;
    this.driver = "sqlite";
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

class JsonlStore {
  constructor(file, state) {
    this.file = file;
    this.state = state;
    this.driver = "jsonl";
  }

  static async open(file) {
    let state = { claims: [], ledger: [], access_log: [], repo_bindings: [], repo_credentials: [] };
    try {
      state = { ...state, ...JSON.parse(await readFile(file, "utf8")) };
    } catch {}
    return new JsonlStore(file, state);
  }

  async persist() {
    const tmp = `${this.file}.tmp`;
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFile(tmp, JSON.stringify(this.state, null, 2));
    await rename(tmp, this.file);
  }

  getClaim(key) {
    return this.state.claims.find((c) => c.specKey === key) ?? null;
  }

  putClaim(record) {
    const existing = this.state.claims.find((c) => c.specKey === record.specKey);
    if (existing) Object.assign(existing, record);
    else this.state.claims.push({ createdAt: new Date().toISOString(), ...record });
    return this.persist();
  }

  deleteClaim(key) {
    this.state.claims = this.state.claims.filter((c) => c.specKey !== key);
    return this.persist();
  }

  listClaims() {
    return [...this.state.claims];
  }

  appendLedger(entry) {
    const record = { publishedAt: new Date().toISOString(), ...entry };
    const existing = this.state.ledger.find((l) => l.specKey === entry.specKey && l.version === entry.version);
    if (existing) Object.assign(existing, record);
    else this.state.ledger.push(record);
    return this.persist();
  }

  async insertLedgerIfAbsent(entry) {
    const existing = this.state.ledger.find((l) => l.specKey === entry.specKey && l.version === entry.version);
    if (existing) return false;
    this.state.ledger.push({ publishedAt: new Date().toISOString(), ...entry });
    await this.persist();
    return true;
  }

  getLedger(specKey) {
    return this.state.ledger.filter((l) => l.specKey === specKey).sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  }

  putBinding(binding) {
    const record = { boundBy: null, boundAt: null, migratedFrom: null, lastError: null, ...binding, updatedAt: new Date().toISOString() };
    const existing = this.state.repo_bindings.find((b) => b.project === binding.project);
    if (existing) Object.assign(existing, record);
    else this.state.repo_bindings.push(record);
    return this.persist();
  }

  getBinding(project) {
    return this.state.repo_bindings.find((b) => b.project === project) ?? null;
  }

  listBindings() {
    return [...this.state.repo_bindings];
  }

  deleteBinding(project) {
    this.state.repo_bindings = this.state.repo_bindings.filter((b) => b.project !== project);
    return this.persist();
  }

  putCredential(project, { repoUrl, tokenEnc, username }) {
    const existing = this.state.repo_credentials.find((c) => c.project === project);
    if (existing) Object.assign(existing, { repoUrl: repoUrl ?? null, tokenEnc, username: username ?? null });
    else this.state.repo_credentials.push({ project, repoUrl: repoUrl ?? null, tokenEnc, username: username ?? null, createdAt: new Date().toISOString() });
    return this.persist();
  }

  getCredential(project) {
    const row = this.state.repo_credentials.find((c) => c.project === project) ?? null;
    return row ? { repoUrl: row.repoUrl, tokenEnc: row.tokenEnc, username: row.username } : null;
  }

  deleteCredential(project) {
    this.state.repo_credentials = this.state.repo_credentials.filter((c) => c.project !== project);
    return this.persist();
  }

  logAccess(entry) {
    this.state.access_log.push({ ts: new Date().toISOString(), ...entry });
    if (this.state.access_log.length > 10_000) this.state.access_log = this.state.access_log.slice(-10_000);
    return this.persist();
  }

  listAccess({ resultPrefix, limit = 50 } = {}) {
    return this.state.access_log
      .filter((entry) => typeof entry.result === "string" && entry.result.startsWith(resultPrefix))
      .slice(-limit)
      .reverse();
  }

  close() {}
}

/** Opens the sqlite driver when available, JSONL fallback otherwise. */
export async function createStore({ file } = {}) {
  if (!file) throw new Error("store file path is required");
  try {
    return await SqliteStore.open(file);
  } catch {
    return await JsonlStore.open(`${file}.json`);
  }
}
