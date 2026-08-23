import { lstat, opendir, realpath } from "node:fs/promises";
import path from "node:path";

export const PLUGIN_VERSION = "0.2.0";
export const SCHEMA_VERSION = "1";
export const HARD_MAX_SPECS = 200;
export const HARD_MAX_DIAGNOSTICS = 100;
export const HARD_MAX_DIRECTORY_ENTRIES = 1000;

export const CANONICAL_DOCUMENTS = Object.freeze([
  "README.md",
  "USER_STORIES.md",
  "USE_CASES.md",
  "RESEARCH.md",
  "REQUIREMENTS.md",
  "FR.md",
  "NFR.md",
  "ACCEPTANCE_CRITERIA.md",
  "DESIGN.md",
  "TASKS.md",
  "FILE_CHANGES.md",
  "CHANGELOG.md",
  "<slug>.feature",
  "FIXTURES.md",
  "<slug>_SCHEMA.md",
]);

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$/;
const REQUEST_KEYS = new Set(["schemaVersion", "maxSpecs", "maxDiagnostics", "includeDocumentCounts"]);

function sortStrings(values) {
  return values.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function safeRelativePath(...segments) {
  return segments.join("/");
}

function makeDiagnostic(code, severity, relativePath, message, remediation = null) {
  return {
    code,
    severity,
    path: relativePath,
    message,
    remediation,
  };
}

function isPermissionError(error) {
  return error?.code === "EACCES" || error?.code === "EPERM";
}

function isMissingError(error) {
  return error?.code === "ENOENT";
}

function isAbortRequested(signal) {
  return signal?.aborted === true;
}

function validateInteger(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

export function validateRequest(input = {}) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      diagnostic: makeDiagnostic(
        "INVALID_REQUEST",
        "error",
        null,
        "Request must be an object.",
        "Pass only fields from spec-inventory-request@1.",
      ),
    };
  }

  if (Object.keys(input).some((key) => !REQUEST_KEYS.has(key))) {
    return {
      ok: false,
      diagnostic: makeDiagnostic(
        "INVALID_REQUEST",
        "error",
        null,
        "Request contains unsupported properties.",
        "Remove properties not defined by spec-inventory-request@1.",
      ),
    };
  }

  if (input.schemaVersion !== undefined && input.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      diagnostic: makeDiagnostic(
        "UNSUPPORTED_SCHEMA_VERSION",
        "error",
        null,
        "Only spec-inventory-request schema version 1 is supported.",
        "Use schemaVersion 1.",
      ),
    };
  }

  if (input.maxSpecs !== undefined && !validateInteger(input.maxSpecs, 1, HARD_MAX_SPECS)) {
    return {
      ok: false,
      diagnostic: makeDiagnostic(
        "INVALID_REQUEST",
        "error",
        null,
        "maxSpecs must be an integer from 1 through 200.",
        "Use an integer within the documented bound.",
      ),
    };
  }

  if (
    input.maxDiagnostics !== undefined &&
    !validateInteger(input.maxDiagnostics, 0, HARD_MAX_DIAGNOSTICS)
  ) {
    return {
      ok: false,
      diagnostic: makeDiagnostic(
        "INVALID_REQUEST",
        "error",
        null,
        "maxDiagnostics must be an integer from 0 through 100.",
        "Use an integer within the documented bound.",
      ),
    };
  }

  if (input.includeDocumentCounts !== undefined && typeof input.includeDocumentCounts !== "boolean") {
    return {
      ok: false,
      diagnostic: makeDiagnostic(
        "INVALID_REQUEST",
        "error",
        null,
        "includeDocumentCounts must be a boolean.",
        "Use true or false.",
      ),
    };
  }

  return {
    ok: true,
    value: {
      schemaVersion: SCHEMA_VERSION,
      maxSpecs: input.maxSpecs ?? 50,
      maxDiagnostics: input.maxDiagnostics ?? 25,
      includeDocumentCounts: input.includeDocumentCounts ?? true,
    },
  };
}

function finalizeDiagnostics(rawDiagnostics, limit) {
  const ordered = [...rawDiagnostics].sort((left, right) => {
    const leftPath = left.path ?? "\uffff";
    const rightPath = right.path ?? "\uffff";
    if (leftPath !== rightPath) return leftPath < rightPath ? -1 : 1;
    if (left.code !== right.code) return left.code < right.code ? -1 : 1;
    return left.message < right.message ? -1 : left.message > right.message ? 1 : 0;
  });

  if (ordered.length <= limit) return { diagnostics: ordered, omitted: false };
  if (limit === 0) return { diagnostics: [], omitted: true };

  const limitDiagnostic = makeDiagnostic(
    "DIAGNOSTIC_LIMIT_REACHED",
    "warning",
    null,
    "Additional diagnostics were omitted by maxDiagnostics.",
    "Increase maxDiagnostics within the documented hard cap.",
  );

  if (limit === 1) return { diagnostics: [limitDiagnostic], omitted: true };
  return {
    diagnostics: [...ordered.slice(0, limit - 1), limitDiagnostic],
    omitted: true,
  };
}

