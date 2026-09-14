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
    this.db.prepare("INSERT INTO access_log (ts, login, role, tenant, project, op, spec, request_id, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(entry.ts ?? new Date().toISOString(), entry.login ?? null, entry.role ?? null, entry.tenant ?? null, entry.project ?? null, entry.op ?? null, entry.spec ?? null, entry.requestId ?? null, entry.result ?? null);
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
    let state = { claims: [], ledger: [], access_log: [] };
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
