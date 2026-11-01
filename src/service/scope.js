/**
 * The one carrier of "which projects may this request touch, and which one does
 * it target". It is built exactly once, at the authentication boundary
 * (`authGate`), and every function that returns project data takes it as a
 * required argument.
 *
 * Why a class and not a plain object: `requireScope` rejects anything that is
 * not constructed here, so a new caller cannot silently pass `undefined` and
 * receive every project in the deployment. The failure mode of forgetting the
 * scope is a loud SCOPE_REQUIRED, not another tenant's data.
 */

export const SCOPE_REQUIRED = "SCOPE_REQUIRED";

function scopeError(message, extra = {}) {
  const error = new Error(`${SCOPE_REQUIRED}: ${message}`);
  error.code = SCOPE_REQUIRED;
  error.status = 500;
  Object.assign(error, extra);
  return error;
}

export class RequestScope {
  #projects;
  #sessionProject;
  #sessionSource;

  constructor({ projects, sessionProject = null, sessionSource = null } = {}) {
    if (!Array.isArray(projects)) {
      throw scopeError("a request scope needs the caller's project list");
    }
    const unique = [];
    for (const project of projects) {
      if (typeof project !== "string" || project.length === 0) {
        throw scopeError("scope projects must be non-empty strings");
      }
      if (!unique.includes(project)) unique.push(project);
    }
    if (sessionProject !== null && (typeof sessionProject !== "string" || sessionProject.length === 0)) {
      throw scopeError("a scope session project must be a non-empty string or null");
    }
    this.#projects = Object.freeze(unique);
    this.#sessionProject = sessionProject;
    this.#sessionSource = sessionProject === null ? null : (sessionSource ?? "request-context");
    Object.freeze(this);
  }

  /** The projects this request may read. Never the deployment's project list. */
  get projects() {
    return this.#projects;
  }

  /** The project the host attached to this request, before any per-call override. */
  get sessionProject() {
    return this.#sessionProject;
  }

  get sessionSource() {
    return this.#sessionSource;
  }

  get empty() {
    return this.#projects.length === 0;
  }

  allows(project) {
    return typeof project === "string" && this.#projects.includes(project);
  }

  /**
   * The single project-selection contract: an explicit argument wins, then the
   * host's session project, then "every project I may see" for a listing, and
   * otherwise a refusal. Callers translate `error.code` into their envelope;
   * they never re-derive the precedence themselves.
   */
  resolve({ explicitProject = null, listing = false } = {}) {
    const explicit = typeof explicitProject === "string" && explicitProject.trim().length > 0 ? explicitProject.trim() : null;
    if (explicit !== null) {
      if (!this.allows(explicit)) {
        return {
          error: {
            code: "PROJECT_NOT_ALLOWED",
            message: `project is outside the caller's allowed set: ${explicit}`,
            extra: { parameter: "project", receivedSummary: explicit },
          },
        };
      }
      return { project: explicit, source: "explicit" };
    }

    if (this.#sessionProject !== null) {
      if (!this.allows(this.#sessionProject)) {
        return {
          error: {
            code: "PROJECT_NOT_ALLOWED",
            message: `session project is outside the caller's allowed set: ${this.#sessionProject}`,
            extra: { parameter: "project", receivedSummary: this.#sessionProject },
          },
        };
      }
      return { project: this.#sessionProject, source: this.#sessionSource };
    }

    if (listing) return { allScopes: true, source: null };

    if (this.#projects.length > 1) {
      return {
        error: {
          code: "PROJECT_SELECTION_REQUIRED",
          message: "more than one project is available to this caller and none is selected: pass project (owner/project) explicitly",
          extra: { parameter: "project", expected: "owner/project", candidates: this.#projects },
        },
      };
    }

    return {
      error: {
        code: "PROJECT_REQUIRED",
        message: "no project selected for this call: pass project (owner/project), or configure a session project, or bind a default scope",
        extra: { parameter: "project", expected: "owner/project" },
      },
    };
  }

  /** The same allowed set with a different session project: used by listings that narrow to one project. */
  withSessionProject(project, source = "request-context") {
    return new RequestScope({ projects: this.#projects, sessionProject: project, sessionSource: source });
  }

  /**
   * The intersection of this scope with `projects`. Used by a listing that
   * already decided which subset it reports, so the callee receives exactly
   * that subset and cannot widen it back.
   */
  restrict(projects) {
    const keep = new Set(Array.isArray(projects) ? projects : []);
    return new RequestScope({
      projects: this.#projects.filter((project) => keep.has(project)),
      sessionProject: this.#sessionProject !== null && keep.has(this.#sessionProject) ? this.#sessionProject : null,
      sessionSource: this.#sessionSource,
    });
  }

  toJSON() {
    return { projects: [...this.#projects], sessionProject: this.#sessionProject, sessionSource: this.#sessionSource };
  }
}

/** Build the scope at the boundary: the caller's scopes plus the host's session project. */
export function scopeFromContext(ctx) {
  const scopes = Array.isArray(ctx?.scopes) ? ctx.scopes : [];
  const requested = typeof ctx?.project === "string" && ctx.project.trim().length > 0 ? ctx.project.trim() : null;
  const fallback = typeof ctx?.defaultScope === "string" && ctx.defaultScope.trim().length > 0 ? ctx.defaultScope.trim() : null;
  const sessionProject = requested ?? fallback;
  return new RequestScope({
    projects: scopes,
    sessionProject,
    sessionSource: requested !== null ? "request-context" : (fallback !== null ? "default" : null),
  });
}

/** Refuse rather than fall back to "everything" when a scope was not threaded through. */
export function requireScope(value, owner = "this operation") {
  if (value instanceof RequestScope) return value;
  throw scopeError(`${owner} requires a request scope; build one at the auth boundary with scopeFromContext()`);
}
