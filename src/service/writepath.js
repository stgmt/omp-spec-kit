import { cp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { commitMessage } from "./git.js";
import { reconcileClone } from "./sync.js";
import { validateSpecBinding } from "./spec-binding.js";
import { canonicalJson, sha256, specificationDirectoryDigest } from "../authoring/transactions.js";
import { decodeHostedSnapshot, materializeBranchRoot, repositoryBindingId } from "./migration-snapshot.js";
import { publishTagName, createOwnedPublicationTag, pushBranchAndPublicationTag, removeOwnedPublicationTag, protectPublicationTag, removePublicationProtection, publicationProtectionRef } from "./publish.js";

function errorEnvelope(operation, requestId, code, message, extra = {}) {
  return {
    schemaVersion: "spec-kernel@2",
    requestId: requestId ?? null,
    operation,
    ok: false,
    graph: null,
    page: null,
    data: null,
    error: {
      code,
      message,
      operation,
      parameter: null,
      receivedType: null,
      receivedSummary: null,
      expected: null,
      limitName: null,
      limitValue: null,
      observedValue: null,
      specSlug: null,
      localId: null,
      canonicalId: null,
      path: null,
      anchor: null,
      headingOccurrenceId: null,
      linkOccurrenceId: null,
      rewriteKey: null,
      candidates: [],
      diagnosticIds: [],
      retryable: false,
      causeCode: null,
      ...extra,
    },
    diagnostics: [],
    provenance: null,
  };
}

function shortHash(hash) {
  return typeof hash === "string" && hash.length > 0 ? hash.slice(0, 12) : "patch";
}

async function landedMigration({ git, cwd, ref, spec, requestId, requestHash, proposalHash, snapshot, scope }) {
  const { stdout } = await git.run(["log", "--format=%H%x00%B%x00", ref], { cwd });
  const records = stdout.split("\u0000");
  for (let index = 0; index + 1 < records.length; index += 2) {
    const commit = records[index].trim();
    const message = records[index + 1];
    const trailer = (name) => new RegExp(`^${name}: ([^\\r\\n]*)$`, "mu").exec(message)?.[1] ?? null;
    if (trailer("Spec-Request-Id") !== requestId || trailer("Spec-Migration-Request") === null) continue;
    if (trailer("Spec-Migration-Request") !== requestHash || trailer("Spec-Migration-Proposal") !== proposalHash) return { conflict: true };
    const changed = await git.run(["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", commit, "--", `.specs/${spec}/`], { cwd });
    const changedDocuments = [];
    for (const file of changed.stdout.split("\u0000").filter(Boolean)) {
      const digestAt = async (revision) => {
        const type = await git.objectType(revision, file, { cwd }).catch(() => null);
        return type === "blob" ? sha256(await git.showBytes(revision, file, { cwd })) : null;
      };
      changedDocuments.push({ path: file, beforeSha256: await digestAt(`${commit}^`), afterSha256: await digestAt(commit) });
    }
    return {
      receipt: {
        schemaVersion: "spec-mcp-operations-receipt@1", requestId, proposalHash, outcome: "APPLIED",
        changedDocuments, migration: { snapshot, scope, sourceHash: trailer("Spec-Migration-Source") }, findings: [],
      },
      commit,
      publishedVersion: trailer("Spec-Migration-Version"),
    };
  }
  return null;
}

/**
 * The kernel applies a patch to the project's materialised read root; the
 * authoritative copy is the spec branch's worktree. Replace that one spec
 * directory after a successful apply, never the whole worktree. Archival moves
 * the spec from `.specs/<spec>` to `.specs/archive/<spec>`, so both trees have
 * to change on the branch.
 */
async function syncSpecTree({ fromRoot, worktree, spec, archiveDestination = null }) {
  const relative = archiveDestination ?? `.specs/${spec}`;
  const source = path.join(fromRoot, relative);
  const target = path.join(worktree.cwd, relative);
  await rm(target, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  await cp(source, target, { recursive: true });
  if (archiveDestination !== null) {
    await rm(path.join(worktree.cwd, ".specs", spec), { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  }
}

/**
 * Archive keeps the branch and makes the state explicit in its binding record.
 * The marker is committed with the move, so a later reader (the service, an
 * operator, a future restore) never has to infer "archived" from a missing
 * directory or an extra path.
 */
async function markArchived({ worktree, spec, destination, by, reason }) {
  const file = path.join(worktree, ".spec-kit.json");
  const binding = JSON.parse(await readFile(file, "utf8"));
  binding.archive = {
    at: new Date().toISOString(),
    by: String(by || "spec-registryd").slice(0, 160),
    path: destination,
    ...(typeof reason === "string" && reason.trim() ? { reason: reason.trim().slice(0, 512) } : {}),
  };
  const checked = validateSpecBinding(binding, { branch: binding.branch, repoUrl: binding.repo });
  if (!checked.ok) throw Object.assign(new Error(`archive marker is invalid: ${checked.errors.join("; ")}`), { code: "WRITE_STAGING_FAILED" });
  await writeFile(file, `${JSON.stringify(binding, null, 2)}\n`, "utf8");
}

/**
 * The service is the only writer to the specs repository, so everything it
 * pushes must be bot-authored. A foreign author in the range means the clone's
 * context is not what we think it is (a hijacked git environment, an operator
 * committing into the clone) — pushing it would publish commits the service
 * never authored, which is exactly how test commits once reached `main`.
 */
async function foreignAuthors({ git, cwd, branch, identity }) {
  let base = `origin/${branch}`;
  if (await git.revParse(base, { cwd }).catch(() => null) === null) base = `refs/remotes/origin/${branch}`;
  const range = `${base}..HEAD`;
  let emails;
  try {
    emails = await git.commitAuthors(range, { cwd });
  } catch {
    // No remote branch yet (first push): only the tip can be judged.
    emails = await git.commitAuthors("HEAD", { cwd });
  }
  return [...new Set(emails.filter((email) => email !== identity.email))];
}

/**
 * Write path (TASK-5): claim check -> kernel apply -> git add/commit/push as
 * the bot with Spec-Author/Spec-Request-Id trailers. Success is reported to
 * the caller only after the push is confirmed (FR-5); a failed push leaves
 * the clone ahead of remote for retry/boot reconciliation.
 */
export function createWritePipeline({ mounts, claims, identity, logger = () => {}, publish = null, projection = null, branchManager = null }) {
  return {
    async specPatch({ args, ctx, project, force, requestId, schemaVersion }) {
      const spec = typeof args.spec === "string" ? args.spec : null;
      const topic = args.topic ?? null;
      const migration = args.intent === "migrateSpec";
      if (migration && (typeof requestId !== "string" || /[\r\n\u0000]/u.test(requestId))) {
        return { envelope: errorEnvelope("specPatch", requestId, "INVALID_REQUEST", "migration requestId must be a single line", { parameter: "requestId", specSlug: spec }) };
      }
      if (topic !== null && ["archiveSpec", "approveBddCoverage"].includes(args.intent)) {
        return { envelope: errorEnvelope("specPatch", requestId, "INVALID_REQUEST", `${args.intent} must use the canonical branch`, { parameter: "topic", specSlug: spec }) };
      }
      const holder = ctx.identity.login;
      if (migration && (typeof holder !== "string" || /[\r\n\u0000]/u.test(holder))) {
        return { envelope: errorEnvelope("specPatch", requestId, "INVALID_REQUEST", "migration author must be a single-line identity", { parameter: "identity", specSlug: spec }) };
      }
      if (args.dryRun !== true && spec) {
        const held = claims.get(project, spec);
        if (held && held.holder !== holder && force !== true) {
          return {
            envelope: errorEnvelope("specPatch", requestId, "CLAIM_HELD", `spec is claimed by ${held.holder} until ${held.expiresAt}`, {
              specSlug: spec,
              holder: held.holder,
              expiresAt: held.expiresAt,
            }),
          };
        }
        if (held && held.holder !== holder && force === true) {
          logger(`forced write over claim: project=${project} spec=${spec} holder=${held.holder} owner=${holder}`);
        }
      }

      const releaseLock = args.dryRun === true ? () => {} : await mounts.acquireWriteLock(project);
      // The lock guards the working tree, not the network: a push can take
      // seconds, and readers waiting on the lock during it saw multi-second
      // boards. Release right after the commit, before the push.
      let lockReleased = false;
      const release = () => {
        if (lockReleased) return;
        lockReleased = true;
        releaseLock();
      };
      let envelope;
      let branchRoot = null;
      let publication = null;
      let ownedTag = null;
      let publicationReservation = null;
      let publicationTree = null;
      let priorReservation = null;
      let resumedCommit = null;
      let orphanTagObject = null;
      let protectedTag = null;
      let preserveProtection = false;
      try {
        if (args.dryRun !== true && typeof mounts.migrating === "function" && mounts.migrating(project)) {
        return {
          envelope: errorEnvelope("specPatch", requestId, "SPEC_MIGRATING", `project ${project} is migrating to another specs repo; retry when the move lands`, {
            specSlug: spec,
            retryable: true,
            causeCode: "SPEC_MIGRATING",
          }),
        };
      }

      let worktree = null;
      if (spec !== null) {
        try {
          worktree = await mounts.worktreeFor(project, spec, { topic, strict: migration || topic !== null, preserveChanges: true });
        } catch (error) {
          if (error?.code === "SPEC_BRANCH_MISSING" && args.intent === "createSpec" && branchManager) {
            const created = await branchManager.ensureCanonical({ project, spec, requestId, login: holder });
            if (!created.ok && created.error?.code !== "SPEC_EXISTS") return { envelope: created };
            worktree = await mounts.worktreeFor(project, spec, { preserveChanges: true });
          } else {
            return {
              envelope: errorEnvelope("specPatch", requestId, error?.code ?? "INTERNAL_ERROR", String(error?.message ?? error), {
                specSlug: spec,
                causeCode: error?.code ?? null,
                retryable: false,
              }),
            };
          }
        }
      }
      // Archived specs are read-only. A replay of the request that archived
      // them is still allowed through the kernel memo; every other write is
      // refused with a pointer to the explicit archive read surface.
      if (worktree?.archived === true && mounts.serviceFor(project).hasApplied?.(requestId) !== true) {
        return {
          envelope: errorEnvelope("specPatch", requestId, "SPEC_ARCHIVED", `specification ${spec} is archived and read-only; read it with spec_catalog view: "branches" with includeArchived: true and spec_documents action: "read" with includeArchived: true`, {
            specSlug: spec,
            retryable: false,
            causeCode: "SPEC_ARCHIVED",
          }),
        };
      }
      // The index belongs to the whole worktree, not to one specification.
      // Refuse before applying anything if another actor left staged, tracked,
      // or untracked changes anywhere in it; do not reset their work.
      if (args.dryRun !== true && worktree !== null) {
        const dirty = await worktree.git.run(["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd: worktree.cwd });
        if (dirty.stdout !== "") {
          return { envelope: errorEnvelope("specPatch", requestId, "CONFLICT", "Spec branch worktree contains local changes; preserve and resolve them before writing", { causeCode: "SPEC_WORKTREE_DIRTY", specSlug: spec }) };
        }
      }
      let migrationScope = null;
      let queryArgs = args;
      if (migration) {
        const snapshot = decodeHostedSnapshot(args.snapshot, { project, spec, topic, repository: repositoryBindingId(worktree?.repoUrl) });
        if (!snapshot) {
          return { envelope: errorEnvelope("specPatch", requestId, "CONFLICT", "snapshot belongs to another project or branch; obtain a new snapshot", { causeCode: "SPEC_SNAPSHOT_MISMATCH", retryable: true, specSlug: spec }) };
        }
        migrationScope = { project, spec, topic, head: snapshot.head, repository: snapshot.repository };
        if (args.dryRun === false) {
          const requestHash = sha256(canonicalJson({ project, topic, args: { ...args, dryRun: false } }));
          const replay = await landedMigration({ git: worktree.git, cwd: worktree.cwd, ref: worktree.ref, spec, requestId, requestHash, proposalHash: args.expectedProposalHash, snapshot: snapshot.tree, scope: migrationScope });
          if (replay?.conflict) return { envelope: errorEnvelope("specPatch", requestId, "CONFLICT", "requestId was already used for different migration content", { causeCode: "REQUEST_ID_REUSED", specSlug: spec }) };
          if (replay?.receipt) {
            if (replay.publishedVersion) {
              const confirmation = await publish?.confirmMigrationPublication?.({ project, spec, version: replay.publishedVersion, commit: replay.commit, requestHash });
              if (!confirmation?.ok) return { envelope: errorEnvelope("specPatch", requestId, "CONFLICT", "Migration reached Git, but its publication ledger is not yet confirmed; retry this request", { causeCode: "PUBLISHED_LEDGER_UNCONFIRMED", retryable: true, specSlug: spec }) };
            }
            replay.receipt.reason = args.reason;
            return { envelope: {
              schemaVersion: schemaVersion ?? "spec-kernel@2", requestId, operation: "specPatch", ok: true,
              graph: null, page: null,
              data: { schemaVersion: "spec-mcp-operations-patch@1", requestId, dryRun: false, proposalHash: args.expectedProposalHash, outcome: "APPLIED", receipt: replay.receipt },
              error: null, diagnostics: [], provenance: null,
            } };
          }
        }
        if (snapshot.head !== worktree?.head) {
          return { envelope: errorEnvelope("specPatch", requestId, "CONFLICT", "snapshot belongs to another project, branch, or source revision; obtain a new snapshot", { causeCode: "SPEC_SNAPSHOT_MISMATCH", retryable: true, specSlug: spec }) };
        }
        if (args.dryRun === false) {
          const localHead = await worktree.git.revParse("HEAD", { cwd: worktree.cwd });
          const requestHash = sha256(canonicalJson({ project, topic, args: { ...args, dryRun: false } }));
          priorReservation = publish?.findMigrationReservation?.({ project, spec, requestHash }) ?? null;
          if (priorReservation) {
            if (priorReservation.expectedHead !== snapshot.head || priorReservation.repoUrl !== worktree.repoUrl || priorReservation.repoBranch !== worktree.branch || !priorReservation.tagObject) {
              return { envelope: errorEnvelope("specPatch", requestId, "CONFLICT", "Pending publication reservation does not match the selected branch", { causeCode: "PUBLICATION_RECOVERY_REQUIRED", specSlug: spec }) };
            }
            resumedCommit = priorReservation.commitSha;
          }
          if (localHead !== snapshot.head) {
            const parent = await worktree.git.revParse("HEAD^", { cwd: worktree.cwd }).catch(() => null);
            const message = await worktree.git.run(["show", "-s", "--format=%B", localHead], { cwd: worktree.cwd });
            const ownPending = parent === snapshot.head &&
              message.stdout.split(/\r?\n/u).includes(`Spec-Request-Id: ${requestId}`) &&
              message.stdout.split(/\r?\n/u).includes(`Spec-Migration-Request: ${requestHash}`);
            if (priorReservation && (!ownPending || localHead !== resumedCommit)) {
              return { envelope: errorEnvelope("specPatch", requestId, "CONFLICT", "Pending publication commit no longer matches its reservation", { causeCode: "PUBLICATION_RECOVERY_REQUIRED", specSlug: spec }) };
            }
            if (ownPending && !priorReservation) {
              const dirty = await worktree.git.run(["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd: worktree.cwd });
              if (dirty.stdout.trim()) return { envelope: errorEnvelope("specPatch", requestId, "CONFLICT", "Worktree has local changes; resolve them before retry", { causeCode: "SPEC_WORKTREE_DIRTY", specSlug: spec }) };
              const object = await worktree.git.revParse(publicationProtectionRef(requestHash), { cwd: worktree.cwd }).catch(() => null);
              if (object) {
                const peeled = await worktree.git.revParse(`${object}^{}`, { cwd: worktree.cwd }).catch(() => null);
                if (peeled !== localHead) return { envelope: errorEnvelope("specPatch", requestId, "CONFLICT", "Pending publication protection belongs to a different commit", { causeCode: "PUBLICATION_PROTECTION_CONFLICT", specSlug: spec }) };
                orphanTagObject = object;
                resumedCommit = localHead;
              } else {
                await worktree.git.run(["reset", "--hard", snapshot.head], { cwd: worktree.cwd });
              }
            }
          }
        }
        queryArgs = { ...args, snapshot: snapshot.tree };
        delete queryArgs.topic;
        if (typeof publish?.inspectMigration !== "function") {
          const readme = await worktree.git.show(worktree.head, `.specs/${spec}/README.md`, { cwd: worktree.cwd }).catch(() => null);
          if (readme === null || /^Status:\s*ACTIVE\s*$/mu.test(readme)) {
            return { envelope: errorEnvelope("specPatch", requestId, "VALIDATION_FAILED", "ACTIVE migration requires an available publication ledger", { causeCode: "PUBLICATION_LEDGER_UNAVAILABLE", specSlug: spec }) };
          }
        } else {
          publication = await publish.inspectMigration({ project, spec, worktree, operations: args.operations, role: ctx.role,
            requestHash: args.dryRun === false ? sha256(canonicalJson({ project, topic, args: { ...args, dryRun: false } })) : null });
          if (!publication.ok) return { envelope: errorEnvelope("specPatch", requestId, "VALIDATION_FAILED", publication.message, { causeCode: publication.code, specSlug: spec, fix: [{ tool: "spec_documents", arguments: { action: "read", project, spec, doc: "README.md", ...(topic !== null ? { topic } : {}) } }] }) };
        }
      }
      if (migration || topic !== null) {
        branchRoot = await materializeBranchRoot({ mounts, project, spec, worktree });
        if (!migration) {
          queryArgs = { ...args };
          delete queryArgs.topic;
        }
      }
      const root = branchRoot?.root ?? (spec === null ? null : await mounts.projectRoot(project));
      const queryService = branchRoot?.service ?? mounts.serviceFor(project);
      envelope = await queryService.runQuery("specPatch", queryArgs, {
        requestId, schemaVersion, hostedCoverage: true, coverageOwner: ctx.role === "owner", migrationScope,
      });
      if (migration && envelope.ok && envelope.data?.outcome === "PREVIEW" && publication?.active) {
        envelope.data.migration = { ...envelope.data.migration, publication: { currentVersion: publication.oldVersion ?? null, nextVersion: publication.version, previouslyPublished: publication.published, branch: topic === null ? "canonical" : "work" } };
      }
      for (const detail of [envelope.error, envelope.data?.error]) {
        if (!Array.isArray(detail?.fix)) continue;
        detail.fix = detail.fix.map((fix) => fix?.tool === "spec_documents"
          ? { ...fix, arguments: { ...fix.arguments, project, ...(topic !== null ? { topic } : {}) } }
          : fix);
      }
      if (!(envelope.ok && envelope.data?.outcome === "APPLIED")) return { envelope };
      if (worktree === null) return { envelope };
      const { git, cwd, branch } = worktree;
      let committedHead = null;

      const receipt = envelope.data.receipt ?? {};
      // Archival removes the live spec tree and installs it under
      // `.specs/archive/<spec>`. Mirror that exact move on the branch; copying
      // the source tree would read a directory the kernel already removed.
      const archiveDestination = receipt.archive === undefined ? null : `.specs/archive/${spec}`;
      // A replay of an archive that already landed has nothing left in the
      // read root to copy: the branch holds the archive and the live tree is
      // gone. Check the branch before syncSpecTree reads a missing directory.
      const archiveLanded = async () => {
        if (archiveDestination === null) return false;
        for (const ref of ["HEAD", `origin/${branch}`]) {
          const archived = await git.objectType(ref, archiveDestination, { cwd }).catch(() => null);
          if (archived !== "tree") continue;
          const live = await git.objectType(ref, `.specs/${spec}`, { cwd }).catch(() => null);
          if (live === null) return true;
        }
        return false;
      };
      const forgetApplied = () => {
        if (typeof requestId !== "string" || requestId.length === 0) return;
        try {
          queryService.forgetApplied?.(requestId);
        } catch (error) {
          logger(`could not clear the applied memo for ${project}/${spec}: ${error.message}`);
        }
      };
      if (receipt.archive !== undefined && receipt.archive?.destination !== archiveDestination) {
        release();
        forgetApplied();
        await mounts.refreshProject?.(project).catch((refreshError) => logger(`refresh after invalid archive receipt failed for ${project}/${spec}: ${refreshError.message}`));
        return {
          envelope: errorEnvelope("specPatch", requestId, "INTERNAL_ERROR", "the archive receipt names an unexpected destination", {
            retryable: false,
            causeCode: "ARCHIVE_DESTINATION_INVALID",
            specSlug: spec,
          }),
        };
      }
      const pushBotCommits = async () => {
        const foreign = await foreignAuthors({ git, cwd, branch, identity });
        if (foreign.length > 0) {
          const refusal = new Error(`the clone carries commits authored by ${foreign.join(", ")}`);
          refusal.causeCode = "FOREIGN_COMMITS";
          throw refusal;
        }
        if (branchRoot && migration && topic === null && publication?.active) {
          const tagRef = `refs/tags/${publishTagName(project, spec, publication.version)}`;
          let tag;
          if (priorReservation || orphanTagObject) {
            const object = priorReservation?.tagObject ?? orphanTagObject;
            const peeled = await git.revParse(`${object}^{}`, { cwd }).catch(() => null);
            const localTag = await git.revParse(tagRef, { cwd }).catch(() => null);
            const tagText = await git.run(["cat-file", "-p", object], { cwd }).then((result) => result.stdout).catch(() => "");
            if (peeled !== committedHead || localTag || !tagText.split(/\r?\n/u).includes(`tag ${publishTagName(project, spec, publication.version)}`)) throw Object.assign(new Error("Reserved tag object is missing or a local tag conflicts with recovery"), { causeCode: "PUBLICATION_RECOVERY_REQUIRED" });
            tag = { ref: tagRef, object, git, cwd };
          } else {
            ownedTag = await createOwnedPublicationTag({ git, cwd, project, spec, version: publication.version, commit: committedHead, identity });
            tag = ownedTag;
          }
          publicationTree = await git.objectId(committedHead, `.specs/${spec}`, { cwd });
          const requestHash = sha256(canonicalJson({ project, topic, args: { ...args, dryRun: false } }));
          protectedTag = await protectPublicationTag({ tag, requestHash });
          publicationReservation = await publish.reserveMigrationPublication({ project, spec, publication, metadata: {
            requestHash,
            commitSha: committedHead, tagObject: tag.object, digest: publicationTree, expectedHead: worktree.head, repoUrl: worktree.repoUrl, repoBranch: branch,
          } });
          if (!publicationReservation.ok) throw Object.assign(new Error(publicationReservation.message), { causeCode: publicationReservation.code });
          preserveProtection = true;
          if (ownedTag) { await removeOwnedPublicationTag(ownedTag); ownedTag = null; }
          await pushBranchAndPublicationTag({ git, cwd, branch, expectedHead: worktree.head, tag });
        } else if (branchRoot) {
          // A normal fast-forward push can still succeed after the remote was
          // rewound. The explicit lease pins the exact tip used for preview.
          await git.run(["push", `--force-with-lease=refs/heads/${branch}:${worktree.head}`, "origin", `HEAD:refs/heads/${branch}`], { cwd });
        } else {
          await git.push({ refspec: `HEAD:refs/heads/${branch}` }, { cwd });
        }
      };
      const afterPush = async () => {
        await mounts.refreshProject?.(project).catch((refreshError) => logger(`refresh after write failed for ${project}/${spec}: ${refreshError.message}`));
        if (topic !== null) return;
        // Publish is post-confirmation work (FR-11): the write already
        // succeeded, so a publish failure is logged, never reported as a
        // failed write.
        await publish?.publishSpec(project, spec).then((result) => {
          if (result?.outcome === "published" || result?.outcome === "adopted") logger(`published ${result.spec}@${result.version}`);
          if (result?.outcome === "rejected") logger(`publish rejected ${result.spec}: ${result.code}`);
          if (result?.outcome === "skipped") logger(`publish skipped ${result.spec}: ${result.reason}`);
        }).catch((publishError) => logger(`publish after write failed for ${project}/${spec}: ${publishError.message}`));
        // Tracker projection is post-confirmation work too: the pushed commit
        // re-projects cards + the committed snapshot; failures are logged by
        // the projection loop, never reported as a failed write.
        projection?.syncNow();
      };
      const commitPublicationReservation = () => {
        if (!publicationReservation?.ok) return false;
        const reservation = publicationReservation;
        publicationReservation = null;
        try {
          reservation.commit({ digest: publicationTree, commitSha: committedHead, repoUrl: worktree.repoUrl, repoBranch: branch });
          return true;
        } catch (error) {
          logger(`publication ledger commit failed for ${project}/${spec}: ${error.message}`);
          return false;
        }
      };
      let stage = "sync";
      try {
        let resuming = false;
        if (branchRoot) {
          const localHead = await git.revParse("HEAD", { cwd });
          const dirty = await git.run(["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd });
          if (dirty.stdout.trim() !== "") throw new Error("branch worktree contains uncommitted specification changes");
          if (resumedCommit) {
            if (await git.revParse(`${resumedCommit}^`, { cwd }).catch(() => null) !== worktree.head) throw new Error("reserved commit no longer has the reviewed parent");
            if (localHead === worktree.head) await git.mergeFF(resumedCommit, { cwd });
            if (await git.revParse("HEAD", { cwd }) !== resumedCommit) throw new Error("reserved commit is unavailable in this worktree");
            const desired = await specificationDirectoryDigest(root, spec);
            const existing = await specificationDirectoryDigest(cwd, spec);
            if (!desired.ok || !existing.ok || desired.digest !== existing.digest) throw new Error("reserved commit differs from the reviewed migration result");
            committedHead = resumedCommit;
            resuming = true;
          } else if (localHead !== worktree.head) {
            await git.mergeFF(worktree.ref, { cwd });
            if (await git.revParse("HEAD", { cwd }) !== worktree.head) throw new Error("branch worktree diverged from selected remote tip");
          }
        }
        const alreadyArchived = await archiveLanded();
        if (!alreadyArchived && !resuming) {
          await syncSpecTree({ fromRoot: root, worktree, spec, archiveDestination });
          if (archiveDestination !== null) {
            stage = "marker";
            await markArchived({ worktree: cwd, spec, destination: archiveDestination, by: holder, reason: args.reason });
          }
        }
        const changed = alreadyArchived || resuming
          ? []
          : archiveDestination === null
            ? [`.specs/${spec}`]
            : [".spec-kit.json", `.specs/${spec}`, archiveDestination];
        stage = "add";
        if (changed.length) await git.add(changed, { cwd });
        stage = "commit";
        if (!resuming && await git.hasStagedChanges({ cwd })) {
          const staged = await git.run(["diff", "--cached", "--name-only", "-z", "--"], { cwd });
          const allowed = (name) => changed.some((target) => name === target || name.startsWith(`${target}/`));
          if (staged.stdout.split("\u0000").filter(Boolean).some((name) => !allowed(name))) {
            throw Object.assign(new Error("Worktree index contains changes outside the requested specification"), { causeCode: "SPEC_WORKTREE_DIRTY" });
          }
          await git.commit({
            message: commitMessage({
              subject: archiveDestination === null
                ? `spec(${project}): apply ${short(receipt.proposalHash)}`
                : `spec(${project}): archive ${short(receipt.proposalHash)}`,
              trailers: {
                "Spec-Author": holder,
                "Spec-Request-Id": String(requestId ?? ""),
                ...(migration ? {
                  "Spec-Migration-Proposal": String(receipt.proposalHash ?? ""),
                  "Spec-Migration-Request": sha256(canonicalJson({ project, topic, args: { ...args, dryRun: false } })),
                  "Spec-Migration-Source": String(receipt.migration?.sourceHash ?? ""),
                  ...(topic === null && publication?.active ? { "Spec-Migration-Version": publication.version } : {}),
                } : {}),
              },
            }),
            authorName: identity.name,
            authorEmail: identity.email,
            cwd,
            paths: changed,
          });
          committedHead = await git.revParse("HEAD", { cwd });
        } else {
          // A replay (or a no-op write): the branch already carries the
          // change, so pushing below is a no-op. Creating an empty commit
          // would rewrite the same content under a new SHA.
          logger(`nothing to commit for ${project}/${spec}; the write is already on the branch`);
        }
        // Commit is the last step that needs the write lock: everything below
        // is remote work (push, publish, projection) and must not block reads.
        if (!branchRoot) release();
      } catch (error) {
        // The kernel already applied the change to the read root, but the
        // branch never received it. Drop the APPLIED memo (otherwise the same
        // requestId replays a write that never landed), rebuild the
        // materialised root from the committed branches, and report the
        // failure — never let a failed commit masquerade as a successful push
        // of an empty range.
        release();
        forgetApplied();
        await mounts.refreshProject?.(project).catch((refreshError) => logger(`refresh after failed commit failed for ${project}/${spec}: ${refreshError.message}`));
        return {
          envelope: errorEnvelope("specPatch", requestId, "INTERNAL_ERROR", `write applied locally but the ${stage} step on the specs branch failed: ${error.message}`, {
            retryable: true,
            causeCode: stage === "commit" ? "GIT_COMMIT_FAILED" : "WRITE_STAGING_FAILED",
            stage,
            specSlug: spec,
          }),
        };
      }
      try {
        await pushBotCommits();
      } catch (error) {
        if (publicationReservation?.ok) {
          const tagRef = `refs/tags/${publishTagName(project, spec, publication.version)}`;
          let observed = null;
          try {
            const probe = await git.runBounded(["ls-remote", "origin", `refs/heads/${branch}`, `${tagRef}*`], { cwd, timeoutMs: 5_000 });
            observed = new Map(probe.stdout.split(/\r?\n/u).filter(Boolean).map((line) => { const [sha, ref] = line.split("\t"); return [ref, sha]; }));
          } catch {}
          const remoteBranch = observed?.get(`refs/heads/${branch}`) ?? null;
          const remoteTag = observed?.get(`${tagRef}^{}`) ?? observed?.get(tagRef) ?? null;
          if (remoteBranch === committedHead && remoteTag === committedHead) {
            if (!commitPublicationReservation()) return { envelope: errorEnvelope("specPatch", requestId, "CONFLICT", "Migration reached Git, but its publication ledger is not yet confirmed; retry this request", { causeCode: "PUBLISHED_LEDGER_UNCONFIRMED", retryable: true, specSlug: spec }) };
            const confirmation = await publish.confirmMigrationPublication({ project, spec, version: publication.version, commit: committedHead, requestHash: sha256(canonicalJson({ project, topic, args: { ...args, dryRun: false } })) });
            if (!confirmation.ok) return { envelope: errorEnvelope("specPatch", requestId, "CONFLICT", "Migration reached Git, but its publication ledger is not yet confirmed; retry this request", { causeCode: "PUBLISHED_LEDGER_UNCONFIRMED", retryable: true, specSlug: spec }) };
            protectedTag = null; preserveProtection = false;
            await afterPush().catch((postError) => logger(`post-write work failed for ${project}/${spec}: ${postError.message}`));
            return { envelope };
          }
          if (!observed || remoteTag === committedHead) {
            publicationReservation = null; // durable reservation remains for verified recovery
            return { envelope: errorEnvelope("specPatch", requestId, "CONFLICT", "Git outcome is unknown; retry to reconcile the publication ledger", { causeCode: "PUBLISHED_LEDGER_UNCONFIRMED", retryable: true, specSlug: spec }) };
          }
          publicationReservation.rollback();
          publicationReservation = null;
          preserveProtection = false;
          await removePublicationProtection(protectedTag);
          protectedTag = null;
        }
        const foreignRefusal = (caught) =>
          caught?.causeCode === "FOREIGN_COMMITS"
            ? {
                envelope: errorEnvelope("specPatch", requestId, "INTERNAL_ERROR", `refusing to publish: ${caught.message}`, {
                  retryable: false,
                  causeCode: "FOREIGN_COMMITS",
                  specSlug: spec,
                }),
              }
            : null;
        // Never publish commits the service did not author: a foreign author
        // means the clone's git context is not what we think it is.
        const direct = foreignRefusal(error);
        if (direct) return direct;
        if (migration || topic !== null) {
          // Never rebase a proposal that was approved against a particular tip.
          forgetApplied();
          let remoteHead = null;
          try {
            await mounts.ensureRepo(project, { fetch: true, strict: true });
            remoteHead = await git.revParse(worktree.ref, { cwd });
          } catch {}
          if (committedHead && remoteHead === committedHead) {
            if (publication?.active && topic === null) {
              if (!commitPublicationReservation()) return { envelope: errorEnvelope("specPatch", requestId, "CONFLICT", "Migration reached Git, but its publication ledger is not yet confirmed; retry this request", { causeCode: "PUBLISHED_LEDGER_UNCONFIRMED", retryable: true, specSlug: spec }) };
              const confirmation = await publish?.confirmMigrationPublication?.({ project, spec, version: publication.version, commit: committedHead, requestHash: sha256(canonicalJson({ project, topic, args: { ...args, dryRun: false } })) });
              if (!confirmation?.ok) return { envelope: errorEnvelope("specPatch", requestId, "CONFLICT", "Migration reached Git, but its publication ledger is not yet confirmed; retry this request", { causeCode: "PUBLISHED_LEDGER_UNCONFIRMED", retryable: true, specSlug: spec }) };
              protectedTag = null; preserveProtection = false;
            }
            await afterPush().catch((postError) => logger(`post-write work failed for ${project}/${spec}: ${postError.message}`));
            return { envelope };
          }
          if (committedHead && remoteHead && await git.revParse("HEAD", { cwd }) === committedHead) {
            const dirty = await git.run(["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd });
            if (dirty.stdout === "") await git.run(["reset", "--hard", worktree.head], { cwd });
          }
          let causeCode = error?.causeCode ?? (remoteHead ? "GIT_PUSH_FAILED" : "GIT_PUSH_UNCONFIRMED");
          if (publication?.active && topic === null && remoteHead) {
            const tagRef = `refs/tags/${publishTagName(project, spec, publication.version)}`;
            const refs = await git.lsRemote(`${tagRef}*`, { cwd }).catch(() => null);
            if (refs && (refs.has(tagRef) || refs.has(`${tagRef}^{}`))) causeCode = "VERSION_EXISTS";
          }
          return { envelope: errorEnvelope("specPatch", requestId, "CONFLICT", `could not confirm push to ${branch}; obtain a fresh branch snapshot`, {
            retryable: causeCode !== "VERSION_EXISTS", causeCode, specSlug: spec,
          }) };
        }
        // A rejected push means the remote moved (break-glass, another writer):
        // replay the local commit on top of it and retry once, so the write is
        // never silently dropped and the clone does not stay stuck ahead.
        const recovered = await reconcileClone({ git, cwd, branch, identity, logger })
          .then(pushBotCommits)
          .then(() => true)
          .catch((retryError) => {
            logger(`push retry after reconcile failed: ${retryError.message}`);
            return retryError;
          });
        if (recovered === true) {
          logger(`pushed ${project} ${short(receipt.proposalHash)} after reconcile`);
          await afterPush().catch((postError) => logger(`post-write work failed for ${project}/${spec}: ${postError.message}`));
          return { envelope };
        }
        // A foreign author discovered during the retry is the same policy
        // refusal, not a transient failure: never report it as retryable.
        const afterReconcile = foreignRefusal(recovered);
        if (afterReconcile) return afterReconcile;
        return {
          envelope: errorEnvelope("specPatch", requestId, "INTERNAL_ERROR", `write applied locally but the push to the specs repo failed: ${error.message}`, {
            retryable: true,
            causeCode: "GIT_PUSH_FAILED",
            specSlug: spec,
          }),
        };
      }
      if (migration && topic === null && publication?.active) {
        if (!commitPublicationReservation()) return { envelope: errorEnvelope("specPatch", requestId, "CONFLICT", "Migration reached Git, but its publication ledger is not yet confirmed; retry this request", { causeCode: "PUBLISHED_LEDGER_UNCONFIRMED", retryable: true, specSlug: spec }) };
        const confirmation = await publish?.confirmMigrationPublication?.({ project, spec, version: publication.version, commit: committedHead, requestHash: sha256(canonicalJson({ project, topic, args: { ...args, dryRun: false } })) });
        if (!confirmation?.ok) return { envelope: errorEnvelope("specPatch", requestId, "CONFLICT", "Migration reached Git, but its publication ledger is not yet confirmed; retry this request", { causeCode: "PUBLISHED_LEDGER_UNCONFIRMED", retryable: true, specSlug: spec }) };
        protectedTag = null; preserveProtection = false;
      }
      logger(`pushed ${project} ${short(receipt.proposalHash)}`);
      await afterPush().catch((postError) => logger(`post-write work failed for ${project}/${spec}: ${postError.message}`));
      } finally {
        // An unresolved push keeps its durable reservation until Git proves
        // the outcome; it must not expire while a remote push may be alive.
        try {
          if (protectedTag?.created && !preserveProtection) await removePublicationProtection(protectedTag);
        } finally {
          try { await removeOwnedPublicationTag(ownedTag); } finally { try { await branchRoot?.cleanup(); } finally { release(); } }
        }
      }
      return { envelope };
    },
  };
}

function short(hash) {
  return typeof hash === "string" && hash.length > 0 ? hash.slice(0, 12) : "patch";
}
