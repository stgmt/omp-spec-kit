import { readFile } from "node:fs/promises";
import path from "node:path";
import { specificationDirectoryDigest } from "../authoring/transactions.js";

export function authoredField(text, name) {
  const match = typeof text === "string" ? text.match(new RegExp(`^${name}:\\s*(.+)$`, "um")) : null;
  return match ? match[1].trim() : null;
}

async function readAuthoredFields(readmePath) {
  try {
    const text = await readFile(readmePath, "utf8");
    return { status: authoredField(text, "Status"), version: authoredField(text, "Version") };
  } catch {
    return { status: null, version: null };
  }
}

/**
 * Owner and freshness come from git (FR-9/US-1): the last commit that touched
 * the spec directory, its author and its timestamp.
 */
async function gitLastChange(git, cloneDir, specPath) {
  const { stdout } = await git.run(
    ["log", "--max-count=1", "--format=%an%x00%aI", "--", specPath],
    { cwd: cloneDir },
  ).catch(() => ({ stdout: "" }));
  const [owner, updatedAt] = stdout.trim().split("\0");
  return { owner: owner || null, updatedAt: updatedAt || null };
}

function catalogSlugs(catalogEnvelope) {
  const data = catalogEnvelope?.data;
  return Array.isArray(data?.specs) ? data.specs : [];
}

/**
 * Projected registry index (FR-9): per project, per spec — slug, authored
 * status/version, directory digest, claim state, published pointer. Rebuilt
 * from git on every call; never authoritative for content.
 */
export async function buildRegistryIndex({ mounts, claims, ledger }) {
  const projects = [];
  for (const projectId of mounts.projects) {
    const mount = mounts.for(projectId);
    const root = mounts.resolveProjectRoot(projectId);
    const service = mounts.serviceFor(projectId);
    const state = await service.ensure();
    if (state.status === "error") {
      projects.push({ id: projectId, error: state.readerError?.code ?? "ADAPTER_READ_ERROR" });
      continue;
    }
    const catalog = await service.runQuery("catalog", { view: "specs" }, { requestId: null });
    const specs = [];
    for (const slug of catalogSlugs(catalog)) {
      const specPath = `${projectId}/.specs/${slug}`;
      const authored = await readAuthoredFields(path.join(root, ".specs", slug, "README.md"));
      const digestResult = await specificationDirectoryDigest(root, slug);
      const claim = claims.get(projectId, slug);
      const published = ledger.getLedger(`${projectId}/${slug}`)[0] ?? null;
      const lastChange = await gitLastChange(mount.git, mount.cwd, specPath);
      specs.push({
        slug,
        status: authored.status,
        version: authored.version,
        digest: digestResult.ok ? digestResult.digest : null,
        owner: lastChange.owner,
        claim: claim ? { holder: claim.holder, expiresAt: new Date(claim.expiresAtMs).toISOString() } : null,
        published: published ? { version: published.version, digest: published.digest, commit: published.commitSha, publishedAt: published.publishedAt } : null,
        updatedAt: lastChange.updatedAt,
      });
    }
    projects.push({ id: projectId, specs });
  }
  return { projects };
}
