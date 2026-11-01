/**
 * Project ids are `owner/project` with one slash. The same rule is used by
 * config validation, repository bindings and `.spec-kit.json`; keeping it in
 * one module prevents the binding validator from accepting ids the mount
 * layer (and any path built from them) would reject.
 */
const SEGMENT = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;

export function projectIdError(id) {
  if (typeof id !== "string") return "project id must be a string";
  const slash = id.indexOf("/");
  if (slash <= 0 || slash === id.length - 1) return `project id must be owner/project, got ${JSON.stringify(id)}`;
  const [owner, project] = [id.slice(0, slash), id.slice(slash + 1)];
  for (const segment of [owner, project]) {
    if (!SEGMENT.test(segment) || segment === "." || segment === "..") {
      return `project id segment is invalid: ${JSON.stringify(id)}`;
    }
  }
  return null;
}

export function isValidProjectId(id) {
  return projectIdError(id) === null;
}
