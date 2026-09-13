import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Service-owned store (DESIGN "Authority split"): fields git cannot express
 * live here — tenants, claims, publish ledger, access events. Driver:
 * `node:sqlite` when the runtime provides it, documented JSONL fallback
 * otherwise. Both drivers implement the same interface.
 */

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE,
  allowed_scopes TEXT,
  default_scope TEXT,
  created_at TEXT,
  revoked_at TEXT
);
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
  identity TEXT,
  tenant TEXT,
  project TEXT,
  op TEXT,
  spec TEXT,
  request_id TEXT,
  result TEXT
);
`;

class SqliteStore {
  constructor(db) {
    this.db = db;
    this.driver = "sqlite";
  }

  static async open(file) {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(file);
    db.exec(SCHEMA_SQL);
    return new SqliteStore(db);
  }

  upsertTenant({ id, tokenHash, scopes, defaultScope }) {
    this.db.prepare(
      "INSERT INTO tenants (id, token_hash, allowed_scopes, default_scope, created_at) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET token_hash = excluded.token_hash, allowed_scopes = excluded.allowed_scopes, default_scope = excluded.default_scope",
    ).run(id, tokenHash, JSON.stringify(scopes), defaultScope ?? null, new Date().toISOString());
  }

  getTenantByTokenHash(tokenHash) {
    const row = this.db.prepare("SELECT id, token_hash, allowed_scopes, default_scope, revoked_at FROM tenants WHERE token_hash = ? AND revoked_at IS NULL").get(tokenHash);
    if (!row) return null;
    return { id: row.id, tokenHash: row.token_hash, scopes: JSON.parse(row.allowed_scopes), defaultScope: row.default_scope, revokedAt: row.revoked_at };
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
      "INSERT INTO ledger (spec_key, version, digest, commit_sha, published_at) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT(spec_key, version) DO UPDATE SET digest = excluded.digest, commit_sha = excluded.commit_sha, published_at = excluded.published_at",
    ).run(entry.specKey, entry.version, entry.digest, entry.commitSha ?? null, entry.publishedAt ?? new Date().toISOString());
  }

  getLedger(specKey) {
    return this.db.prepare("SELECT spec_key, version, digest, commit_sha, published_at FROM ledger WHERE spec_key = ? ORDER BY published_at DESC").all(specKey)
      .map((row) => ({ specKey: row.spec_key, version: row.version, digest: row.digest, commitSha: row.commit_sha, publishedAt: row.published_at }));
  }

  logAccess(entry) {
    this.db.prepare("INSERT INTO access_log (ts, identity, tenant, project, op, spec, request_id, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(entry.ts ?? new Date().toISOString(), entry.identity ?? null, entry.tenant ?? null, entry.project ?? null, entry.op ?? null, entry.spec ?? null, entry.requestId ?? null, entry.result ?? null);
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
    let state = { tenants: [], claims: [], ledger: [], access_log: [] };
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

  upsertTenant({ id, tokenHash, scopes, defaultScope }) {
    const existing = this.state.tenants.find((t) => t.id === id);
    const record = { id, tokenHash, scopes, defaultScope: defaultScope ?? null, createdAt: existing?.createdAt ?? new Date().toISOString(), revokedAt: null };
    if (existing) Object.assign(existing, record);
    else this.state.tenants.push(record);
    return this.persist();
  }

  getTenantByTokenHash(tokenHash) {
    return this.state.tenants.find((t) => t.tokenHash === tokenHash && t.revokedAt === null) ?? null;
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

  getLedger(specKey) {
    return this.state.ledger.filter((l) => l.specKey === specKey).sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  }

  logAccess(entry) {
    this.state.access_log.push({ ts: new Date().toISOString(), ...entry });
    if (this.state.access_log.length > 10_000) this.state.access_log = this.state.access_log.slice(-10_000);
    return this.persist();
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
