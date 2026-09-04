import path from "node:path";
import { lstatSync, realpathSync } from "node:fs";

const INDETERMINATE_INPUT = /[\u0000]/u;
const WINDOWS_UNSAFE_PATH = /^(?:[\\/]{2}(?:[?.]|$)|[a-z]:[^\\/]|.*:[^\\/]*$)/iu;
const URI_SHAPED = /^[a-z][a-z0-9+.-]*:\/\//iu;
const XD_PREFIX = "xd://";

function isXdDeviceTarget(raw) {
  if (typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (!trimmed.toLowerCase().startsWith(XD_PREFIX)) return false;
  const name = trimmed.slice(XD_PREFIX.length);
  if (name.length === 0) return true;
  if (/[/?#]/.test(name)) return false;
  return true;
}

function components(value) {
  return path.resolve(value).split(/[\\/]+/u).filter(Boolean).map((part) => part.toLowerCase());
}

function inside(candidate, root) {
  const candidateParts = components(candidate);
  const rootParts = components(root);
  return candidateParts.length >= rootParts.length && rootParts.every((part, index) => candidateParts[index] === part);
}

function relativeTarget(root, absolute) {
  const relative = path.relative(root, absolute).replaceAll("\\", "/");
  return relative === "" ? "." : relative;
}

function unsafeTarget(raw) {
  if (typeof raw !== "string" || raw.trim() === "" || INDETERMINATE_INPUT.test(raw)) return true;
  const trimmed = raw.trim();
  if (trimmed.toLowerCase().startsWith(XD_PREFIX) || URI_SHAPED.test(trimmed)) return true;
  if (process.platform === "win32" && WINDOWS_UNSAFE_PATH.test(raw)) return true;
  return false;
}

function existingAncestor(absolute) {
  let current = absolute;
  while (true) {
    try {
      return { absolute: current, stat: lstatSync(current) };
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
      const parent = path.dirname(current);
      if (parent === current) return null;
      current = parent;
    }
  }
}

function resolvedExistingPath(absolute, ancestor) {
  if (ancestor.absolute === absolute) return realpathSync.native(absolute);
  return path.join(realpathSync.native(ancestor.absolute), path.relative(ancestor.absolute, absolute));
}

function resolveSpecsRoot(projectRoot) {
  const specsCandidate = path.join(projectRoot, ".specs");
  try {
    return realpathSync.native(specsCandidate);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      return specsCandidate;
    }
    throw error;
  }
}

/** Resolve one raw tool target against the physical project and specification roots. */
export function resolveTarget(root, raw) {
  if (isXdDeviceTarget(raw)) return { resolution: "NON_SPEC", relativePath: null };
  if (unsafeTarget(raw)) return { resolution: "INDETERMINATE", relativePath: null };
  try {
    const projectRoot = realpathSync.native(path.resolve(root));
    const specsRoot = resolveSpecsRoot(projectRoot);
    const absolute = path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(projectRoot, raw);
    const ancestor = existingAncestor(absolute);
    if (!ancestor) return { resolution: "INDETERMINATE", relativePath: null };
    const resolved = resolvedExistingPath(absolute, ancestor);
    const relativePath = inside(resolved, projectRoot) ? relativeTarget(projectRoot, resolved) : null;
    return {
      resolution: inside(resolved, specsRoot) ? "SPEC" : "NON_SPEC",
      relativePath,
    };
  } catch {
    return { resolution: "INDETERMINATE", relativePath: null };
  }
}

/** Resolve every target; an absent or empty list is indeterminate. */
export function resolveTargets(root, targets) {
  if (!Array.isArray(targets) || targets.length === 0) return [{ resolution: "INDETERMINATE", relativePath: null }];
  return targets.map((target) => resolveTarget(root, target));
}

/** Return the closed decision for a direct path-policy check. */
export function decidePathPolicy(root, targets) {
  const resolutions = resolveTargets(root, targets);
  if (resolutions.some((item) => item.resolution === "INDETERMINATE")) {
    return { decision: "BLOCK", code: "TARGET_INDETERMINATE", resolutions };
  }
  if (resolutions.some((item) => item.resolution === "SPEC")) {
    return { decision: "BLOCK", code: "RAW_SPEC_WRITE", resolutions };
  }
  return { decision: "ALLOW", code: "NON_SPEC_ALLOWED", resolutions };
}

export { inside as isPathInside };
