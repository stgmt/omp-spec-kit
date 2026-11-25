import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { promisify } from "node:util";
import { test } from "node:test";
import { createStore } from "../../../src/service/ledger.js";

const exec = promisify(execFile);
const entry = (version) => ({ specKey: "owner/project/demo", version, digest: "a".repeat(40), commitSha: "b".repeat(40), repoUrl: "test-repo", repoBranch: "spec-demo" });
const metadata = { requestHash: "request-1", commitSha: "b".repeat(40), tagObject: "d".repeat(40), digest: "a".repeat(40), expectedHead: "c".repeat(40), repoUrl: "test-repo", repoBranch: "spec-demo" };

test("publication reservation excludes the same version while other claims and audit remain writable", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "publication-lock-"));
  const file = path.join(dir, "ledger.db");
  const store = await createStore({ file });
  t.after(async () => { store.close(); await rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); });
  assert.equal(store.driver, "sqlite");
  const reservation = await store.beginPublicationReservation(entry("1.1.0").specKey, "1.1.0", metadata);
  assert.equal(reservation.ok, true);
  assert.deepEqual(store.getLedger(entry("1.1.0").specKey), []);
  store.putClaim({ specKey: "owner/project/other", holder: "writer", expiresAtMs: Date.now() + 60_000 });
  store.logAccess({ project: "owner/project", op: "other-spec", result: "ok" });
  assert.equal(store.getClaim("owner/project/other").holder, "writer");
  assert.equal(store.listAccess({ resultPrefix: "ok" }).length, 1);
  assert.equal(store.insertLedgerIfAbsent(entry("1.1.0")), false);
  assert.throws(() => store.appendLedger(entry("1.1.0")), /reserved/iu);
  assert.equal(store.insertLedgerIfAbsent(entry("2.0.0")), true);
  const moduleUrl = new URL("../../../src/service/ledger.js", import.meta.url).href;
  const childScript = `const {createStore}=await import(process.argv[1]); const {DatabaseSync}=await import('node:sqlite'); const store=await createStore({file:process.argv[2]}); const result=store.insertLedgerIfAbsent(${JSON.stringify(entry("1.1.0"))}); const reservation=await store.beginPublicationReservation(${JSON.stringify(entry("1.1.0").specKey)},'1.1.0',${JSON.stringify({ ...metadata, requestHash: "competing-request" })}); const db=new DatabaseSync(process.argv[2]); let legacyInsert='',legacyUpdate=''; try { db.prepare('INSERT INTO ledger (spec_key, version, digest) VALUES (?, ?, ?)').run(${JSON.stringify(entry("1.1.0").specKey)},'1.1.0','legacy'); } catch(e) {legacyInsert=e.message} try { db.prepare('UPDATE ledger SET version=? WHERE spec_key=? AND version=?').run('1.1.0',${JSON.stringify(entry("1.1.0").specKey)},'2.0.0'); } catch(e) {legacyUpdate=e.message} process.stdout.write(String(result)+'|'+reservation.code+'|'+legacyInsert+'|'+legacyUpdate); db.close(); store.close();`;
  const child = await exec(process.execPath, ["--experimental-sqlite", "--input-type=module", "-e", childScript, moduleUrl, file], { windowsHide: true });
  assert.equal(child.stdout, "false|PUBLICATION_RESERVED|PUBLICATION_RESERVED|PUBLICATION_RESERVED");
  reservation.commit(entry("1.1.0"));
  const rows = store.getLedger(entry("1.1.0").specKey);
  assert.deepEqual(rows.map((row) => row.version).sort(), ["1.1.0", "2.0.0"]);
  assert.equal(store.getPublicationReservation(entry("1.1.0").specKey, "1.1.0"), null);
  assert.equal((await store.beginPublicationReservation(entry("1.1.0").specKey, "1.1.0", metadata)).code, "VERSION_EXISTS");
});

