import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { teamStoreError } from "./ledger-team-helpers.js";
import { SqliteStore } from "./sqlite-ledger.js";

/**
 * Service-owned store (DESIGN "Authority split"): fields git cannot express
 * live here — claims, publish ledger, access events. Users, groups, and
 * tokens live only in YouTrack; the verification cache is in-memory (auth.js).
 * Driver:
 * `node:sqlite` when the runtime provides it, documented JSONL fallback
 * otherwise. Both drivers implement the same interface.
 */


function teamRequest(state, ownerPrincipal, requestId, payload) {
  const existing = state.teamSpecRequests.find((request) => request.ownerPrincipal === ownerPrincipal && request.requestId === requestId);
  if (!existing) return null;
  if (existing.payload !== payload) throw teamStoreError("TEAM_REQUEST_ID_REUSED", "requestId was already used for a different team-spec operation");
  return existing;
}

function teamRecord(state, teamId) {
  return state.teams.find((team) => team.teamId === teamId) ?? null;
}

function teamSpecBindings(state, teamId) {
  return state.teamSpecBindings
    .filter((binding) => binding.teamId === teamId)
    .map(({ project, spec }) => ({ project, spec }))
    .sort((left, right) => {
      if (left.project !== right.project) return left.project < right.project ? -1 : 1;
      if (left.spec !== right.spec) return left.spec < right.spec ? -1 : 1;
      return 0;
    });
}
function teamSpecsTeamsForBinding(state, project, spec) {
  const candidates = new Map();
  for (const binding of state.teamSpecBindings) {
    if (binding.project !== project || binding.spec !== spec) continue;
    const team = teamRecord(state, binding.teamId);
    if (!team) throw teamStoreError("TEAM_REGISTRY_CORRUPT", `team spec binding has no team record: ${binding.teamId}`);
    candidates.set(team.teamId, { teamId: team.teamId, ownerPrincipal: team.ownerPrincipal });
  }
  return [...candidates.values()].sort((left, right) => left.teamId < right.teamId ? -1 : left.teamId > right.teamId ? 1 : 0);
}


function teamSpecTaskBinding(state, project, spec, taskId) {
  const binding = state.teamTaskBindings.find((entry) =>
    entry.project === project && entry.spec === spec && entry.taskId === taskId
  );
  return binding ? { ...binding } : null;
}




class JsonlStore {
  #persistTail = Promise.resolve();
  #teamWriteTail = Promise.resolve();
  #tempCounter = 0;
  #securityIdentityFailure = null;

  constructor(file, state) {
    this.file = file;
    this.state = state;
    this.driver = "jsonl";
  }

  static async open(file) {
    let state = {
      claims: [], ledger: [], access_log: [], repo_bindings: [], repo_credentials: [],
      project_registrations: [], idp_bindings: [], idp_credentials: [], teams: [],
      teamSpecBindings: [], teamSpecRequests: [], teamTaskBindings: [],
    };
    try {
      const saved = JSON.parse(await readFile(file, "utf8"));
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
        throw teamStoreError("TEAM_STORE_UNAVAILABLE", "JSON registry state is invalid");
      }
      state = { ...state, ...saved };
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    for (const key of ["teams", "teamSpecBindings", "teamSpecRequests", "teamTaskBindings"]) {
      if (!Array.isArray(state[key])) throw teamStoreError("TEAM_STORE_UNAVAILABLE", `JSON registry ${key} is invalid`);
    }
    return new JsonlStore(file, state);
  }

