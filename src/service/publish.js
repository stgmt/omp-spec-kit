import { readdir } from "node:fs/promises";
import path from "node:path";
import { authoredField } from "./registry.js";

export function publishTagName(projectId, slug, version) {
  return `spec/${projectId}/${slug}/${version}`;
}

/**
 * Publish pipeline (TASK-9, FR-11): a spec whose authored Status is ACTIVE at
 * the canonical HEAD gets an immutable annotated tag `spec/<project>/<slug>/<version>`
 * plus a ledger row (version → tree digest → commit). The tree hash is git's
 * own content-addressed digest of the spec directory at that commit — the
 * version's identity is the content, not the pointer.
 *
 * Rules: same version + same tree → no-op (heals a missing remote tag);
 * same version + different tree → VERSION_EXISTS rejection, recorded in the
 * access log and surfaced through the drift report. Published rows are never
 * rewritten. A per-spec mutex serializes the post-push and post-reconcile
 * paths so concurrent triggers can never double-publish.
 */
export function createPublisher({ mounts, git, store, identity, branch, logger = () => {} }) {
  const inFlight = new Map();
  const cwd = () => mounts.cloneDir;

  async function snapshot(headSha, projectId, slug) {
    const specPath = `${projectId}/.specs/${slug}`;
    let readme;
    try {
      readme = await git.show(headSha, `${specPath}/README.md`, { cwd: cwd() });
    } catch {
      return null;
    }
    const status = authoredField(readme, "Status");
    const version = authoredField(readme, "Version");
    const treeHash = await git.objectId(headSha, specPath, { cwd: cwd() });
    return { specPath, status, version, treeHash };
  }

  function reject(projectId, slug, version, code, detail) {
    const specKey = `${projectId}/${slug}`;
    store?.logAccess?.({ login: identity.name, role: "service", project: projectId, op: "publish", spec: slug, result: `publish-rejected:${code}` });
    logger(`publish rejected ${specKey}@${version}: ${code} — ${detail}`);
    return { spec: specKey, outcome: "rejected", code, version, detail };
  }

  async function record(projectId, slug, version, treeHash, commitSha) {
    const specKey = `${projectId}/${slug}`;
    const inserted = await store?.insertLedgerIfAbsent?.({ specKey, version, digest: treeHash, commitSha });
    if (inserted === false) {
      // Lost an insert race outside the per-spec mutex (another publisher
      // path): the recorded row is the evidence — judge against it.
      const existing = store?.getLedger?.(specKey).find((row) => row.version === version) ?? null;
      if (existing && existing.digest !== treeHash) {
        return reject(projectId, slug, version, "VERSION_EXISTS", `version ${version} was published concurrently with a different digest`);
      }
      return { spec: specKey, outcome: "noop", version };
    }
    return { spec: specKey, outcome: "published", version, digest: treeHash, commit: commitSha };
  }

  async function publishSpecNow(projectId, slug) {
    const specKey = `${projectId}/${slug}`;
    const headSha = await git.revParse("HEAD", { cwd: cwd() });
    const snap = await snapshot(headSha, projectId, slug);
    if (!snap) return { spec: specKey, outcome: "skipped", reason: "unreadable" };
    if (snap.status !== "ACTIVE") return { spec: specKey, outcome: "skipped", reason: `status:${snap.status ?? "none"}` };
    if (!snap.version) return reject(projectId, slug, null, "VERSION_MISSING", "ACTIVE spec has no authored Version field");

    const tag = publishTagName(projectId, slug, snap.version);
    const tagRef = `refs/tags/${tag}`;
    const ledgerRow = store?.getLedger?.(specKey).find((row) => row.version === snap.version) ?? null;

    if (ledgerRow && ledgerRow.digest !== snap.treeHash) {
      return reject(projectId, slug, snap.version, "VERSION_EXISTS", `version ${snap.version} is published with a different digest ${ledgerRow.digest.slice(0, 12)}`);
    }
    if (ledgerRow) {
      // Same content already recorded — heal a missing remote tag. The local
      // tag may be gone too (recreated clone): re-create it at the recorded
      // commit before pushing.
      const remote = await git.lsRemote(tagRef, { cwd: cwd() });
      if (remote.get(tagRef) !== ledgerRow.commitSha) {
        const local = await git.revParse(tagRef, { cwd: cwd() }).catch(() => null);
        if (local === null) {
          await git.tag(tag, ledgerRow.commitSha, {
            message: `spec(${projectId}) ${slug} ${snap.version}`,
            authorName: identity.name,
            authorEmail: identity.email,
            cwd: cwd(),
          }).catch(() => {});
        }
        await git.push({ refspec: `${tagRef}:${tagRef}` }, { cwd: cwd() }).catch((error) => logger(`tag heal push failed for ${tag}: ${error.message}`));
      }
      return { spec: specKey, outcome: "noop", version: snap.version };
    }

    const remote = await git.lsRemote(tagRef, { cwd: cwd() });
    const remoteSha = remote.get(tagRef) ?? null;
    if (remoteSha === null) {
      await git.tag(tag, headSha, {
        message: `spec(${projectId}) ${slug} ${snap.version}`,
        authorName: identity.name,
        authorEmail: identity.email,
        cwd: cwd(),
      });
      try {
        await git.push({ refspec: `${tagRef}:${tagRef}` }, { cwd: cwd() });
      } catch (error) {
        // Lost a race with an out-of-band tag: re-resolve and judge it.
        const again = await git.lsRemote(tagRef, { cwd: cwd() });
        const winner = again.get(tagRef);
        if (!winner || winner === headSha) throw error;
        return reject(projectId, slug, snap.version, "VERSION_EXISTS", `remote tag ${tag} appeared at ${winner.slice(0, 12)}`);
      }
      return record(projectId, slug, snap.version, snap.treeHash, headSha);
    }

    // Remote tag exists but the ledger has no row (crash between push and
    // record, or an out-of-band publish): adopt only verifiable equality.
    let remoteTree = null;
    try {
      remoteTree = await git.objectId(remoteSha, `${projectId}/.specs/${slug}`, { cwd: cwd() });
    } catch {
      remoteTree = null;
    }
    if (remoteTree !== null && remoteTree === snap.treeHash) {
      await store?.insertLedgerIfAbsent?.({ specKey, version: snap.version, digest: remoteTree, commitSha: remoteSha });
      return { spec: specKey, outcome: "adopted", version: snap.version, commit: remoteSha };
    }
    return reject(projectId, slug, snap.version, "VERSION_EXISTS", `remote tag ${tag} points at ${remoteSha.slice(0, 12)} with different content`);
  }

  function publishSpec(projectId, slug) {
    const key = `${projectId}/${slug}`;
    const previous = inFlight.get(key) ?? Promise.resolve();
    const next = previous.then(
      () => publishSpecNow(projectId, slug),
      () => publishSpecNow(projectId, slug),
    );
    const stored = next.then(() => {}, () => {});
    inFlight.set(key, stored);
    void stored.then(() => {
      if (inFlight.get(key) === stored) inFlight.delete(key);
    });
    return next;
  }

  async function publishProject(projectId) {
    const specsDir = path.join(mounts.resolveProjectRoot(projectId), ".specs");
    const entries = await readdir(specsDir, { withFileTypes: true }).catch(() => []);
    const results = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      results.push(await publishSpec(projectId, entry.name));
    }
    return results;
  }

  async function publishAll() {
    const results = [];
    for (const projectId of mounts.projects) {
      results.push(...(await publishProject(projectId)));
    }
    return results;
  }

  return { publishSpec, publishProject, publishAll };
}
