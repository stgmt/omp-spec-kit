import { createHash } from "node:crypto";
import { serviceSuccess } from "./dispatch.js";

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

/**
 * A path fragment stays inside the spec directory: no traversal, no absolute
 * or drive-qualified paths, no backslashes — otherwise `git show <sha>:<path>`
 * would happily serve files from anywhere in the repository across project
 * boundaries.
 */
function isContainedPathFragment(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.startsWith("/") &&
    !/[\\]/.test(value) &&
    !/^[A-Za-z]:/.test(value) &&
    !value.split("/").includes("..") &&
    !value.split("/").includes("")
  );
}

/**
 * Versioned reads (FR-12): `spec_documents(action:"read", version)` resolves
 * through the publish ledger to the exact commit the version was tagged at and
 * serves the document bytes from that immutable snapshot — the working tree
 * may have moved on. The stored tree digest is re-verified against the commit
 * so a tampered ledger row cannot silently redirect reads.
 */
export function createVersionedReads({ mounts, store }) {
  return async function documents({ args, project, requestId, schemaVersion }) {
    const version = args.version;
    if (version == null) {
      const envelope = await mounts.serviceFor(project).runQuery("documents", args, { requestId, schemaVersion });
      return { envelope };
    }
    if (args.action !== "read") {
      return { envelope: errorEnvelope("documents", requestId, "INVALID_REQUEST", "version is only supported for action: read", { parameter: "version" }) };
    }
    if (!isContainedPathFragment(args.spec) || !isContainedPathFragment(args.doc)) {
      return {
        envelope: errorEnvelope("documents", requestId, "PATH_FORBIDDEN", "spec/doc must be contained path fragments", {
          parameter: !isContainedPathFragment(args.spec) ? "spec" : "doc",
          receivedSummary: !isContainedPathFragment(args.spec) ? args.spec : args.doc,
        }),
      };
    }
    const specKey = `${project}/${args.spec}`;
    const row = store?.getLedger?.(specKey).find((entry) => entry.version === version) ?? null;
    if (!row) {
      return {
        envelope: errorEnvelope("documents", requestId, "VERSION_NOT_FOUND", `spec ${specKey} has no published version ${version}`, {
          specSlug: args.spec,
          retryable: false,
        }),
      };
    }
    const specPath = `${project}/.specs/${args.spec}`;
    // The commit lives in the repo the version was published into — after a
    // migration that is the previous clone, not the project's current mount.
    const mount = row.repoUrl ? mounts.byRepo(row.repoUrl, row.repoBranch ?? "main", project) : mounts.for(project);
    if (row.repoUrl) await mounts.ensureMount(mount).catch(() => {});
    const { git, cwd } = mount;
    // Integrity: the commit's own tree hash must equal the recorded digest.
    const tree = await git.objectId(row.commitSha, specPath, { cwd }).catch(() => null);
    if (tree !== row.digest) {
      return {
        envelope: errorEnvelope("documents", requestId, "PUBLICATION_INTEGRITY", `ledger digest does not match commit ${row.commitSha.slice(0, 12)} for ${specKey}@${version}`, {
          specSlug: args.spec,
        }),
      };
    }
    const docPath = `${specPath}/${args.doc}`;
    // Only a blob is a document: `git show <sha>:<dir>` would happily emit a
    // raw tree listing, and binary blobs would come back as UTF-8 garbage.
    const type = await git.objectType(row.commitSha, docPath, { cwd }).catch(() => null);
    const content = type === "blob" ? await git.show(row.commitSha, docPath, { cwd }).catch(() => null) : null;
    if (type !== "blob" || content === null || content.includes("\0")) {
      return {
        envelope: errorEnvelope("documents", requestId, "DOCUMENT_NOT_FOUND", `${args.doc} is absent in ${specKey}@${version}`, {
          specSlug: args.spec,
          path: docPath,
        }),
      };
    }
    const lines = content.split("\n");
    return {
      envelope: serviceSuccess("documents", requestId, {
        kind: "document",
        spec: args.spec,
        doc: args.doc,
        startLine: 1,
        endLine: lines.length,
        lines: lines.length,
        totalLines: lines.length,
        totalBytes: Buffer.byteLength(content, "utf8"),
        truncated: false,
        sha256: createHash("sha256").update(content, "utf8").digest("hex"),
        content,
        published: { version, commit: row.commitSha, digest: row.digest },
      }),
    };
  };
}