  async persist() {
    const snapshot = JSON.stringify(this.state, null, 2);
    const operation = this.#persistTail.catch(() => {}).then(async () => {
      const tmp = `${this.file}.${process.pid}.${++this.#tempCounter}.tmp`;
      await mkdir(path.dirname(this.file), { recursive: true });
      await writeFile(tmp, snapshot);
      await rename(tmp, this.file);
    });
    this.#persistTail = operation;
    return operation;
  }

  async #serializeTeamWrite(run) {
    const previous = this.#teamWriteTail;
    let release;
    this.#teamWriteTail = new Promise((resolve) => { release = resolve; });
    await previous;
    const before = {
      teams: [...this.state.teams],
      teamSpecBindings: [...this.state.teamSpecBindings],
      teamSpecRequests: [...this.state.teamSpecRequests],
      teamTaskBindings: [...this.state.teamTaskBindings],
    };
    try {
      return await run();
    } catch (error) {
      this.state.teams = before.teams;
      this.state.teamTaskBindings = before.teamTaskBindings;
      this.state.teamSpecBindings = before.teamSpecBindings;
      this.state.teamSpecRequests = before.teamSpecRequests;
      throw error;
    } finally {
      release();
    }
  }

  async getSecurityStoreId() {
    return this.#serializeTeamWrite(async () => {
      if (this.#securityIdentityFailure) throw this.#securityIdentityFailure;
      const existing = this.state.securityStoreId;
      if (existing !== undefined) {
        if (typeof existing !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(existing)) {
          throw teamStoreError("TEAM_STORE_UNAVAILABLE", "registry security store identity is invalid");
        }
        return existing;
      }
      const id = randomUUID();
      this.state.securityStoreId = id;
      try {
        await this.persist();
      } catch (error) {
        this.#securityIdentityFailure = error;
        throw error;
      }
      return id;
    });
  }

  async getTeamSpecsTeam(teamId) {
    await this.#teamWriteTail;
    const team = teamRecord(this.state, teamId);
    return team ? { ...team } : null;
  }

  async listTeamSpecsBindings(teamId) {
    await this.#teamWriteTail;
    return teamSpecBindings(this.state, teamId);
  }
  async listTeamSpecsTeamsForBinding({ project, spec }) {
    await this.#teamWriteTail;
    return teamSpecsTeamsForBinding(this.state, project, spec);
  }


  async getTeamSpecsTaskBinding({ project, spec, taskId }) {
    await this.#teamWriteTail;
    return teamSpecTaskBinding(this.state, project, spec, taskId);
  }
  async listTeamSpecsTaskBindings({ teamId, project, spec }) {
    await this.#teamWriteTail;
    return this.state.teamTaskBindings
      .filter((binding) => binding.teamId === teamId && binding.project === project && binding.spec === spec)
      .map((binding) => ({ ...binding }))
      .sort((left, right) => left.taskId < right.taskId ? -1 : left.taskId > right.taskId ? 1 : 0);
  }


  applyTeamSpecsTaskBindings({ action, bindings }) {
    return this.#serializeTeamWrite(async () => {
      if (!Array.isArray(bindings)) throw teamStoreError("TEAM_ACTION_INVALID", "team task bindings must be an array");
      for (const binding of bindings) {
        const team = teamRecord(this.state, binding.teamId);
        if (!team || team.ownerPrincipal !== binding.ownerPrincipal) {
          throw teamStoreError("TEAM_ACCESS_DENIED", "team task binding is not authorized for this authenticated principal");
        }
        const existing = teamSpecTaskBinding(this.state, binding.project, binding.spec, binding.taskId);
        if (action === "bind") {
          if (binding.requireUnambiguous === true) {
            const candidates = teamSpecsTeamsForBinding(this.state, binding.project, binding.spec);
            if (candidates.length !== 1 || candidates[0].teamId !== binding.teamId) {
              throw teamStoreError("TEAM_ID_REQUIRED", "the team selection is no longer unambiguous for this project/spec");
            }
          }
          if (!teamSpecBindings(this.state, binding.teamId).some((item) => item.project === binding.project && item.spec === binding.spec)) {
            throw teamStoreError("TEAM_SPEC_NOT_LINKED", `team is not linked to ${binding.project}/${binding.spec}`);
          }
          if (existing && existing.teamId !== binding.teamId) {
            throw teamStoreError("TEAM_TASK_ACCESS_DENIED", `task is already owned by another team: ${binding.project}/${binding.spec}/${binding.taskId}`);
          }
          if (!existing) this.state.teamTaskBindings.push({ project: binding.project, spec: binding.spec, taskId: binding.taskId, teamId: binding.teamId, linkedAt: binding.createdAt });
        } else if (action === "unlink") {
          if (existing && existing.teamId !== binding.teamId) {
            throw teamStoreError("TEAM_TASK_ACCESS_DENIED", `task is already owned by another team: ${binding.project}/${binding.spec}/${binding.taskId}`);
          }
          this.state.teamTaskBindings = this.state.teamTaskBindings.filter((entry) =>
            entry.project !== binding.project || entry.spec !== binding.spec || entry.taskId !== binding.taskId || entry.teamId !== binding.teamId
          );
        } else {
          throw teamStoreError("TEAM_ACTION_INVALID", `unsupported team task binding action: ${String(action)}`);
        }
      }
      await this.persist();
      return bindings.map((binding) => teamSpecTaskBinding(this.state, binding.project, binding.spec, binding.taskId)).filter(Boolean);
    });
  }

  async getTeamSpecsRequest({ ownerPrincipal, requestId, payload }) {
    await this.#teamWriteTail;
    const existing = teamRequest(this.state, ownerPrincipal, requestId, payload);
    if (!existing) return null;
    const team = teamRecord(this.state, existing.teamId);
    if (!team || team.ownerPrincipal !== ownerPrincipal) {
      throw teamStoreError("TEAM_REGISTRY_CORRUPT", "recorded team-spec request has no matching owner record");
    }
    return { teamId: existing.teamId };
  }

  registerTeamSpecsTeam({ teamId, ownerPrincipal, requestId, payload, project, createdAt }) {
    return this.#serializeTeamWrite(async () => {
      const existing = teamRequest(this.state, ownerPrincipal, requestId, payload);
      if (existing) {
        const team = teamRecord(this.state, existing.teamId);
        if (!team || team.ownerPrincipal !== ownerPrincipal) {
          throw teamStoreError("TEAM_REGISTRY_CORRUPT", "recorded registration has no matching owner record");
        }
        return { teamId: existing.teamId, bindings: teamSpecBindings(this.state, existing.teamId) };
      }

      this.state.teams.push({ teamId, ownerPrincipal, registrationProject: project, createdAt });
      this.state.teamSpecRequests.push({ ownerPrincipal, requestId, payload, teamId, createdAt });
      await this.persist();
      return { teamId, bindings: [] };
    });
  }

  applyTeamSpecsBinding({ teamId, ownerPrincipal, requestId, payload, action, project, spec, createdAt, allowedProjects }) {
    return this.#serializeTeamWrite(async () => {
      const team = teamRecord(this.state, teamId);
      if (!team || team.ownerPrincipal !== ownerPrincipal) {
        throw teamStoreError("TEAM_ACCESS_DENIED", "team_specs access is not authorized for this authenticated principal");
      }
      const existing = teamRequest(this.state, ownerPrincipal, requestId, payload);
      if (existing && existing.teamId !== teamId) {
        throw teamStoreError("TEAM_REQUEST_ID_REUSED", "requestId belongs to another team");
      }
      if (existing === null) {
        if (action === "link") {
          const alreadyLinked = this.state.teamSpecBindings.some((binding) =>
            binding.teamId === teamId && binding.project === project && binding.spec === spec
          );
          if (!alreadyLinked) this.state.teamSpecBindings.push({ teamId, project, spec, linkedAt: createdAt });
        } else if (action === "unlink") {
          if (this.state.teamTaskBindings.some((binding) =>
            binding.teamId === teamId && binding.project === project && binding.spec === spec
          )) {
            throw teamStoreError("TEAM_TASKS_STILL_BOUND", `team spec ${project}/${spec} still has bound tasks`);
          }
          this.state.teamSpecBindings = this.state.teamSpecBindings.filter((binding) =>
            binding.teamId !== teamId || binding.project !== project || binding.spec !== spec
          );
        } else {
          throw teamStoreError("TEAM_ACTION_INVALID", `unsupported team_specs binding action: ${String(action)}`);
        }
        this.state.teamSpecRequests.push({ ownerPrincipal, requestId, payload, teamId, createdAt });
      }
      const bindings = teamSpecBindings(this.state, teamId);
      if (bindings.some((binding) => !allowedProjects.includes(binding.project))) {
        throw teamStoreError("PROJECT_NOT_ALLOWED", "one or more team bindings are outside the caller's allowed project set");
      }
      await this.persist();
      return { teamId, bindings };
    });
  }

  getClaim(key) {
    return this.state.claims.find((c) => c.specKey === key) ?? null;
  }

  putClaim(record) {
    const existing = this.state.claims.find((c) => c.specKey === record.specKey);
    if (existing) Object.assign(existing, record);
    else this.state.claims.push({ createdAt: new Date().toISOString(), ...record });
    return this.persist();
  }

  deleteClaim(key) {
    this.state.claims = this.state.claims.filter((c) => c.specKey !== key);
    return this.persist();
  }

  listClaims() {
    return [...this.state.claims];
  }

  appendLedger(entry) {
    const record = { publishedAt: new Date().toISOString(), ...entry };
    const existing = this.state.ledger.find((l) => l.specKey === entry.specKey && l.version === entry.version);
    if (existing) Object.assign(existing, record);
    else this.state.ledger.push(record);
    return this.persist();
  }

  async insertLedgerIfAbsent(entry) {
    const existing = this.state.ledger.find((l) => l.specKey === entry.specKey && l.version === entry.version);
    if (existing) return false;
    this.state.ledger.push({ publishedAt: new Date().toISOString(), ...entry });
    await this.persist();
    return true;
  }

  getLedger(specKey) {
    return this.state.ledger.filter((l) => l.specKey === specKey).sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  }

  putBinding(binding) {
    const record = { boundBy: null, boundAt: null, migratedFrom: null, lastError: null, ...binding, updatedAt: new Date().toISOString() };
    const existing = this.state.repo_bindings.find((b) => b.project === binding.project);
    if (existing) Object.assign(existing, record);
    else this.state.repo_bindings.push(record);
    return this.persist();
  }

  getBinding(project) {
    return this.state.repo_bindings.find((b) => b.project === project) ?? null;
  }

  listBindings() {
    return [...this.state.repo_bindings];
  }

  deleteBinding(project) {
    this.state.repo_bindings = this.state.repo_bindings.filter((b) => b.project !== project);
    return this.persist();
  }

  putRegistration(registration) {
    const record = { registeredBy: null, registeredAt: new Date().toISOString(), ...registration, updatedAt: new Date().toISOString() };
    const existing = this.state.project_registrations.find((r) => r.project === registration.project);
    if (existing) Object.assign(existing, record);
    else this.state.project_registrations.push(record);
    return this.persist();
  }

  getRegistration(project) {
    return this.state.project_registrations.find((r) => r.project === project) ?? null;
  }

  /** Merge a progress patch into an existing registration row. */
  updateRegistration(project, patch) {
    const current = this.getRegistration(project);
    if (current === null) return null;
    return this.putRegistration({ ...current, ...patch });
  }

  listRegistrations({ registeredBy = null } = {}) {
    const rows = this.state.project_registrations ?? [];
    return registeredBy === null ? [...rows] : rows.filter((r) => r.registeredBy === registeredBy);
  }

  deleteRegistration(project) {
    this.state.project_registrations = (this.state.project_registrations ?? []).filter((r) => r.project !== project);
    return this.persist();
  }

  putCredential(project, { repoUrl, tokenEnc, username }) {
    const existing = this.state.repo_credentials.find((c) => c.project === project);
    if (existing) Object.assign(existing, { repoUrl: repoUrl ?? null, tokenEnc, username: username ?? null });
    else this.state.repo_credentials.push({ project, repoUrl: repoUrl ?? null, tokenEnc, username: username ?? null, createdAt: new Date().toISOString() });
    return this.persist();
  }

  getCredential(project) {
    const row = this.state.repo_credentials.find((c) => c.project === project) ?? null;
    return row ? { repoUrl: row.repoUrl, tokenEnc: row.tokenEnc, username: row.username } : null;
  }

  deleteCredential(project) {
    this.state.repo_credentials = this.state.repo_credentials.filter((c) => c.project !== project);
    return this.persist();
  }

  putIdpBinding(binding) {
    const record = { defaultProject: null, boundBy: null, boundAt: null, lastError: null, ...binding, updatedAt: new Date().toISOString() };
    const existing = this.state.idp_bindings.find((b) => b.tenant === binding.tenant);
    if (existing) Object.assign(existing, record);
    else this.state.idp_bindings.push(record);
    return this.persist();
  }

  getIdpBinding(tenant) {
    return this.state.idp_bindings.find((b) => b.tenant === tenant) ?? null;
  }

  getIdpBindingByUrl(youtrackUrl) {
    return this.state.idp_bindings.find((b) => b.youtrackUrl === youtrackUrl) ?? null;
  }

  listIdpBindings() {
    return [...this.state.idp_bindings];
  }

  deleteIdpBinding(tenant) {
    this.state.idp_bindings = this.state.idp_bindings.filter((b) => b.tenant !== tenant);
    return this.persist();
  }

  putIdpCredential(tenant, { serviceTokenEnc }) {
    const existing = this.state.idp_credentials.find((c) => c.tenant === tenant);
    if (existing) Object.assign(existing, { serviceTokenEnc });
    else this.state.idp_credentials.push({ tenant, serviceTokenEnc, createdAt: new Date().toISOString() });
    return this.persist();
  }

  getIdpCredential(tenant) {
    const row = this.state.idp_credentials.find((c) => c.tenant === tenant) ?? null;
    return row ? { serviceTokenEnc: row.serviceTokenEnc } : null;
  }

  deleteIdpCredential(tenant) {
    this.state.idp_credentials = this.state.idp_credentials.filter((c) => c.tenant !== tenant);
    return this.persist();
  }

  logAccess(entry) {
    this.state.access_log.push({ ts: new Date().toISOString(), ...entry });
    if (this.state.access_log.length > 10_000) this.state.access_log = this.state.access_log.slice(-10_000);
    return this.persist();
  }

  listAccess({ resultPrefix, limit = 50 } = {}) {
    return this.state.access_log
      .filter((entry) => typeof entry.result === "string" && entry.result.startsWith(resultPrefix))
      .slice(-limit)
      .reverse();
  }

  close() {}
}

/** Preserve an existing JSON store rather than silently opening an empty SQLite store. */
export async function createStore({ file } = {}) {
  if (!file) throw new Error("store file path is required");
  const exists = async (name) => {
    try {
      await access(name);
      return true;
    } catch (error) {
      if (error?.code === "ENOENT") return false;
      throw error;
    }
  };
  const [hasSqlite, hasJson] = await Promise.all([exists(file), exists(`${file}.json`)]);
  if (hasSqlite && hasJson) {
    throw teamStoreError("TEAM_STORE_UNAVAILABLE", "both SQLite and JSON registry stores exist; refusing to choose between them");
  }
  if (hasJson) return JsonlStore.open(`${file}.json`);
  try {
    await import("node:sqlite");
  } catch (error) {
    if (error?.code !== "ERR_UNKNOWN_BUILTIN_MODULE" && error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
    if (hasSqlite) throw teamStoreError("TEAM_STORE_UNAVAILABLE", "SQLite registry exists but the SQLite driver is unavailable");
    return JsonlStore.open(`${file}.json`);
  }
  return SqliteStore.open(file);
}