test("opening an old SQLite ledger installs guards that also protect direct legacy SQL", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "publication-old-schema-"));
  const file = path.join(dir, "ledger.db");
  const { DatabaseSync } = await import("node:sqlite");
  const legacy = new DatabaseSync(file);
  legacy.exec("CREATE TABLE ledger (spec_key TEXT, version TEXT, digest TEXT, commit_sha TEXT, published_at TEXT, PRIMARY KEY(spec_key, version))");
  legacy.close();
  const store = await createStore({ file });
  t.after(async () => { store.close(); await rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); });
  assert.equal(store.driver, "sqlite");
  const reservation = await store.beginPublicationReservation(entry("1.3.0").specKey, "1.3.0", metadata);
  assert.equal(reservation.ok, true);
  const other = new DatabaseSync(file);
  try {
    assert.throws(() => other.prepare("INSERT INTO ledger (spec_key, version, digest) VALUES (?, ?, ?)").run(entry("1.3.0").specKey, "1.3.0", "legacy"), /PUBLICATION_RESERVED/u);
  } finally {
    other.close();
  }
  reservation.rollback();
  assert.equal(store.insertLedgerIfAbsent(entry("1.3.0")), true);
});

test("failed ledger insertion rolls back the temporary reservation removal", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "publication-rollback-"));
  const store = await createStore({ file: path.join(dir, "ledger.db") });
  t.after(async () => { store.close(); await rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); });
  const reservation = await store.beginPublicationReservation(entry("1.4.0").specKey, "1.4.0", metadata);
  assert.equal(reservation.ok, true);
  store.db.exec("CREATE TRIGGER fail_test_publication BEFORE INSERT ON ledger WHEN NEW.version = '1.4.0' BEGIN SELECT RAISE(ABORT, 'TEST_PUBLICATION_FAILURE'); END");
  assert.throws(() => reservation.commit(entry("1.4.0")), /TEST_PUBLICATION_FAILURE/u);
  assert.equal(store.getLedger(entry("1.4.0").specKey).some((row) => row.version === "1.4.0"), false);
  assert.equal(store.getPublicationReservation(entry("1.4.0").specKey, "1.4.0").token, reservation.token);
  store.db.exec("DROP TRIGGER fail_test_publication");
  reservation.commit(entry("1.4.0"));
  assert.equal(store.getLedger(entry("1.4.0").specKey).some((row) => row.version === "1.4.0"), true);
});

test("a crashed process leaves a durable reservation that only the same operation can resume", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "publication-crash-"));
  const file = path.join(dir, "ledger.db");
  const store = await createStore({ file });
  t.after(async () => { store.close(); await rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); });
  const moduleUrl = new URL("../../../src/service/ledger.js", import.meta.url).href;
  const script = `const {createStore}=await import(process.argv[1]); const store=await createStore({file:process.argv[2]}); await store.beginPublicationReservation(${JSON.stringify(entry("1.2.0").specKey)},'1.2.0',${JSON.stringify(metadata)}); process.stdout.write('READY\\n'); setInterval(()=>{},1000);`;
  const child = spawn(process.execPath, ["--experimental-sqlite", "--input-type=module", "-e", script, moduleUrl, file], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
  const [output] = await once(child.stdout, "data");
  assert.match(String(output), /READY/u);
  const exited = once(child, "exit");
  child.kill("SIGKILL");
  await exited;
  assert.deepEqual(store.getLedger(entry("1.2.0").specKey), []);
  assert.ok(store.getPublicationReservation(entry("1.2.0").specKey, "1.2.0"));
  assert.equal((await store.beginPublicationReservation(entry("1.2.0").specKey, "1.2.0", { ...metadata, requestHash: "different" })).code, "PUBLICATION_RESERVED");
  const replay = await store.beginPublicationReservation(entry("1.2.0").specKey, "1.2.0", metadata);
  assert.equal(replay.reused, true);
  replay.commit(entry("1.2.0"));
  assert.equal(store.getLedger(entry("1.2.0").specKey)[0].version, "1.2.0");
});
