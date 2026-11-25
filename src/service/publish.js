import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { authoredField } from "./registry.js";
import { specBranchName } from "./spec-binding.js";

export function publishTagName(projectId, slug, version) {
  return `spec/${projectId}/${slug}/${version}`;
}

export function publicationProtectionRef(requestHash) {
  if (typeof requestHash !== "string" || !/^[0-9a-f]{64}$/u.test(requestHash)) throw new Error("invalid publication operation identity");
  return `refs/omp-spec-kit/pending/${requestHash}`;
}

/** Protect the tag and its commit from Git GC before persisting a reservation. */
export async function protectPublicationTag({ tag, requestHash }) {
  const ref = publicationProtectionRef(requestHash);
  try {
    await tag.git.run(["update-ref", ref, tag.object, "0".repeat(tag.object.length)], { cwd: tag.cwd });
    return { ref, object: tag.object, git: tag.git, cwd: tag.cwd, created: true };
  } catch (error) {
    const existing = await tag.git.revParse(ref, { cwd: tag.cwd }).catch(() => null);
    if (existing === tag.object) return { ref, object: tag.object, git: tag.git, cwd: tag.cwd, created: false };
    if (existing === null) throw error;
    throw Object.assign(new Error("publication protection ref already belongs to a different object"), { causeCode: "PUBLICATION_PROTECTION_CONFLICT", cause: error });
  }
}

/** Delete only the expected object from this operation's private ref. */
export async function removePublicationProtection(protection) {
  if (!protection) return;
  if (!/^refs\/omp-spec-kit\/pending\/[0-9a-f]{64}$/u.test(protection.ref) || !/^[0-9a-f]{40,64}$/u.test(protection.object)) throw new Error("invalid publication protection identity");
  const existing = await protection.git.revParse(protection.ref, { cwd: protection.cwd }).catch(() => null);
  if (existing === null) return;
  if (existing !== protection.object) throw Object.assign(new Error("publication protection ref changed; refusing to delete it"), { causeCode: "PUBLICATION_PROTECTION_CONFLICT" });
  await protection.git.run(["update-ref", "-d", protection.ref, protection.object], { cwd: protection.cwd });
}

/** Create an annotated tag object without installing or replacing a local ref. */
export async function createOwnedPublicationTag({ git, cwd, project, spec, version, commit, identity }) {
  const name = publishTagName(project, spec, version);
  const ref = `refs/tags/${name}`;
  await git.run(["check-ref-format", ref], { cwd });
  if (await git.revParse(ref, { cwd }).catch(() => null)) {
    throw Object.assign(new Error(`local publication tag ${name} already exists`), { causeCode: "VERSION_EXISTS" });
  }
  const tagger = (await git.run(["-c", `user.name=${identity.name}`, "-c", `user.email=${identity.email}`, "var", "GIT_COMMITTER_IDENT"], { cwd })).stdout.trim();
  const input = `object ${commit}\ntype commit\ntag ${name}\ntagger ${tagger}\n\nspec(${project}) ${spec} ${version}\n`;
  const created = await git.runBounded(["mktag"], { cwd, timeoutMs: 5_000, input });
  const object = created.stdout.trim();
  if (!/^[0-9a-f]{40,64}$/u.test(object)) throw new Error("Git did not return an annotated tag object");
  return { ref, object, git, cwd, localRefCreated: false };
}

/** Both refs advance together, and only from the reviewed branch/tag state. */
export async function pushBranchAndPublicationTag({ git, cwd, branch, expectedHead, tag }) {
  await git.runBounded(["push", "--atomic", `--force-with-lease=refs/heads/${branch}:${expectedHead}`, `--force-with-lease=${tag.ref}:`, "origin", `HEAD:refs/heads/${branch}`, `${tag.object}:${tag.ref}`], { cwd, timeoutMs: 30_000 });
}

/** Delete only the exact local tag object created by this operation. */
export async function removeOwnedPublicationTag(tag) {
  if (tag?.localRefCreated) await tag.git.run(["update-ref", "-d", tag.ref, tag.object], { cwd: tag.cwd });
}

/** Peeled commit sha of a remote tag — annotated tags list both refs. */
function remoteTagCommit(refs, tagRef) {
  return refs.get(`${tagRef}^{}`) ?? refs.get(tagRef) ?? null;
}