function makeResult(status, specs, rawDiagnostics, observedSpecs, truncated, diagnosticLimit) {
  const finalized = finalizeDiagnostics(rawDiagnostics, diagnosticLimit);
  const resultTruncated = truncated || finalized.omitted;
  return {
    schemaVersion: SCHEMA_VERSION,
    tool: "spec_inventory",
    pluginVersion: PLUGIN_VERSION,
    status,
    root: ".specs",
    specs,
    diagnostics: finalized.diagnostics,
    counts: {
      returnedSpecs: specs.length,
      observedSpecs,
      returnedDiagnostics: finalized.diagnostics.length,
    },
    truncated: resultTruncated,
    readOnly: true,
  };
}

async function readDirectoryEntriesBounded(directory, signal) {
  const entries = [];
  let exceeded = false;
  const handle = await opendir(directory);
  try {
    for await (const entry of handle) {
      if (isAbortRequested(signal)) return { entries, aborted: true, exceeded };
      if (entries.length >= HARD_MAX_DIRECTORY_ENTRIES) {
        exceeded = true;
        break;
      }
      entries.push(entry);
    }
  } finally {
    try {
      await handle.close();
    } catch {
      // Iteration may already have closed the directory handle.
    }
  }
  return { entries, aborted: false, exceeded };
}

function entryKind(entry) {
  if (entry.isSymbolicLink()) return "link";
  if (entry.isDirectory()) return "directory";
  if (entry.isFile()) return "file";
  return "other";
}

function scanFingerprint(scanned) {
  return JSON.stringify(
    scanned.entries
      .map((entry) => [entry.name, entryKind(entry)])
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
  );
}

function sameDirectoryIdentity(before, after, realBefore, realAfter) {
  const normalize = (value) =>
    process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
  return (
    !after.isSymbolicLink() &&
    after.isDirectory() &&
    before.dev === after.dev &&
    before.ino === after.ino &&
    normalize(realBefore) === normalize(realAfter)
  );
}

function sameDirectoryScan(first, second) {
  return (
    first.aborted === second.aborted &&
    first.exceeded === second.exceeded &&
    scanFingerprint(first) === scanFingerprint(second)
  );
}

function canonicalNamesForSlug(slug) {
  return CANONICAL_DOCUMENTS.map((name) => name.replaceAll("<slug>", slug));
}

