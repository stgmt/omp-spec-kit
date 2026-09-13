import { readFile } from "node:fs/promises";
import path from "node:path";
import { specificationDirectoryDigest } from "../authoring/transactions.js";

function authoredField(text, name) {
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
      const authored = await readAuthoredFields(path.join(root, ".specs", slug, "README.md"));
      const digestResult = await specificationDirectoryDigest(root, slug);
      const claim = claims.get(projectId, slug);
      const published = ledger.getLedger(`${projectId}/${slug}`)[0] ?? null;
      specs.push({
        slug,
        status: authored.status,
        version: authored.version,
        digest: digestResult.ok ? digestResult.digest : null,
        claim: claim ? { holder: claim.holder, expiresAt: new Date(claim.expiresAtMs).toISOString() } : null,
        published: published ? { version: published.version, digest: published.digest, commit: published.commitSha, publishedAt: published.publishedAt } : null,
        updatedAt: null,
      });
    }
    projects.push({ id: projectId, specs });
  }
  return { projects };
}
