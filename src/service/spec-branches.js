import { existsSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { serviceErrorEnvelope, serviceSuccess } from "./dispatch.js";
import { commitMessage } from "./git.js";
import { listSpecRefs, readSpecBinding } from "./spec-discovery.js";
import { specBranchName, specWorkBranchName, validateSpecBinding } from "./spec-binding.js";
import { publishTagName, createOwnedPublicationTag, pushBranchAndPublicationTag, removeOwnedPublicationTag, protectPublicationTag, removePublicationProtection, publicationProtectionRef } from "./publish.js";
import { authoredField } from "./registry.js";
import { canonicalJson, sha256 } from "../authoring/transactions.js";
import { isValidSpecSlug } from "../kernel/identity.js";
import { changedReadyCoverageFindings, changedTaskCoverageFindings, coverageRegion } from "../authoring/bdd-coverage.js";
import { introducedDefinitionFindings } from "../authoring/definition-integrity.js";
import { readRepositorySpecs } from "../kernel/adapters/fs.js";
import { buildKernelGraph } from "../kernel/graph/build.js";
import { canonicalDocumentFilename, GHERKIN_DOCUMENT_KINDS, isLegacySpecificationDocument } from "../kernel/types.js";
import { gherkinPairFindings, parseGherkinDocument } from "../kernel/parsers/gherkin.js";

const SPEC_BINDING_FILE = ".spec-kit.json";

function failure(requestId, code, message, extra = {}) {
  return serviceErrorEnvelope("specBranch", requestId, code, message, extra);
}

function parseArgs(args) {
  const action = args?.action;
  if (action !== "create" && action !== "merge" && action !== "delete" && action !== "deleteSpec") {
    return { error: ["action must be create, merge, delete, or deleteSpec", { parameter: "action" }] };
  }
  if (typeof args.spec !== "string" || args.spec.length === 0) {
    return { error: ["spec is required", { parameter: "spec" }] };
  }
  if (!isValidSpecSlug(args.spec)) {
    return { error: ["spec must be a valid slug", { parameter: "spec" }] };
  }
  if (args.topic !== undefined && (typeof args.topic !== "string" || args.topic.length === 0)) {
    return { error: ["topic must be a non-empty string", { parameter: "topic" }] };
  }
  if (args.topic !== undefined && !isValidSpecSlug(args.topic)) {
    return { error: ["topic must be a valid slug", { parameter: "topic" }] };
  }
  return { action, spec: args.spec, topic: args.topic ?? null };
}

async function tempRepo() {
  return mkdtemp(path.join(tmpdir(), "spec-branch-"));
}

async function cleanup(dir) {
  await rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
}

/**
 * `spec_branch` (P3): canonical specs are orphan `spec-<slug>` branches;
 * `spec-<slug>--<topic>` holds unmerged work and is merged directly by the
 * service under the project write lock. Deleting a canonical branch is never
 * allowed — archive is a separate, audited operation.
 */
export function createSpecBranchManager({ mounts, claims = null, identity, logger = () => {}, audit = () => {}, publish = null, projection = null, store = null, dependents = null }) {
  async function branchExists(mount, branch) {
    return (await mount.git.revParse(`refs/remotes/origin/${branch}`, { cwd: mount.mirrorDir }).catch(() => null)) !== null;
  }

  /**
   * A branch is only addressable through the project named in its own
   * `.spec-kit.json`. One repository may host several projects, so the
   * `<owner>/<project>` request scope alone is not enough: a writer of project
   * A must not delete project B's branch in the same mirror.
   */
  async function ownedBinding({ mount, project, spec, ref }) {
    try {
      const raw = await readSpecBinding({ git: mount.git, cwd: mount.mirrorDir, branch: ref });
      const valid = validateSpecBinding(raw, { branch: specBranchName(spec), repoUrl: mount.repoUrl });
      if (!valid.ok || raw.project !== project || raw.spec !== spec) {
        return { error: `branch ${ref} does not belong to ${project}/${spec}: ${valid.errors.join("; ") || "metadata disagrees"}` };
      }
      return { binding: raw };
    } catch (error) {
      return { error: String(error?.message ?? error).split("\n")[0] };
    }
  }

  async function createCanonical({ project, spec, requestId, login, skeleton = true, role = null, demo = false }) {
    const mount = await mounts.ensureRepo(project);
    const branch = specBranchName(spec);
    // A branch with this name means the slug is taken repository-wide, even
    // when its metadata belongs to another project or is invalid. Never try
    // to overwrite it with a non-fast-forward push.
    if (await branchExists(mount, branch)) {
      return failure(requestId, "SPEC_EXISTS", `spec ${spec} already exists in ${project}`);
    }
    const { branches } = await mounts.listBranches(project);
    if (branches.some((entry) => entry.spec === spec)) {
      return failure(requestId, "SPEC_EXISTS", `spec ${spec} already exists in ${project}`);
    }
    const dir = await tempRepo();
    try {
      await mount.git.run(["init", "-q"], { cwd: dir });
      const metadata = {
        schema: "omp-spec-kit/spec-binding@1",
        project,
        spec,
        repo: mount.repoUrl,
        branch,
        createdAt: new Date().toISOString(),
        owner: project.split("/")[0],
        ...(demo === true ? { demo: true } : {}),
      };
      await writeFile(path.join(dir, SPEC_BINDING_FILE), `${JSON.stringify(metadata, null, 2)}\n`);
      if (skeleton) {
        const specDir = path.join(dir, ".specs", spec);
        await mkdir(specDir, { recursive: true });
        await writeFile(path.join(specDir, "README.md"), `# ${spec}\n\nStatus: DRAFT\n`);
      }
      await mount.git.run(["-C", dir, "add", "-A"], { cwd: mount.cwd });
      await mount.git.run([
        "-C", dir,
        "-c", `user.name=${identity.name}`,
        "-c", `user.email=${identity.email}`,
        "commit", "-qm", `chore: create ${branch}`,
      ], { cwd: mount.cwd });
      await mount.git.run(["-C", dir, "push", "-q", mount.repoUrl, `HEAD:refs/heads/${branch}`], { cwd: mount.cwd });
      const commit = await mount.git.run(["-C", dir, "rev-parse", "HEAD"], { cwd: mount.cwd }).then((result) => result.stdout.trim());
      await mounts.ensureRepo(project);
      await mounts.refreshProject(project);
      audit({ login, role, project, op: "spec-branch-create", spec, result: `ok:${branch}` });
      projection?.syncNow();
      logger(`created ${branch} for ${project}`);
      return serviceSuccess("specBranch", requestId, { action: "create", kind: "spec", branch, spec, topic: null, commit });
    } catch (error) {
      console.error("spec_branch canonical create failed:", error?.stack ?? error);
      throw error;
    } finally {
      await cleanup(dir);
    }
  }

  async function createWork({ project, spec, topic, requestId, login, role = null }) {
    const mount = await mounts.ensureRepo(project);
    const canonical = specBranchName(spec);
    const canonicalRef = `refs/remotes/origin/${canonical}`;
    if (!(await branchExists(mount, canonical))) {
      return failure(requestId, "SPEC_NOT_FOUND", `spec ${spec} has no ${canonical} branch`);
    }
    const owned = await ownedBinding({ mount, project, spec, ref: canonicalRef });
    if (owned.error) return failure(requestId, "SPEC_BINDING_INVALID", owned.error);
    if (owned.binding.archive !== undefined) {
      return failure(requestId, "SPEC_ARCHIVED", `spec ${spec} is archived; its branch is read-only`, { specSlug: spec });
    }
    const prefix = `.specs/${spec}/`;
    const listed = await mount.git.run(["ls-tree", "-r", "-z", "--name-only", canonicalRef, "--", prefix], { cwd: mount.mirrorDir });
    const names = new Set(listed.stdout.split("\u0000").filter(Boolean).map((filename) => filename.slice(prefix.length)));
    const legacy = [...names].filter((name) => isLegacySpecificationDocument(name, spec));
    const missing = GHERKIN_DOCUMENT_KINDS.map((kind) => canonicalDocumentFilename(kind, spec)).filter((name) => !names.has(name));
    const readmeEntry = names.size === 1 && names.has("README.md")
      ? await mount.git.run(["ls-tree", canonicalRef, "--", `${prefix}README.md`], { cwd: mount.mirrorDir }) : null;
    const scaffold = /^100(?:644|755) blob [0-9a-f]+\t/u.test(readmeEntry?.stdout ?? "") &&
      await mount.git.show(canonicalRef, `${prefix}README.md`, { cwd: mount.mirrorDir }) === `# ${spec}\n\nStatus: DRAFT\n`;
    if (legacy.length || (missing.length && !scaffold)) {
      return failure(requestId, "VALIDATION_FAILED", "Migrate the canonical specification before creating a work branch", {
        causeCode: legacy.length ? "LEGACY_SPEC_LAYOUT" : "INCOMPLETE_GHERKIN_PAIR", specSlug: spec,
        fix: [{ tool: "spec_documents", arguments: { action: "list", project, spec, includeSnapshot: true } }],
      });
    }
    const branch = specWorkBranchName(spec, topic);
    if (await branchExists(mount, branch)) {
      return failure(requestId, "BRANCH_EXISTS", `branch ${branch} already exists`);
    }
    await mount.git.run(
      ["--git-dir", mount.mirrorDir, "push", "-q", mount.repoUrl, `${canonicalRef}:refs/heads/${branch}`],
      { cwd: mount.cwd },
    );
    await mounts.ensureRepo(project);
    audit({ login, role, project, op: "spec-branch-create", spec, result: `ok:${branch}` });
    logger(`created work branch ${branch}`);
    return serviceSuccess("specBranch", requestId, { action: "create", kind: "work", branch, spec, topic, commit: null });
  }

  /** Resume only the exact operation-owned merge commit recorded before crash. */
  async function recoverReservedMerge({ project, spec, topic, requestId, login, role, worktree, canonicalRef, topicRef, canonical, branch }) {
    const { git, cwd } = worktree;
    const remoteHead = await git.revParse(canonicalRef, { cwd });
    const localHead = await git.revParse("HEAD", { cwd });
    if (localHead === remoteHead) return { restart: true };
    const message = await git.run(["show", "-s", "--format=%B", localHead], { cwd });
    const version = /^Spec-Migration-Merge-Version: ([^\r\n]+)$/mu.exec(message.stdout)?.[1];
    const originalRequest = /^Spec-Migration-Merge-Request-Id: ([^\r\n]+)$/mu.exec(message.stdout)?.[1];
    const firstParent = await git.revParse(`${localHead}^1`, { cwd }).catch(() => null);
    const secondParent = await git.revParse(`${localHead}^2`, { cwd }).catch(() => null);
    const topicHead = await git.revParse(topicRef, { cwd });
    const author = (await git.run(["show", "-s", "--format=%ae", localHead], { cwd })).stdout.trim();
    const dirty = await git.run(["status", "--porcelain"], { cwd });
    if (!version || originalRequest !== requestId || firstParent !== remoteHead || secondParent !== topicHead || author !== identity.email || dirty.stdout.trim()) return null;
    const requestHash = sha256(canonicalJson({ project, spec, topic, requestId, expectedHead: remoteHead, version }));
    let pending = publish?.findMigrationReservation?.({ project, spec, requestHash }) ?? null;
    if (!pending) {
      // A crash can leave the operation's protection ref just before the
      // durable reservation is written. Reuse that exact commit and tag.
      const object = await git.revParse(publicationProtectionRef(requestHash), { cwd }).catch(() => null);
      if (!object) {
        await git.run(["reset", "--hard", remoteHead], { cwd });
        return { restart: true };
      }
      if (await git.revParse(`${object}^{}`, { cwd }).catch(() => null) !== localHead) {
        return { result: failure(requestId, "PUBLICATION_PROTECTION_CONFLICT", "Pending protection belongs to a different merge", { specSlug: spec }) };
      }
      pending = { commitSha: localHead, expectedHead: remoteHead, repoUrl: worktree.repoUrl, repoBranch: canonical, tagObject: object, digest: await git.objectId(localHead, `.specs/${spec}`, { cwd }) };
    }
    if (pending.commitSha !== localHead || pending.expectedHead !== remoteHead || pending.repoUrl !== worktree.repoUrl || pending.repoBranch !== canonical || !pending.tagObject) {
      return { result: failure(requestId, "PUBLICATION_RECOVERY_REQUIRED", "Reserved merge does not match the selected branch", { specSlug: spec }) };
    }
    const actualTree = await git.objectId(localHead, `.specs/${spec}`, { cwd });
    const peeled = await git.revParse(`${pending.tagObject}^{}`, { cwd }).catch(() => null);
    const tagRef = `refs/tags/${publishTagName(project, spec, version)}`;
    const tagText = await git.run(["cat-file", "-p", pending.tagObject], { cwd }).then((result) => result.stdout).catch(() => "");
    if (actualTree !== pending.digest || peeled !== localHead || !tagText.split(/\r?\n/u).includes(`tag ${publishTagName(project, spec, version)}`)) {
      return { result: failure(requestId, "PUBLICATION_RECOVERY_REQUIRED", "Reserved merge commit or annotated tag is unavailable", { specSlug: spec }) };
    }
    const readme = await git.show(localHead, `.specs/${spec}/README.md`, { cwd });
    const publication = await publish.inspectMigration({ project, spec, worktree: { ...worktree, head: remoteHead }, role, requestHash, allowStatusChange: true,
      operations: [{ kind: "replace_document", document: "README.md", content: readme }] });
    if (!publication.ok) return { result: failure(requestId, "VALIDATION_FAILED", publication.message, { causeCode: publication.code, specSlug: spec }) };
    const protection = await protectPublicationTag({ tag: { ref: tagRef, object: pending.tagObject, git, cwd }, requestHash });
    const reservation = await publish.reserveMigrationPublication({ project, spec, publication, metadata: {
      requestHash, commitSha: localHead, tagObject: pending.tagObject, digest: pending.digest, expectedHead: remoteHead, repoUrl: worktree.repoUrl, repoBranch: canonical,
    } });
    if (!reservation.ok) return { result: failure(requestId, "CONFLICT", reservation.message, { causeCode: reservation.code, specSlug: spec }) };
    try {
      await pushBranchAndPublicationTag({ git, cwd, branch: canonical, expectedHead: remoteHead, tag: { ref: tagRef, object: pending.tagObject } });
    } catch {
      let refs = null;
      try {
        const result = await git.runBounded(["ls-remote", "origin", `refs/heads/${canonical}`, `${tagRef}*`], { cwd, timeoutMs: 5_000 });
        refs = new Map(result.stdout.split(/\r?\n/u).filter(Boolean).map((line) => { const [sha, ref] = line.split("\t"); return [ref, sha]; }));
      } catch {}
      const tagged = refs?.get(`${tagRef}^{}`) ?? refs?.get(tagRef) ?? null;
      if (refs?.get(`refs/heads/${canonical}`) !== localHead || tagged !== localHead) {
        if (refs && tagged !== localHead) {
          reservation.rollback();
          await removePublicationProtection(protection);
        }
        return { result: failure(requestId, "PUBLISHED_LEDGER_UNCONFIRMED", "Could not confirm the reserved merge; retry after checking the remote", { retryable: true, specSlug: spec }) };
      }
    }
    try {
      reservation.commit({ digest: pending.digest, commitSha: localHead, repoUrl: pending.repoUrl, repoBranch: canonical });
    } catch {
      return { result: failure(requestId, "PUBLISHED_LEDGER_UNCONFIRMED", "Merge reached Git, but its ledger is not confirmed", { retryable: true, specSlug: spec }) };
    }
    const confirmation = await publish.confirmMigrationPublication({ project, spec, version, commit: localHead, requestHash });
    if (!confirmation.ok) return { result: failure(requestId, "PUBLISHED_LEDGER_UNCONFIRMED", "Merge reached Git, but its ledger is not confirmed", { retryable: true, specSlug: spec }) };
    await git.run(["push", `--force-with-lease=refs/heads/${branch}:${topicHead}`, "origin", `:refs/heads/${branch}`], { cwd }).catch((error) => logger(`recovered merge but could not delete ${branch}: ${error.message}`));
    await mounts.refreshProject(project);
    audit({ login, role, project, op: "spec-branch-merge", spec, result: `ok:${branch}:${localHead.slice(0, 12)}` });
    projection?.syncNow();
    return { result: serviceSuccess("specBranch", requestId, { action: "merge", kind: "work", branch, spec, topic, commit: localHead }) };
  }

  async function mergeWork({ project, spec, topic, requestId, login, role = null }) {
    const mount = await mounts.ensureRepo(project);
    const canonical = specBranchName(spec);
    const branch = specWorkBranchName(spec, topic);
    const topicRef = `refs/remotes/origin/${branch}`;
    const canonicalRef = `refs/remotes/origin/${canonical}`;
    if (!(await mount.git.revParse(topicRef, { cwd: mount.mirrorDir }).catch(() => null))) {
      return failure(requestId, "BRANCH_NOT_FOUND", `branch ${branch} does not exist`);
    }
    if (!(await mount.git.revParse(canonicalRef, { cwd: mount.mirrorDir }).catch(() => null))) {
      return failure(requestId, "SPEC_NOT_FOUND", `spec ${spec} has no ${canonical} branch`);
    }
    const canonicalOwned = await ownedBinding({ mount, project, spec, ref: canonicalRef });
    if (canonicalOwned.error) return failure(requestId, "SPEC_BINDING_INVALID", canonicalOwned.error);
    if (canonicalOwned.binding.archive !== undefined) {
      return failure(requestId, "SPEC_ARCHIVED", `spec ${spec} is archived; its branch is read-only`, { specSlug: spec });
    }
    // The topic branch must carry the canonical metadata; a rewritten
    // `.spec-kit.json` would turn a merge into a silent re-binding.
    const raw = await readSpecBinding({ git: mount.git, cwd: mount.mirrorDir, branch: topicRef });
    const valid = validateSpecBinding(raw, { branch: canonical, repoUrl: mount.repoUrl });
    if (!valid.ok || raw.project !== project || raw.spec !== spec) {
      return failure(requestId, "SPEC_BINDING_INVALID", `branch ${branch} carries invalid metadata: ${valid.errors.join("; ") || "metadata disagrees"}`);
    }
    const { stdout: changed } = await mount.git.run(["diff", "--name-only", `${canonicalRef}..${topicRef}`], { cwd: mount.mirrorDir });
    const paths = changed.split(/\r?\n/u).filter(Boolean);
    if (paths.length === 0) {
      const tip = await mount.git.revParse(canonicalRef, { cwd: mount.mirrorDir });
      const message = await mount.git.run(["show", "-s", "--format=%B", tip], { cwd: mount.mirrorDir });
      const pendingVersion = /^Spec-Migration-Merge-Version: ([^\r\n]+)$/mu.exec(message.stdout)?.[1];
      if (pendingVersion) {
        const originalRequest = /^Spec-Migration-Merge-Request-Id: ([^\r\n]+)$/mu.exec(message.stdout)?.[1];
        const originalHead = await mount.git.revParse(`${tip}^1`, { cwd: mount.mirrorDir }).catch(() => null);
        const requestHash = originalRequest && originalHead ? sha256(canonicalJson({ project, spec, topic, requestId: originalRequest, expectedHead: originalHead, version: pendingVersion })) : null;
        const confirmed = await publish?.confirmMigrationPublication?.({ project, spec, version: pendingVersion, commit: tip, requestHash });
        if (!confirmed?.ok) return failure(requestId, "PUBLISHED_LEDGER_UNCONFIRMED", "Merge reached Git, but the publication ledger is not yet confirmed; retry after recovery", { retryable: true, specSlug: spec });
        const topicHead = await mount.git.revParse(topicRef, { cwd: mount.mirrorDir });
        const alreadyMerged = await mount.git.run(["merge-base", "--is-ancestor", topicHead, tip], { cwd: mount.mirrorDir }).then(() => true, () => false);
        if (alreadyMerged) {
          await mount.git.run(["push", `--force-with-lease=refs/heads/${branch}:${topicHead}`, "origin", `:refs/heads/${branch}`], { cwd: mount.mirrorDir })
            .catch((error) => logger(`recovered merge but could not delete ${branch}: ${error.message}`));
          await mounts.refreshProject(project);
          projection?.syncNow();
        }
      }
      return serviceSuccess("specBranch", requestId, { action: "merge", kind: "work", branch, spec, topic, commit: null, noop: true });
    }
    const allowed = paths.every((entry) => entry === SPEC_BINDING_FILE || entry.startsWith(`.specs/${spec}/`));
    if (!allowed) {
      return failure(requestId, "PATH_FORBIDDEN", `merge would carry paths outside .specs/${spec}: ${paths.filter((entry) => entry !== SPEC_BINDING_FILE && !entry.startsWith(`.specs/${spec}/`)).join(", ")}`);
    }
    const worktree = await mounts.worktreeFor(project, spec, { strict: true, preserveChanges: true });
    let ownedPublicationTag = null;
    let mergeCommit = null;
    let reviewedHead = null;
    let publication = null;
    let publicationReservation = null;
    let publicationTree = null;
    let protectedTag = null;
    let preserveProtection = false;
    let publicationRequestHash = null;
    const commitReservation = () => {
      if (!publicationReservation?.ok) return false;
      const reservation = publicationReservation;
      publicationReservation = null;
      try {
        reservation.commit({ digest: publicationTree, commitSha: mergeCommit, repoUrl: worktree.repoUrl, repoBranch: canonical });
        return true;
      } catch (error) {
        logger(`publication ledger commit failed for ${project}/${spec}: ${error.message}`);
        return false;
      }
    };
    try {
      // `git merge` and its commit use the whole index. Refuse any pre-existing
      // worktree changes rather than including or resetting another actor's work.
      const dirty = await worktree.git.run(["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd: worktree.cwd });
      if (dirty.stdout !== "") return failure(requestId, "SPEC_WORKTREE_DIRTY", "Spec branch worktree contains local changes; preserve and resolve them before merging", { specSlug: spec });
      // Fast-forward the checkout first; the topic ref is merged by object id.
      await worktree.git.fetch({ cwd: worktree.cwd }).catch(() => {});
      const behind = await worktree.git.revCount(`HEAD..${canonicalRef}`, { cwd: worktree.cwd });
      if (behind > 0) await worktree.git.mergeFF(canonicalRef, { cwd: worktree.cwd });
      reviewedHead = await worktree.git.revParse("HEAD", { cwd: worktree.cwd });
      if (reviewedHead !== await worktree.git.revParse(canonicalRef, { cwd: worktree.cwd })) {
        const recovery = await recoverReservedMerge({ project, spec, topic, requestId, login, role, worktree, canonicalRef, topicRef, canonical, branch });
        if (!recovery) return failure(requestId, "SPEC_WORKTREE_AHEAD", "Canonical worktree diverged from the remote; resolve it before merging", { specSlug: spec });
        if (recovery.result) return recovery.result;
        reviewedHead = await worktree.git.revParse("HEAD", { cwd: worktree.cwd });
      }
      const criteria = `.specs/${spec}/ACCEPTANCE_CRITERIA.md`;
      const workOptions = { cwd: worktree.cwd };
      const headText = async (name) => {
        const files = await worktree.git.run(["ls-tree", "--name-only", "HEAD", "--", name], workOptions);
        return files.stdout.trim() === "" ? "" : worktree.git.show("HEAD", name, workOptions);
      };
      const indexText = async (name) => {
        const files = await worktree.git.run(["ls-files", "--stage", "--", name], workOptions);
        return files.stdout.trim() === "" ? "" : (await worktree.git.run(["show", `:${name}`], workOptions)).stdout;
      };
      const before = coverageRegion(await headText(criteria));
      const baselineRepository = await readRepositorySpecs({ root: worktree.cwd });
      if (baselineRepository.error) throw new Error("Cannot read the canonical specification before merge");
      const baseline = buildKernelGraph(baselineRepository);
      await worktree.git.run([
        "-c", `user.name=${identity.name}`, "-c", `user.email=${identity.email}`,
        "merge", "--no-ff", "--no-commit", topicRef,
      ], workOptions);
      if (!(await worktree.git.revParse("MERGE_HEAD", workOptions).catch(() => null))) {
        return serviceSuccess("specBranch", requestId, { action: "merge", kind: "work", branch, spec, topic, commit: null, noop: true });
      }
      const prefix = `.specs/${spec}/`;
      const indexed = await worktree.git.run(["ls-files", "-z", "--", prefix], workOptions);
      const indexedPaths = indexed.stdout.split("\u0000").filter(Boolean);
      const legacy = indexedPaths.filter((filename) =>
        filename.startsWith(prefix) && isLegacySpecificationDocument(filename.slice(prefix.length), spec));
      const gherkinPaths = GHERKIN_DOCUMENT_KINDS.map((kind) => `.specs/${spec}/${canonicalDocumentFilename(kind, spec)}`);
      const missing = gherkinPaths.filter((filename) => !indexedPaths.includes(filename));
      if (legacy.length > 0 || missing.length > 0) {
        await worktree.git.run(["merge", "--abort"], workOptions);
        return failure(requestId, "UNSUPPORTED_DOCUMENT", "Merge must remove legacy specification documents before updating the canonical branch", {
          findings: [...legacy, ...missing].map((filename) => ({ path: filename, message: "Migrate to the canonical Gherkin pair" })),
        });
      }
      const after = coverageRegion(await indexText(criteria));
      if (before.material !== after.material) {
        await worktree.git.run(["merge", "--abort"], { cwd: worktree.cwd });
        return failure(requestId, "BDD_COVERAGE_PROTECTED", "Merge changes the approved BDD coverage. Approve it as project owner on the canonical branch.");
      }
      const changedGherkin = await worktree.git.run(["diff", "--cached", "--name-only", "--", ...gherkinPaths], workOptions);
      if (changedGherkin.stdout.trim() !== "") {
        const parse = async (read, filename) => {
          const text = await read(filename);
          return text ? parseGherkinDocument({ path: filename, specSlug: spec, text }) : null;
        };
        const next = await Promise.all(gherkinPaths.map((filename) => parse(indexText, filename)));
        if (next.some((doc) => !doc || doc.diagnostics.length) || gherkinPairFindings(...next).length) {
          await worktree.git.run(["merge", "--abort"], workOptions);
          return failure(requestId, "VALIDATION_FAILED", "Merge must preserve a valid story and use case Gherkin pair");
        }
      }
      const repository = await readRepositorySpecs({ root: worktree.cwd });
      if (repository.error) throw new Error("Cannot read the merged specification");
      const resulting = buildKernelGraph(repository);
      if (!resulting.graph.valid) {
        await worktree.git.run(["merge", "--abort"], workOptions);
        return failure(requestId, "VALIDATION_FAILED", "Merged specification graph is invalid", {
          findings: resulting.diagnostics.filter(({ severity }) => severity === "ERROR"),
        });
      }
      const diff = await worktree.git.run(["diff", "--cached", "--name-status", "-z", "--find-renames"], workOptions);
      const parts = diff.stdout.split("\u0000");
      const renames = new Map();
      for (let index = 0; index < parts.length && parts[index];) {
        const status = parts[index++];
        const oldPath = parts[index++];
        if (status.startsWith("R")) renames.set(parts[index++], oldPath);
      }
      const introduced = introducedDefinitionFindings(baseline.diagnostics, resulting.diagnostics, renames);
      if (introduced.length) {
        await worktree.git.run(["merge", "--abort"], workOptions);
        return failure(requestId, "VALIDATION_FAILED", "Merge introduces malformed definitions or unresolved references", { findings: introduced });
      }
      const readyFindings = changedReadyCoverageFindings({
        baseline: baseline.graph, graph: resulting.graph, spec, proposed: after.map, approved: before.map,
      });
      if (readyFindings.length) {
        await worktree.git.run(["merge", "--abort"], workOptions);
        return failure(requestId, "BDD_COVERAGE_INCOMPLETE", "Merged examples require current approval", { findings: readyFindings });
      }
      const tasksPath = `.specs/${spec}/TASKS.md`;
      const staged = await worktree.git.run(["diff", "--cached", "--name-only", "--", tasksPath], workOptions);
      if (staged.stdout.trim() !== "") {
        const findings = changedTaskCoverageFindings({ baseline: baseline.graph, graph: resulting.graph, spec, proposed: after.map, approved: before.map });
        if (findings.length) {
          await worktree.git.run(["merge", "--abort"], workOptions);
          return failure(requestId, "BDD_COVERAGE_INCOMPLETE", "Merged task scope requires approved BDD coverage", { findings });
        }
      }
      const readmePath = `.specs/${spec}/README.md`;
      const beforeReadme = await headText(readmePath);
      const afterReadme = await indexText(readmePath);
      if (authoredField(beforeReadme, "Status") === "ACTIVE" || authoredField(afterReadme, "Status") === "ACTIVE") {
        if (typeof requestId !== "string" || /[\r\n\u0000]/u.test(requestId)) {
          await worktree.git.run(["merge", "--abort"], workOptions);
          return failure(requestId, "INVALID_REQUEST", "ACTIVE merge requestId must be a single line", { parameter: "requestId" });
        }
        if (typeof publish?.inspectMigration !== "function") {
          await worktree.git.run(["merge", "--abort"], workOptions);
          return failure(requestId, "PUBLICATION_LEDGER_UNAVAILABLE", "ACTIVE merge requires an available publication ledger");
        }
        publication = await publish.inspectMigration({
          project, spec, worktree: { ...worktree, head: reviewedHead }, role, allowStatusChange: true,
          requestHash: sha256(canonicalJson({ project, spec, topic, requestId, expectedHead: reviewedHead, version: authoredField(afterReadme, "Version") })),
          operations: [{ kind: "replace_document", document: "README.md", content: afterReadme }],
        });
        if (!publication.ok) {
          await worktree.git.run(["merge", "--abort"], workOptions);
          return failure(requestId, "VALIDATION_FAILED", publication.message, { causeCode: publication.code, specSlug: spec });
        }
      }
      await worktree.git.run([
        "-c", `user.name=${identity.name}`,
        "-c", `user.email=${identity.email}`,
        "commit", "--no-edit", "-m",
        commitMessage({ subject: `merge ${branch}`, trailers: { "Spec-Author": login ?? "service", ...(publication?.active ? { "Spec-Migration-Merge-Version": publication.version, "Spec-Migration-Merge-Request-Id": String(requestId ?? "") } : {}) } }),
      ], { cwd: worktree.cwd });
      const commit = await worktree.git.revParse("HEAD", { cwd: worktree.cwd });
      mergeCommit = commit;
      if (publication?.active) {
        ownedPublicationTag = await createOwnedPublicationTag({ git: worktree.git, cwd: worktree.cwd, project, spec, version: publication.version, commit, identity });
        publicationTree = await worktree.git.objectId(commit, `.specs/${spec}`, { cwd: worktree.cwd });
        publicationRequestHash = sha256(canonicalJson({ project, spec, topic, requestId, expectedHead: reviewedHead, version: publication.version }));
        protectedTag = await protectPublicationTag({ tag: ownedPublicationTag, requestHash: publicationRequestHash });
        publicationReservation = await publish.reserveMigrationPublication({ project, spec, publication, metadata: {
          requestHash: publicationRequestHash,
          commitSha: mergeCommit, tagObject: ownedPublicationTag.object, digest: publicationTree, expectedHead: reviewedHead, repoUrl: worktree.repoUrl, repoBranch: canonical,
        } });
        if (!publicationReservation.ok) throw Object.assign(new Error(publicationReservation.message), { causeCode: publicationReservation.code });
        preserveProtection = true;
        const atomicTag = ownedPublicationTag;
        await removeOwnedPublicationTag(ownedPublicationTag);
        ownedPublicationTag = null;
        await pushBranchAndPublicationTag({ git: worktree.git, cwd: worktree.cwd, branch: canonical, expectedHead: reviewedHead, tag: atomicTag });
        if (!commitReservation()) return failure(requestId, "PUBLISHED_LEDGER_UNCONFIRMED", "Merge reached Git, but the publication ledger is not yet confirmed; retry after recovery", { retryable: true, specSlug: spec });
        const confirmed = await publish.confirmMigrationPublication({ project, spec, version: publication.version, commit, requestHash: publicationRequestHash });
        if (!confirmed.ok) return failure(requestId, "PUBLISHED_LEDGER_UNCONFIRMED", "Merge reached Git, but the publication ledger is not yet confirmed; retry after recovery", { retryable: true, specSlug: spec });
        protectedTag = null;
        preserveProtection = false;
      } else {
        await worktree.git.push({ refspec: `HEAD:refs/heads/${canonical}` }, { cwd: worktree.cwd });
      }
      await worktree.git.push({ refspec: `:refs/heads/${branch}` }, { cwd: worktree.cwd }).catch((error) => {
        logger(`merged ${branch} but could not delete the work branch: ${error.message}`);
      });
      await mounts.ensureRepo(project);
      await mounts.refreshProject(project);
      audit({ login, role, project, op: "spec-branch-merge", spec, result: `ok:${branch}:${commit.slice(0, 12)}` });
      await publish?.publishSpec(project, spec).catch((error) => logger(`publish after merge failed: ${error.message}`));
      projection?.syncNow();
      logger(`merged ${branch} into ${canonical} at ${commit.slice(0, 12)}`);
      return serviceSuccess("specBranch", requestId, { action: "merge", kind: "work", branch, spec, topic, commit });
    } catch (error) {
      if (publicationReservation?.ok) await worktree.git.runBounded(["merge", "--abort"], { cwd: worktree.cwd, timeoutMs: 2_000 }).catch(() => {});
      else await worktree.git.run(["merge", "--abort"], { cwd: worktree.cwd }).catch(() => {});
      if (publication?.active && mergeCommit && reviewedHead) {
        if (publicationReservation?.ok) {
          let observed = null;
          try {
            const tagRef = `refs/tags/${publishTagName(project, spec, publication.version)}`;
            const probe = await worktree.git.runBounded(["ls-remote", "origin", `refs/heads/${canonical}`, `${tagRef}*`], { cwd: worktree.cwd, timeoutMs: 5_000 });
            observed = new Map(probe.stdout.split(/\r?\n/u).filter(Boolean).map((line) => { const [sha, ref] = line.split("\t"); return [ref, sha]; }));
            const remoteTag = observed.get(`${tagRef}^{}`) ?? observed.get(tagRef) ?? null;
            if (observed.get(`refs/heads/${canonical}`) === mergeCommit && remoteTag === mergeCommit) {
              if (!commitReservation()) return failure(requestId, "PUBLISHED_LEDGER_UNCONFIRMED", "Merge reached Git, but the publication ledger is not yet confirmed; retry after recovery", { retryable: true, specSlug: spec });
              const confirmed = await publish.confirmMigrationPublication({ project, spec, version: publication.version, commit: mergeCommit, requestHash: publicationRequestHash });
              if (confirmed.ok) { protectedTag = null; preserveProtection = false; return serviceSuccess("specBranch", requestId, { action: "merge", kind: "work", branch, spec, topic, commit: mergeCommit }); }
              return failure(requestId, "PUBLISHED_LEDGER_UNCONFIRMED", "Merge reached Git, but the publication ledger is not yet confirmed; retry after recovery", { retryable: true, specSlug: spec });
            }
            if (remoteTag === mergeCommit) observed = null;
          } catch {}
          if (!observed) {
            publicationReservation = null; // retain durable reservation for recovery
            return failure(requestId, "PUBLISHED_LEDGER_UNCONFIRMED", "Git outcome is unknown; retry to reconcile the publication ledger", { retryable: true, specSlug: spec });
          }
          publicationReservation.rollback();
          publicationReservation = null;
          preserveProtection = false;
          await removePublicationProtection(protectedTag);
          protectedTag = null;
        }
        const remote = await mounts.ensureRepo(project, { fetch: true, strict: true }).then(() => worktree.git.revParse(canonicalRef, { cwd: worktree.cwd })).catch(() => null);
        if (remote === mergeCommit) {
          const confirmed = await publish.confirmMigrationPublication({ project, spec, version: publication.version, commit: mergeCommit, requestHash: publicationRequestHash });
          if (confirmed.ok) { protectedTag = null; preserveProtection = false; return serviceSuccess("specBranch", requestId, { action: "merge", kind: "work", branch, spec, topic, commit: mergeCommit }); }
          return failure(requestId, "PUBLISHED_LEDGER_UNCONFIRMED", "Merge reached Git, but the publication ledger is not yet confirmed; retry after recovery", { retryable: true, specSlug: spec });
        }
        if (remote && await worktree.git.revParse("HEAD", { cwd: worktree.cwd }) === mergeCommit) {
          await worktree.git.run(["reset", "--hard", reviewedHead], { cwd: worktree.cwd });
        }
      }
      if (/conflict|CONFLICT|Automatic merge failed/u.test(String(error?.message ?? error))) {
        return failure(requestId, "MERGE_CONFLICT", `merging ${branch} into ${canonical} conflicts; resolve it on the work branch`, { retryable: false });
      }
      return failure(requestId, "GIT_MERGE_FAILED", `merge failed: ${String(error?.message ?? error).split("\n")[0]}`, { retryable: true });
    } finally {
      try {
        if (protectedTag?.created && !preserveProtection) await removePublicationProtection(protectedTag);
      } finally {
        await removeOwnedPublicationTag(ownedPublicationTag);
      }
    }
  }

  async function deleteWork({ project, spec, topic, requestId, login, force = false, role = null }) {
    const branch = specWorkBranchName(spec, topic);
    const canonical = specBranchName(spec);
    let mount;
    try {
      mount = await mounts.ensureRepo(project, { strict: true });
    } catch (error) {
      return failure(requestId, "REPO_UNREACHABLE", `cannot refresh the repository before delete: ${String(error?.message ?? error).split("\n")[0]}`, { retryable: true, causeCode: error?.code ?? null });
    }
    if (!(await branchExists(mount, branch))) {
      return failure(requestId, "BRANCH_NOT_FOUND", `branch ${branch} does not exist`);
    }
    const workRef = `refs/remotes/origin/${branch}`;
    const canonicalRef = `refs/remotes/origin/${canonical}`;
    const owned = await ownedBinding({ mount, project, spec, ref: workRef });
    if (owned.error) return failure(requestId, "SPEC_BINDING_INVALID", owned.error);
    const merged = await mount.git.run(["--git-dir", mount.mirrorDir, "merge-base", "--is-ancestor", workRef, canonicalRef], { cwd: mount.cwd })
      .then(() => true)
      .catch(() => false);
    if (!merged) {
      if (!force) {
        return failure(requestId, "BRANCH_NOT_MERGED", `branch ${branch} has commits not merged into ${canonical}; merge first or pass force: true as an owner`, { parameter: "force" });
      }
      if (role !== "owner") {
        return failure(requestId, "FORBIDDEN_ROLE", "force delete requires the owner role", { parameter: "force" });
      }
    }
    const tip = await mount.git.revParse(workRef, { cwd: mount.mirrorDir });
    if (tip === null) return failure(requestId, "BRANCH_NOT_FOUND", `branch ${branch} does not exist`);
    await mount.git.run(
      ["--git-dir", mount.mirrorDir, "push", "-q", `--force-with-lease=refs/heads/${branch}:${tip}`, mount.repoUrl, `:refs/heads/${branch}`],
      { cwd: mount.cwd },
    );
    await mount.git.run(["--git-dir", mount.mirrorDir, "worktree", "prune"], { cwd: mount.cwd }).catch(() => {});
    await mounts.ensureRepo(project);
    audit({ login, role, project, op: "spec-branch-delete", spec, result: `ok:${branch}:${tip.slice(0, 12)}` });
    logger(`deleted work branch ${branch}`);
    return serviceSuccess("specBranch", requestId, { action: "delete", kind: "work", branch, spec, topic });
  }

  /**
   * Explicit demo-spec deletion. Ordinary `delete` keeps the canonical-branch
   * guard; only a spec whose canonical README carries `Demo: true` may take
   * this path, and only an owner may request it. The marker is read from the
   * remote ref, never from the mutable worktree, so a local-only commit cannot
   * authorize a delete. Unmerged work and published versions block the delete:
   * they are separate evidence and must be archived/removed first.
   */
  async function deleteCanonical({ project, spec, requestId, login, role, force = false }) {
    if (role !== "owner" && role !== "writer") {
      return failure(requestId, "FORBIDDEN_ROLE", "deleting a demo spec requires the owner or writer role");
    }
    if (typeof store?.getLedger !== "function") {
      return failure(requestId, "LEDGER_UNAVAILABLE", "ledger is required to verify published versions before deletion", { retryable: false });
    }
    if (typeof dependents !== "function") {
      return failure(requestId, "DEPENDENTS_UNVERIFIED", "dependent-reference check is not configured", { retryable: false });
    }
    const branch = specBranchName(spec);
    let mount;
    try {
      mount = await mounts.ensureRepo(project, { strict: true });
    } catch (error) {
      return failure(requestId, "REPO_UNREACHABLE", `cannot refresh the repository before delete: ${String(error?.message ?? error).split("\n")[0]}`, { retryable: true, causeCode: error?.code ?? null });
    }
    const canonicalRef = `refs/remotes/origin/${branch}`;
    if (!(await branchExists(mount, branch))) {
      return failure(requestId, "SPEC_NOT_FOUND", `spec ${spec} has no ${branch} branch`);
    }
    const owned = await ownedBinding({ mount, project, spec, ref: canonicalRef });
    if (owned.error) return failure(requestId, "SPEC_BINDING_INVALID", owned.error);
    if (owned.binding.archive !== undefined) {
      return failure(requestId, "SPEC_ARCHIVED", `spec ${spec} is archived; its branch and history are retained`, { specSlug: spec });
    }

    const refs = await listSpecRefs({ git: mount.git, cwd: mount.mirrorDir });
    const workBranches = refs
      .filter(({ parsed }) => parsed?.kind === "work" && parsed.slug === spec)
      .map(({ branch: workBranch }) => workBranch);
    if (workBranches.length > 0) {
      return failure(
        requestId,
        "SPEC_HAS_WORK_BRANCHES",
        `spec ${spec} still has work branches: ${workBranches.join(", ")}; merge or delete them first`,
        { branches: workBranches },
      );
    }
    let tags;
    try {
      tags = await mount.git.lsRemote(`refs/tags/${publishTagName(project, spec, "*")}`, { cwd: mount.mirrorDir });
    } catch (error) {
      return failure(requestId, "REPO_UNREACHABLE", `cannot verify published versions for ${spec}: ${String(error?.message ?? error).split("\n")[0]}`, { retryable: true, causeCode: error?.code ?? null });
    }
    if (tags.size > 0) {
      return failure(
        requestId,
        "SPEC_HAS_PUBLISHED_VERSIONS",
        `spec ${spec} has published versions: ${[...tags.keys()].join(", ")}; archive it instead`,
        { tags: [...tags.keys()] },
      );
    }
    const ledger = store?.getLedger?.(`${project}/${spec}`) ?? [];
    if (ledger.length > 0) {
      return failure(
        requestId,
        "SPEC_HAS_PUBLISHED_VERSIONS",
        `spec ${spec} has ledger versions even without a remote tag: ${ledger.map((row) => row.version).join(", ")}; archive it instead`,
        { versions: ledger.map((row) => row.version) },
      );
    }

    if (owned.binding.demo !== true) {
      // Legacy demo branches predate the immutable metadata flag. Only an
      // owner may delete them, and only when the canonical README carries the
      // visible marker; a writer cannot obtain demo deletion by editing prose.
      if (role !== "owner") {
        return failure(requestId, "DELETE_FORBIDDEN", `spec ${spec} is not marked demo in .spec-kit.json; archive it instead`, { parameter: "spec" });
      }
      const readme = await mount.git.show(canonicalRef, `.specs/${spec}/README.md`, { cwd: mount.mirrorDir }).catch(() => "");
      if (!/^\s*>?\s*\*\*?Demo:?\*?\*?\s*true\b/imu.test(readme)) {
        return failure(requestId, "DELETE_FORBIDDEN", `spec ${spec} is not marked Demo: true; archive it instead`);
      }
    }

    let inbound;
    try {
      inbound = await dependents({ project, spec });
    } catch (error) {
      return failure(requestId, "DEPENDENTS_UNVERIFIED", `cannot verify dependent references for ${spec}: ${String(error?.message ?? error).split("\n")[0]}`, { retryable: true });
    }
    if (!Array.isArray(inbound)) {
      return failure(requestId, "DEPENDENTS_UNVERIFIED", `dependent-reference check returned an invalid result for ${spec}`, { retryable: false });
    }
    if (inbound.length > 0) {
      if (!force) {
        return failure(requestId, "SPEC_HAS_DEPENDENTS", `spec ${spec} has ${inbound.length} live inbound reference(s); pass force: true as an owner to delete anyway`, { references: inbound, parameter: "force" });
      }
      if (role !== "owner") {
        return failure(requestId, "FORBIDDEN_ROLE", "force deletion with dependents requires the owner role", { parameter: "force" });
      }
    }

    const tip = await mount.git.revParse(canonicalRef, { cwd: mount.mirrorDir });
    if (tip === null) return failure(requestId, "SPEC_NOT_FOUND", `spec ${spec} has no ${branch} branch`);

    // A failed publish leaves the local worktree ahead of the remote. Deleting
    // the spec would discard those commits, so refuse until they are pushed or
    // explicitly discarded.
    const localRef = `refs/heads/work/${branch}`;
    const localTip = await mount.git.revParse(localRef, { cwd: mount.mirrorDir }).catch(() => null);
    if (localTip !== null) {
      const ahead = await mount.git.revCount(`${canonicalRef}..${localRef}`, { cwd: mount.mirrorDir }).catch(() => null);
      if (ahead === null) {
        return failure(requestId, "SPEC_WORKTREE_STATE_UNKNOWN", `cannot inspect local work commits for ${spec}; retry when the repository is readable`, { retryable: true });
      }
      if (ahead > 0) {
        return failure(requestId, "SPEC_WORKTREE_AHEAD", `local worktree for ${spec} has ${ahead} unpushed commit(s); push or discard them first`, { commit: localTip, ahead });
      }
    }
    const worktreeDir = path.join(mount.cwd, "worktrees", branch);
    if (existsSync(worktreeDir)) {
      const dirty = await mount.git.run(["-C", worktreeDir, "status", "--porcelain"], { cwd: mount.cwd }).then((result) => result.stdout.trim()).catch(() => null);
      if (dirty === null) {
        return failure(requestId, "SPEC_WORKTREE_STATE_UNKNOWN", `cannot inspect the worktree for ${spec}; retry when it is readable`, { retryable: true });
      }
      if (dirty !== "") {
        return failure(requestId, "SPEC_WORKTREE_DIRTY", `worktree for ${spec} has uncommitted changes; commit or discard them first`, { paths: dirty.split(/\r?\n/u).slice(0, 20) });
      }
    }
    await mount.git.run(
      ["--git-dir", mount.mirrorDir, "push", "-q", `--force-with-lease=refs/heads/${branch}:${tip}`, mount.repoUrl, `:refs/heads/${branch}`],
      { cwd: mount.cwd },
    );
    await rm(worktreeDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }).catch(() => {});
    await mount.git.run(["--git-dir", mount.mirrorDir, "worktree", "prune"], { cwd: mount.cwd }).catch(() => {});
    // The write path keeps a local `work/<branch>` ref. Leaving it behind
    // makes a later re-create check out the deleted tip, and the first push
    // is rejected as non-fast-forward.
    await mount.git.run(["--git-dir", mount.mirrorDir, "branch", "-D", `work/${branch}`], { cwd: mount.cwd }).catch(() => {});
    await mounts.ensureRepo(project);
    await mounts.refreshProject(project);
    audit({ login, role, project, op: "spec-branch-delete-spec", spec, result: `ok:${branch}:${tip.slice(0, 12)}${force ? ":force" : ""}`, force, dependents: inbound.length });
    try {
      if (typeof projection?.syncOnce === "function") await projection.syncOnce();
      else projection?.syncNow();
    } catch (error) {
      return failure(requestId, "PROJECTION_SYNC_FAILED", `spec ${spec} source was deleted but projection sync failed: ${String(error?.message ?? error).split("\n")[0]}`, { retryable: true, commit: tip });
    }
    logger(`deleted demo spec branch ${branch} at ${tip.slice(0, 12)}`);
    return serviceSuccess("specBranch", requestId, { action: "deleteSpec", kind: "spec", branch, spec, topic: null, commit: tip });
  }

  return {
    /** Used by the spec_patch write path when createSpec targets a new slug. */
    async ensureCanonical({ project, spec, requestId, login, demo = false }) {
      return createCanonical({ project, spec, requestId, login, skeleton: false, demo });
    },
    async run({ args, project, requestId, login, force = false, role = null }) {
      const parsed = parseArgs(args);
      if (parsed.error) return failure(requestId, "INVALID_REQUEST", parsed.error[0], parsed.error[1]);
      const { action, spec, topic } = parsed;
      const release = await mounts.acquireWriteLock(project);
      try {
        // A merge/delete is a spec write: honor the same lease as spec_patch.
        // Creating a brand-new canonical spec has no prior claim to honor.
        // An owner deleting a demo spec may override another user's soft claim.
        const ownerDelete = action === "deleteSpec" && role === "owner";
        if (!ownerDelete && !(action === "create" && topic === null) && claims) {
          const held = claims.get(project, spec);
          if (held && held.holder !== login) {
            return failure(requestId, "CLAIM_HELD", `spec is claimed by ${held.holder} until ${held.expiresAt}`, {
              holder: held.holder,
              expiresAt: held.expiresAt,
            });
          }
        }
        if (action === "deleteSpec") {
          return await deleteCanonical({ project, spec, requestId, login, role, force });
        }
        if (action === "delete" && topic === null) {
          return failure(requestId, "BRANCH_PROTECTED", `spec ${spec} is canonical; delete a work branch or delete a Demo: true spec`, { parameter: "topic" });
        }
        if (action === "create") {
          return topic === null
            ? await createCanonical({ project, spec, requestId, login, role, demo: args.demo === true })
            : await createWork({ project, spec, topic, requestId, login, role });
        }
        if (action === "merge") {
          if (topic === null) return failure(requestId, "INVALID_REQUEST", "merge needs a topic (the work branch suffix)", { parameter: "topic" });
          return await mergeWork({ project, spec, topic, requestId, login, role });
        }
        return await deleteWork({ project, spec, topic, requestId, login, force, role });
      } catch (error) {
        const code = error?.code === "SPEC_BINDING_INVALID" ? "SPEC_BINDING_INVALID" : "INTERNAL_ERROR";
        return failure(requestId, code, String(error?.message ?? error).split("\n")[0], { causeCode: error?.code ?? null });
      } finally {
        release();
      }
    },
  };
}