function ledgerFingerprint(rows) {
  const stable = rows.map(({ version, digest, commitSha, repoUrl, repoBranch }) => ({ version, digest, commitSha, repoUrl, repoBranch }))
    .sort((left, right) => left.version.localeCompare(right.version));
  return createHash("sha256").update(JSON.stringify(stable), "utf8").digest("hex");
}

/** A version becomes a refname: it must be a single git-ref-safe component. */
export function isRefSafeVersion(version) {
  return (
    typeof version === "string" &&
    version.length > 0 &&
    version.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(version) &&
    !version.includes("..") &&
    !version.endsWith("/") &&
    !version.endsWith(".") &&
    !/[~^:?*[\]\\ ]/.test(version)
  );
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
export function createPublisher({ mounts, store, identity, logger = () => {} }) {
  const inFlight = new Map();

  async function snapshot(mount, headSha, projectId, slug) {
    const specPath = `.specs/${slug}`;
    let readme;
    try {
      readme = await mount.git.show(headSha, `${specPath}/README.md`, { cwd: mount.cwd });
    } catch {
      return null;
    }
    const status = authoredField(readme, "Status");
    const version = authoredField(readme, "Version");
    const treeHash = await mount.git.objectId(headSha, specPath, { cwd: mount.cwd });
    return { specPath, status, version, treeHash };
  }

  function reject(projectId, slug, version, code, detail) {
    const specKey = `${projectId}/${slug}`;
    store?.logAccess?.({ login: identity.name, role: "service", project: projectId, op: "publish", spec: slug, result: `publish-rejected:${code}` });
    logger(`publish rejected ${specKey}@${version}: ${code} — ${detail}`);
    return { spec: specKey, outcome: "rejected", code, version, detail };
  }

  async function record(mount, projectId, slug, version, treeHash, commitSha) {
    const specKey = `${projectId}/${slug}`;
    const inserted = await store?.insertLedgerIfAbsent?.({ specKey, version, digest: treeHash, commitSha, repoUrl: mount.repoUrl, repoBranch: mount.branch });
    if (inserted === false) {
      // Lost an insert race outside the per-spec mutex (another publisher
      // path): the recorded row is the evidence — judge against it.
      const existing = store?.getLedger?.(specKey).find((row) => row.version === version) ?? null;
      if (existing && existing.digest !== treeHash) {
        return reject(projectId, slug, version, "VERSION_EXISTS", `version ${version} was published concurrently with a different digest`);
      }
      if (!existing) return reject(projectId, slug, version, "PUBLICATION_RESERVED", `version ${version} is reserved by an unfinished migration`);
      return { spec: specKey, outcome: "noop", version };
    }
    return { spec: specKey, outcome: "published", version, digest: treeHash, commit: commitSha };
  }

  async function publishSpecNow(projectId, slug) {
    const specKey = `${projectId}/${slug}`;
    const mirror = await mounts.ensureRepo(projectId);
    const branch = specBranchName(slug);
    const mount = { ...mirror, branch, ref: `refs/remotes/origin/${branch}`, cwd: mirror.mirrorDir };
    const git = mount.git;
    const cwd = () => mount.cwd;
    const headSha = await git.revParse(mount.ref, { cwd: cwd() }).catch(() => null);
    if (!headSha) return { spec: specKey, outcome: "skipped", reason: "branch-missing" };
    const snap = await snapshot(mount, headSha, projectId, slug);
    if (!snap) return { spec: specKey, outcome: "skipped", reason: "unreadable" };
    if (snap.status !== "ACTIVE") return { spec: specKey, outcome: "skipped", reason: `status:${snap.status ?? "none"}` };
    if (!snap.version) return reject(projectId, slug, null, "VERSION_MISSING", "ACTIVE spec has no authored Version field");
    if (!isRefSafeVersion(snap.version)) return reject(projectId, slug, snap.version, "VERSION_INVALID", "authored Version is not a valid git refname component");

    const tag = publishTagName(projectId, slug, snap.version);
    const tagRef = `refs/tags/${tag}`;
    const ledgerRow = store?.getLedger?.(specKey).find((row) => row.version === snap.version) ?? null;

    if (ledgerRow && ledgerRow.digest !== snap.treeHash) {
      return reject(projectId, slug, snap.version, "VERSION_EXISTS", `version ${snap.version} is published with a different digest ${ledgerRow.digest.slice(0, 12)}`);
    }
    if (ledgerRow) {
      // Same content already recorded. Three states for the remote tag:
      // present at the recorded commit (noop), absent (heal), diverged
      // (reject — never overwrite a published pointer, surface the drift).
      const remote = await git.lsRemote(`${tagRef}*`, { cwd: cwd() });
      const remoteCommit = remoteTagCommit(remote, tagRef);
      if (remoteCommit === ledgerRow.commitSha) {
        return { spec: specKey, outcome: "noop", version: snap.version };
      }
      if (remoteCommit !== null) {
        return reject(projectId, slug, snap.version, "VERSION_EXISTS", `remote tag ${tag} points at ${remoteCommit.slice(0, 12)} but the ledger recorded ${ledgerRow.commitSha.slice(0, 12)}`);
      }
      // Remote tag missing — heal. The local tag may be gone too (recreated
      // clone): re-create it at the recorded commit before pushing.
      const localCommit = await git.revParse(`${tagRef}^{}`, { cwd: cwd() }).catch(() => null);
      if (localCommit === null) {
        await git.tag(tag, ledgerRow.commitSha, {
          message: `spec(${projectId}) ${slug} ${snap.version}`,
          authorName: identity.name,
          authorEmail: identity.email,
          cwd: cwd(),
        }).catch(() => {});
      } else if (localCommit !== ledgerRow.commitSha) {
        return reject(projectId, slug, snap.version, "VERSION_EXISTS", `local tag ${tag} points at ${localCommit.slice(0, 12)} but the ledger recorded ${ledgerRow.commitSha.slice(0, 12)}`);
      }
      try {
        await git.push({ refspec: `${tagRef}:${tagRef}` }, { cwd: cwd() });
        return { spec: specKey, outcome: "healed", version: snap.version };
      } catch (error) {
        const again = await git.lsRemote(`${tagRef}*`, { cwd: cwd() });
        const winner = remoteTagCommit(again, tagRef);
        if (winner === ledgerRow.commitSha) return { spec: specKey, outcome: "noop", version: snap.version };
        if (!winner) {
          logger(`tag heal push failed for ${tag}: ${error.message}`);
          return { spec: specKey, outcome: "heal-failed", version: snap.version };
        }
        return reject(projectId, slug, snap.version, "VERSION_EXISTS", `remote tag ${tag} appeared at ${winner.slice(0, 12)}`);
      }
    }

    const remote = await git.lsRemote(`${tagRef}*`, { cwd: cwd() });
    const remoteSha = remoteTagCommit(remote, tagRef);
    if (remoteSha === null) {
      // A retry after a failed push may already carry the local tag: verify it
      // targets this commit instead of re-creating it ("already exists").
      const localTagCommit = await git.revParse(`${tagRef}^{}`, { cwd: cwd() }).catch(() => null);
      if (localTagCommit === null) {
        await git.tag(tag, headSha, {
          message: `spec(${projectId}) ${slug} ${snap.version}`,
          authorName: identity.name,
          authorEmail: identity.email,
          cwd: cwd(),
        });
      } else if (localTagCommit !== headSha) {
        return reject(projectId, slug, snap.version, "VERSION_EXISTS", `local tag ${tag} points at ${localTagCommit.slice(0, 12)}`);
      }
      try {
        await git.push({ refspec: `${tagRef}:${tagRef}` }, { cwd: cwd() });
      } catch (error) {
        // Judge the outcome, don't assume it: the push may have landed anyway
        // (ambiguous failure) or another path may have won the same commit.
        const again = await git.lsRemote(`${tagRef}*`, { cwd: cwd() });
        const winner = remoteTagCommit(again, tagRef);
        if (winner === headSha) {
          return record(mount, projectId, slug, snap.version, snap.treeHash, headSha);
        }
        if (!winner) throw error;
        return reject(projectId, slug, snap.version, "VERSION_EXISTS", `remote tag ${tag} appeared at ${winner.slice(0, 12)}`);
      }
      return record(mount, projectId, slug, snap.version, snap.treeHash, headSha);
    }

    // Remote tag exists but the ledger has no row (crash between push and
    // record, or an out-of-band publish): adopt only verifiable equality.
    let remoteTree = null;
    try {
      remoteTree = await git.objectId(remoteSha, `.specs/${slug}`, { cwd: cwd() });
    } catch {
      remoteTree = null;
    }
    if (remoteTree !== null && remoteTree === snap.treeHash) {
      const adopted = await record(mount, projectId, slug, snap.version, remoteTree, remoteSha);
      return adopted.outcome === "published" ? { ...adopted, outcome: "adopted" } : adopted;
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

  /** Validate an ACTIVE migration against both durable publication sources. */
  async function inspectMigration({ project, spec, worktree, operations, role, requestHash = null, allowStatusChange = false }) {
    const oldReadme = await worktree.git.show(worktree.head, `.specs/${spec}/README.md`, { cwd: worktree.cwd }).catch(() => null);
    if (oldReadme === null) return { ok: false, code: "PUBLICATION_STATE_UNKNOWN", message: "Cannot read the source README for publication validation" };
    const oldStatus = authoredField(oldReadme, "Status");
    const oldVersion = authoredField(oldReadme, "Version");
    const readmeChanges = (operations ?? []).filter((operation) => operation?.document === "README.md");
    if (readmeChanges.length > 1 || readmeChanges.some((operation) => operation.kind !== "replace_document" || typeof operation.content !== "string")) {
      return { ok: false, code: "MIGRATION_README_INVALID", message: "A migration may provide one replacement README" };
    }
    const candidate = readmeChanges[0]?.content ?? oldReadme;
    const status = authoredField(candidate, "Status");
    const version = authoredField(candidate, "Version");
    if ((!allowStatusChange && status !== oldStatus) || (oldStatus === "ACTIVE" && status !== "ACTIVE")) return { ok: false, code: "MIGRATION_STATUS_CHANGED", message: "Migration must preserve the specification status" };
    if (status !== "ACTIVE") return { ok: true, active: false, published: false, version: null };
    if (store?.driver !== "sqlite" || typeof store.getLedger !== "function" || typeof store.insertLedgerIfAbsent !== "function" || typeof store.beginPublicationReservation !== "function") {
      return { ok: false, code: "PUBLICATION_LEDGER_UNAVAILABLE", message: "ACTIVE migration requires the durable SQLite publication ledger" };
    }
    const ledger = store.getLedger(`${project}/${spec}`);
    const prefix = `refs/tags/${publishTagName(project, spec, "*")}`;
    const refs = await worktree.git.lsRemote(prefix, { cwd: worktree.cwd });
    const published = ledger.length > 0 || refs.size > 0;
    if (published && role !== "owner") return { ok: false, code: "PUBLICATION_OWNER_REQUIRED", message: "Only an owner may migrate a published ACTIVE specification" };
    if (!isRefSafeVersion(version)) return { ok: false, code: "MIGRATION_VERSION_REQUIRED", message: "Provide a valid new Version in the migration README" };
    if (published && (!readmeChanges.length || version === oldVersion)) {
      return { ok: false, code: "MIGRATION_VERSION_REQUIRED", message: `Change README Version from ${oldVersion ?? "the published version"} to a new free version in the migration` };
    }
    if (ledger.some((entry) => entry.version === version) || remoteTagCommit(refs, `refs/tags/${publishTagName(project, spec, version)}`) !== null) {
      return { ok: false, code: "VERSION_EXISTS", message: `Version ${version} is already published or reserved by a remote tag` };
    }
    const reserved = store.getPublicationReservation?.(`${project}/${spec}`, version);
    if (reserved && reserved.requestHash !== requestHash) return { ok: false, code: "PUBLICATION_RESERVED", message: `Version ${version} is reserved by an unfinished migration` };
    if (oldVersion) {
      const row = ledger.find((entry) => entry.version === oldVersion);
      const oldTag = remoteTagCommit(refs, `refs/tags/${publishTagName(project, spec, oldVersion)}`);
      if ((row && (!oldTag || oldTag !== row.commitSha)) || (oldTag && !row)) {
        return { ok: false, code: "PUBLICATION_INTEGRITY", message: `Existing ledger and Git tag for ${oldVersion} do not agree` };
      }
    }
    return { ok: true, active: true, published, oldVersion, version, ledgerFingerprint: ledgerFingerprint(ledger) };
  }

  async function reserveMigrationPublication({ project, spec, publication, metadata }) {
    try {
      const reservation = await store.beginPublicationReservation(`${project}/${spec}`, publication.version, metadata);
      if (!reservation.ok) return { ok: false, code: reservation.code, message: "The target Version was reserved in the ledger" };
      if (ledgerFingerprint(reservation.rows) !== publication.ledgerFingerprint) {
        if (!reservation.reused) reservation.rollback();
        return { ok: false, code: "PUBLICATION_STATE_CHANGED", message: "The publication ledger changed after the preview; request a new preview" };
      }
      return reservation;
    } catch (error) {
      return { ok: false, code: "PUBLICATION_BUSY", message: String(error?.message ?? error).split("\n")[0] };
    }
  }

  function findMigrationReservation({ project, spec, requestHash }) {
    return store?.findPublicationReservation?.(`${project}/${spec}`, requestHash) ?? null;
  }

  async function confirmMigrationPublication({ project, spec, version, commit, requestHash = null }) {
    try {
      const mount = await mounts.ensureRepo(project, { fetch: true, strict: true });
      const tree = await mount.git.objectId(commit, `.specs/${spec}`, { cwd: mount.mirrorDir });
      const tagRef = `refs/tags/${publishTagName(project, spec, version)}`;
      const refs = await mount.git.lsRemote(`${tagRef}*`, { cwd: mount.mirrorDir });
      if (remoteTagCommit(refs, tagRef) !== commit) return { ok: false, code: "PUBLISHED_LEDGER_UNCONFIRMED" };
      await mount.git.run(["merge-base", "--is-ancestor", commit, `refs/remotes/origin/${specBranchName(spec)}`], { cwd: mount.mirrorDir });
      const specKey = `${project}/${spec}`;
      const pending = store.getPublicationReservation?.(specKey, version);
      const operationIdentity = requestHash ?? pending?.requestHash ?? null;
      if (pending) {
        if (pending.commitSha !== commit || pending.tagObject !== refs.get(tagRef) || pending.digest !== tree || pending.repoUrl !== mount.repoUrl || pending.repoBranch !== specBranchName(spec)) return { ok: false, code: "PUBLISHED_LEDGER_UNCONFIRMED" };
        store.completePublicationReservation(specKey, version, pending.token, { digest: tree, commitSha: commit, repoUrl: mount.repoUrl, repoBranch: specBranchName(spec) });
      }
      let row = store.getLedger(specKey).find((entry) => entry.version === version);
      if (!row) {
        await publishSpec(project, spec);
        row = store.getLedger(specKey).find((entry) => entry.version === version);
      }
      if (!row || row.commitSha !== commit || row.digest !== tree) return { ok: false, code: "PUBLISHED_LEDGER_UNCONFIRMED" };
      if (operationIdentity) await removePublicationProtection({ git: mount.git, cwd: mount.mirrorDir, ref: publicationProtectionRef(operationIdentity), object: refs.get(tagRef) });
      return { ok: true, version, commit, digest: tree };
    } catch (error) {
      return { ok: false, code: "PUBLISHED_LEDGER_UNCONFIRMED", message: String(error?.message ?? error).split("\n")[0] };
    }
  }

  async function publishProject(projectId) {
    const specsDir = path.join(await mounts.projectRoot(projectId), ".specs");
    const entries = await readdir(specsDir, { withFileTypes: true }).catch(() => []);
    const results = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // One bad spec (invalid version, corrupt README) must not stop the rest.
      try {
        results.push(await publishSpec(projectId, entry.name));
      } catch (error) {
        logger(`publish failed for ${projectId}/${entry.name}: ${error.message}`);
        results.push({ spec: `${projectId}/${entry.name}`, outcome: "error", detail: error.message });
      }
    }
    return results;
  }

  async function publishAll() {
    const results = [];
    for (const projectId of mounts.projects) {
      try {
        results.push(...(await publishProject(projectId)));
      } catch (error) {
        logger(`publish failed for project ${projectId}: ${error.message}`);
        results.push({ spec: projectId, outcome: "error", detail: error.message });
      }
    }
    return results;
  }

  return { publishSpec, publishProject, publishAll, inspectMigration, reserveMigrationPublication, findMigrationReservation, confirmMigrationPublication };
}