async function inspectSpecDirectory(specsRoot, slug, includeDocumentCounts, signal) {
  const relativePath = safeRelativePath(".specs", slug);
  const absolutePath = path.join(specsRoot, slug);
  const rawDiagnostics = [];

  try {
    const before = await lstat(absolutePath);
    if (before.isSymbolicLink()) {
      return {
        entry: null,
        diagnostics: [
          makeDiagnostic(
            "SYMLINK_ESCAPE_BLOCKED",
            "error",
            relativePath,
            "A specification directory is a symbolic link and was not traversed.",
            "Replace it with an ordinary directory inside the active project.",
          ),
        ],
        aborted: false,
        truncated: false,
      };
    }
    if (!before.isDirectory()) {
      return {
        entry: null,
        diagnostics: [
          makeDiagnostic(
            "SPEC_ENTRY_INVALID",
            "warning",
            relativePath,
            "A specification entry is not a directory.",
            "Use an ordinary directory for each specification slug.",
          ),
        ],
        aborted: false,
        truncated: false,
      };
    }
    const realBefore = await realpath(absolutePath);

    const scanned = await readDirectoryEntriesBounded(absolutePath, signal);
    if (scanned.aborted) {
      return { entry: null, diagnostics: [], aborted: true, truncated: true };
    }

    const after = await lstat(absolutePath);
    const realAfter = await realpath(absolutePath);
    const confirmation = await readDirectoryEntriesBounded(absolutePath, signal);
    if (confirmation.aborted) {
      return { entry: null, diagnostics: [], aborted: true, truncated: true };
    }
    if (
      !sameDirectoryIdentity(before, after, realBefore, realAfter) ||
      !sameDirectoryScan(scanned, confirmation)
    ) {
      return {
        entry: null,
        diagnostics: [
          makeDiagnostic(
            "PATH_ESCAPE_BLOCKED",
            "error",
            relativePath,
            "The specification directory changed while it was inspected.",
            "Retry after the project tree is stable.",
          ),
        ],
        aborted: false,
        truncated: true,
      };
    }

    if (scanned.exceeded) {
      rawDiagnostics.push(
        makeDiagnostic(
          "LIMIT_REACHED",
          "warning",
          relativePath,
          "The specification directory exceeded the metadata scan cap.",
          "Remove unrelated entries or inspect the specification separately.",
        ),
      );
    }

    const byName = new Map(scanned.entries.map((entry) => [entry.name, entry]));
    const canonicalNames = canonicalNamesForSlug(slug);
    const missingDocuments = [];
    let invalidCanonicalEntry = false;
    let documentCount = 0;

    for (const canonicalName of canonicalNames) {
      const candidate = byName.get(canonicalName);
      if (!candidate || !candidate.isFile() || candidate.isSymbolicLink()) {
        missingDocuments.push(canonicalName);
        if (candidate) invalidCanonicalEntry = true;
        continue;
      }
      documentCount += 1;
    }

    sortStrings(missingDocuments);
    if (missingDocuments.length > 0) {
      rawDiagnostics.push(
        makeDiagnostic(
          "SPEC_INCOMPLETE",
          "warning",
          relativePath,
          "A specification is missing one or more canonical documents.",
          "Add the missing canonical documents before claiming completeness.",
        ),
      );
    }
    if (invalidCanonicalEntry) {
      rawDiagnostics.push(
        makeDiagnostic(
          "SPEC_ENTRY_INVALID",
          "error",
          relativePath,
          "A canonical document name is not an ordinary regular file.",
          "Replace linked or non-file entries with ordinary files.",
        ),
      );
    }

    return {
      entry: {
        slug,
        path: relativePath,
        status: invalidCanonicalEntry ? "invalid" : missingDocuments.length > 0 ? "incomplete" : "recognized",
        documentCount: includeDocumentCounts ? documentCount : null,
        missingDocuments,
      },
      diagnostics: rawDiagnostics,
      aborted: false,
      truncated: scanned.exceeded,
    };
  } catch (error) {
    if (isPermissionError(error)) {
      return {
        entry: {
          slug,
          path: relativePath,
          status: "unreadable",
          documentCount: null,
          missingDocuments: [],
        },
        diagnostics: [
          makeDiagnostic(
            "PERMISSION_DENIED",
            "error",
            relativePath,
            "The specification directory could not be read.",
            "Grant read permission and retry.",
          ),
        ],
        aborted: false,
        truncated: false,
      };
    }
    if (isMissingError(error)) {
      return {
        entry: null,
        diagnostics: [
          makeDiagnostic(
            "SPEC_ENTRY_INVALID",
            "warning",
            relativePath,
            "A specification entry disappeared during inspection.",
            "Retry after the project tree is stable.",
          ),
        ],
        aborted: false,
        truncated: true,
      };
    }
    return {
      entry: null,
      diagnostics: [
        makeDiagnostic(
          "INTERNAL_ERROR_REDACTED",
          "error",
          relativePath,
          "The specification directory could not be inspected safely.",
          "Retry after checking project permissions and filesystem health.",
        ),
      ],
      aborted: false,
      truncated: false,
    };
  }
}

export async function inventorySpecs(projectRoot, request = {}, signal, runtimeHooks = {}) {
  const validation = validateRequest(request);
  if (!validation.ok) {
    return makeResult("invalid", [], [validation.diagnostic], null, false, 1);
  }
  const options = validation.value;

  if (typeof projectRoot !== "string" || projectRoot.length === 0) {
    return makeResult(
      "invalid",
      [],
      [
        makeDiagnostic(
          "INVALID_REQUEST",
          "error",
          null,
          "The active project root is unavailable.",
          "Run the tool from an active OMP project session.",
        ),
      ],
      null,
      false,
      options.maxDiagnostics,
    );
  }

  if (isAbortRequested(signal)) {
    return makeResult(
      "aborted",
      [],
      [makeDiagnostic("REQUEST_ABORTED", "info", null, "The inventory request was aborted.", null)],
      null,
      true,
      options.maxDiagnostics,
    );
  }

  const root = path.resolve(projectRoot);
  const specsRoot = path.join(root, ".specs");
  const diagnostics = [];
  const specs = [];
  let truncated = false;

  try {
    const rootStat = await lstat(root);
    if (rootStat.isSymbolicLink()) {
      return makeResult(
        "invalid",
        [],
        [
          makeDiagnostic(
            "SYMLINK_ESCAPE_BLOCKED",
            "error",
            null,
            "The active project root is a symbolic link and was not traversed.",
            "Start OMP from an ordinary project directory.",
          ),
        ],
        null,
        false,
        options.maxDiagnostics,
      );
    }
    const rootReal = await realpath(root);

    let specsRootStat;
    try {
      specsRootStat = await lstat(specsRoot);
    } catch (error) {
      if (isMissingError(error)) {
        return makeResult(
          "absent",
          [],
          [
            makeDiagnostic(
              "SPECS_ABSENT",
              "info",
              ".specs",
              "The active project does not contain a .specs directory.",
              "Create specifications before requesting an inventory.",
            ),
          ],
          0,
          false,
          options.maxDiagnostics,
        );
      }
      if (isPermissionError(error)) {
        return makeResult(
          "error",
          [],
          [
            makeDiagnostic(
              "PERMISSION_DENIED",
              "error",
              ".specs",
              "The .specs path could not be inspected.",
              "Grant read permission and retry.",
            ),
          ],
          null,
          false,
          options.maxDiagnostics,
        );
      }
      throw error;
    }

    if (specsRootStat.isSymbolicLink()) {
      return makeResult(
        "invalid",
        [],
        [
          makeDiagnostic(
            "SYMLINK_ESCAPE_BLOCKED",
            "error",
            ".specs",
            "The .specs path is a symbolic link and was not traversed.",
            "Replace it with an ordinary directory inside the active project.",
          ),
        ],
        null,
        false,
        options.maxDiagnostics,
      );
    }
    if (!specsRootStat.isDirectory()) {
      return makeResult(
        "invalid",
        [],
        [
          makeDiagnostic(
            "SPECS_NOT_DIRECTORY",
            "error",
            ".specs",
            "The .specs path is not a directory.",
            "Replace it with an ordinary directory.",
          ),
        ],
        null,
        false,
        options.maxDiagnostics,
      );
    }
    const specsRootRealBefore = await realpath(specsRoot);
    if (path.relative(rootReal, specsRootRealBefore) !== ".specs") {
      return makeResult(
        "invalid",
        [],
        [
          makeDiagnostic(
            "PATH_ESCAPE_BLOCKED",
            "error",
            ".specs",
            "The .specs path resolves outside the active project.",
            "Use an ordinary .specs directory inside the active project.",
          ),
        ],
        null,
        false,
        options.maxDiagnostics,
      );
    }

    const scanned = await readDirectoryEntriesBounded(specsRoot, signal);
    if (scanned.aborted) {
      return makeResult(
        "aborted",
        [],
        [makeDiagnostic("REQUEST_ABORTED", "info", null, "The inventory request was aborted.", null)],
        null,
        true,
        options.maxDiagnostics,
      );
    }
    if (typeof runtimeHooks.afterSpecsRootScan === "function") {
      await runtimeHooks.afterSpecsRootScan({ root, specsRoot });
    }
    const specsRootAfter = await lstat(specsRoot);
    const specsRootRealAfter = await realpath(specsRoot);
    const confirmation = await readDirectoryEntriesBounded(specsRoot, signal);
    if (confirmation.aborted) {
      return makeResult(
        "aborted",
        [],
        [makeDiagnostic("REQUEST_ABORTED", "info", null, "The inventory request was aborted.", null)],
        null,
        true,
        options.maxDiagnostics,
      );
    }
    if (
      !sameDirectoryIdentity(
        specsRootStat,
        specsRootAfter,
        specsRootRealBefore,
        specsRootRealAfter,
      ) ||
      path.relative(rootReal, specsRootRealAfter) !== ".specs" ||
      !sameDirectoryScan(scanned, confirmation)
    ) {
      return makeResult(
        "invalid",
        [],
        [
          makeDiagnostic(
            "PATH_ESCAPE_BLOCKED",
            "error",
            ".specs",
            "The .specs directory changed while it was inspected.",
            "Retry after the project tree is stable.",
          ),
        ],
        null,
        true,
        options.maxDiagnostics,
      );
    }
    if (scanned.exceeded) {
      truncated = true;
      diagnostics.push(
        makeDiagnostic(
          "LIMIT_REACHED",
          "warning",
          ".specs",
          "The .specs directory exceeded the metadata scan cap.",
          "Reduce direct entries before requesting a complete inventory.",
        ),
      );
    }

    const orderedEntries = [...scanned.entries].sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
    const validDirectories = [];
    const seenSlugs = new Set();

    for (const entry of orderedEntries) {
      if (isAbortRequested(signal)) {
        return makeResult(
          "aborted",
          specs,
          [...diagnostics, makeDiagnostic("REQUEST_ABORTED", "info", null, "The inventory request was aborted.", null)],
          null,
          true,
          options.maxDiagnostics,
        );
      }
      if (entry.isSymbolicLink()) {
        diagnostics.push(
          makeDiagnostic(
            "SYMLINK_ESCAPE_BLOCKED",
            "error",
            ".specs",
            "A linked entry below .specs was not traversed.",
            "Replace linked entries with ordinary project directories.",
          ),
        );
        continue;
      }
      if (!entry.isDirectory()) {
        diagnostics.push(
          makeDiagnostic(
            "SPEC_ENTRY_INVALID",
            "warning",
            ".specs",
            "A direct .specs entry is not a specification directory.",
            "Keep only ordinary specification directories below .specs.",
          ),
        );
        continue;
      }
      if (!SLUG_PATTERN.test(entry.name)) {
        diagnostics.push(
          makeDiagnostic(
            "SPEC_SLUG_INVALID",
            "warning",
            ".specs",
            "A specification directory has an invalid slug.",
            "Rename it to the documented lowercase slug grammar.",
          ),
        );
        continue;
      }
      if (seenSlugs.has(entry.name)) {
        diagnostics.push(
          makeDiagnostic(
            "SPEC_DUPLICATE_SLUG",
            "error",
            ".specs",
            "A duplicate specification slug was observed.",
            "Keep one directory for each exact slug.",
          ),
        );
        continue;
      }
      seenSlugs.add(entry.name);
      validDirectories.push(entry.name);
    }

    const observedSpecs = scanned.exceeded ? null : validDirectories.length;
    const selectedSlugs = validDirectories.slice(0, options.maxSpecs);
    if (validDirectories.length > selectedSlugs.length) {
      truncated = true;
      diagnostics.push(
        makeDiagnostic(
          "LIMIT_REACHED",
          "warning",
          ".specs",
          "Additional specifications were omitted by maxSpecs.",
          "Increase maxSpecs within the documented hard cap.",
        ),
      );
    }

    for (const slug of selectedSlugs) {
      if (isAbortRequested(signal)) {
        return makeResult(
          "aborted",
          specs,
          [...diagnostics, makeDiagnostic("REQUEST_ABORTED", "info", null, "The inventory request was aborted.", null)],
          null,
          true,
          options.maxDiagnostics,
        );
      }
      const inspected = await inspectSpecDirectory(
        specsRoot,
        slug,
        options.includeDocumentCounts,
        signal,
      );
      if (inspected.aborted) {
        return makeResult(
          "aborted",
          specs,
          [...diagnostics, makeDiagnostic("REQUEST_ABORTED", "info", null, "The inventory request was aborted.", null)],
          null,
          true,
          options.maxDiagnostics,
        );
      }
      if (inspected.entry) specs.push(inspected.entry);
      diagnostics.push(...inspected.diagnostics);
      truncated ||= inspected.truncated;
    }

    specs.sort((left, right) => (left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0));
    const status = truncated || diagnostics.some((item) => item.severity !== "info") ? "partial" : "ok";
    return makeResult(status, specs, diagnostics, observedSpecs, truncated, options.maxDiagnostics);
  } catch (error) {
    if (typeof runtimeHooks.onInternalError === "function") {
      await runtimeHooks.onInternalError(error);
    }
    if (isAbortRequested(signal)) {
      return makeResult(
        "aborted",
        specs,
        [...diagnostics, makeDiagnostic("REQUEST_ABORTED", "info", null, "The inventory request was aborted.", null)],
        null,
        true,
        options.maxDiagnostics,
      );
    }
    return makeResult(
      "error",
      specs,
      [
        ...diagnostics,
        makeDiagnostic(
          isPermissionError(error) ? "PERMISSION_DENIED" : "INTERNAL_ERROR_REDACTED",
          "error",
          null,
          isPermissionError(error)
            ? "The specification inventory could not read the active project."
            : "The specification inventory failed safely.",
          "Check project permissions and retry.",
        ),
      ],
      null,
      truncated,
      options.maxDiagnostics,
    );
  }
}

export function summarizeInventory(result) {
  const observed = result.counts.observedSpecs === null ? "unknown" : String(result.counts.observedSpecs);
  const suffix = result.truncated ? " (truncated)" : "";
  return `spec_inventory ${result.status}: returned ${result.counts.returnedSpecs} of ${observed} observed specs; ${result.counts.returnedDiagnostics} diagnostics${suffix}.`;
}
