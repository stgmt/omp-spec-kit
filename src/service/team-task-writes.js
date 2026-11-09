import { taskLocalId } from "../authoring/task-ops.js";
import { requireScope } from "./scope.js";
import { requireTeamSpecBinding } from "./team-specs-auth.js";

const TASK_OPERATION_KINDS = new Set([
  "upsert_task",
  "replace_task_links",
  "replace_task_owner",
  "replace_task_status",
]);
const REQUIREMENT_KINDS = new Set([
  "FUNCTIONAL_REQUIREMENT",
  "NON_FUNCTIONAL_REQUIREMENT",
  "ACCEPTANCE_CRITERION",
]);
const REQUIREMENT_ID_PREFIX = /^(?:FR-|NFR-|AC-)/u;
const TEAM_TRACKING_PREFIX = "agent-teams:";

function taskIdForOperation(operation) {
  return taskLocalId(operation.kind === "upsert_task" ? operation.localId : operation.entity);
}

function canonicalTarget(raw, spec) {
  const value = raw.trim();
  return value.includes(":") ? value : `${spec}:${value}`;
}

function isTeamTracking(value) {
  return typeof value === "string" && value.startsWith(TEAM_TRACKING_PREFIX);
}

function teamTaskError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireFinalRequirementLink({ graph, spec, taskCanonicalId, taskNode, operation }) {
  const nodeById = new Map(graph.nodes.map((node) => [node.canonicalId, node]));
  const links = new Set();
  for (const edge of graph.edges) {
    if (edge.from !== taskCanonicalId || !["REFS", "COVERS", "IMPLEMENTS"].includes(edge.type)) continue;
    if (edge.type === "IMPLEMENTS" && operation.requirements !== undefined) continue;
    if (edge.type === "REFS" && operation.refs !== undefined) continue;
    const target = nodeById.get(edge.to);
    if (target && target.specSlug === spec && REQUIREMENT_KINDS.has(target.kind)) links.add(target.canonicalId);
  }

  for (const field of ["requirements", "refs"]) {
    const targets = operation[field];
    if (targets === undefined || !Array.isArray(targets)) continue;
    for (const raw of targets) {
      if (typeof raw !== "string") continue;
      const canonicalId = canonicalTarget(raw, spec);
      const target = nodeById.get(canonicalId);
      if (target && REQUIREMENT_KINDS.has(target.kind)) {
        if (target.specSlug !== spec) {
          throw teamTaskError("TEAM_REQUIREMENT_INVALID", `${field} must reference an existing FR, NFR, or AC in selected specification ${spec}: ${canonicalId}`);
        }
        links.add(canonicalId);
        continue;
      }
      const local = canonicalId.slice(canonicalId.indexOf(":") + 1);
      if (field === "requirements" || REQUIREMENT_ID_PREFIX.test(local)) {
        throw teamTaskError("TEAM_REQUIREMENT_INVALID", `${field} must reference an existing FR, NFR, or AC in selected specification ${spec}: ${canonicalId}`);
      }
    }
  }

  if (links.size === 0) {
    const id = taskNode?.canonicalId ?? taskCanonicalId;
    throw teamTaskError("TEAM_REQUIREMENT_REQUIRED", `shared task ${id} must retain at least one existing FR, NFR, or AC link`);
  }
}

export async function preflightTeamTaskWrites({ args, ctx, project, store, authoringService }) {
  const spec = typeof args.spec === "string" ? args.spec : null;
  const operations = args.intent === "patch" && Array.isArray(args.operations)
    ? args.operations.filter((operation) => TASK_OPERATION_KINDS.has(operation.kind))
    : [];
  const touchesTaskDocument =
    (["deleteSpecDoc", "renameSpecDoc"].includes(args.intent) && args.doc === "TASKS.md") ||
    (args.intent === "patch" && Array.isArray(args.operations) && args.operations.some((operation) =>
      operation.document === "TASKS.md" && !TASK_OPERATION_KINDS.has(operation.kind)
    ));
  if (args.intent === "setEntityStatus") {
    operations.push({
      kind: "replace_task_status",
      entity: args.entity,
      status: args.status,
      expectedStatus: args.expectedStatus,
      teamId: args.teamId,
    });
  }
  const targets = operations.map((operation) => ({
    operation,
    taskId: taskIdForOperation(operation),
    entity: null,
    teamId: operation.teamId,
    deleting: false,
  }));
  if (args.intent === "deleteEntity") {
    targets.push({ operation: null, taskId: taskLocalId(args.entity), entity: args.entity, teamId: args.teamId, deleting: true });
  }
  if (targets.length === 0 && !touchesTaskDocument) return { binds: [], deletes: [] };
  if (spec === null) throw teamTaskError("SPEC_REQUIRED", "team task writes require one selected specification");
  if (
    !store ||
    typeof store.getTeamSpecsTaskBinding !== "function" ||
    typeof store.applyTeamSpecsTaskBindings !== "function" ||
    typeof store.listTeamSpecsTeamsForBinding !== "function"
  ) {
    throw teamTaskError("TEAM_STORE_UNAVAILABLE", "the persistent team task registry is unavailable");
  }

  const state = await authoringService.ensure();
  if (state?.status !== "ready" || !state.graph) {
    throw teamTaskError(state?.readerError?.code ?? "TEAM_TASK_GRAPH_UNAVAILABLE", "the existing project graph is unavailable; shared-task writes are refused");
  }
  const graph = state.graph;
  const nodeById = new Map(graph.nodes.map((node) => [node.canonicalId, node]));
  if (touchesTaskDocument) {
    for (const task of graph.nodes) {
      if (task.specSlug !== spec || task.kind !== "TASK") continue;
      const binding = await store.getTeamSpecsTaskBinding({ project, spec, taskId: task.localId });
      if (binding || isTeamTracking(task.attributes?.tracking)) {
        throw teamTaskError("TEAM_TASK_OPERATION_REQUIRED", `TASKS.md contains shared task ${task.canonicalId}; use per-task operations with the registry-issued teamId`);
      }
    }
  }
  const binds = new Map();
  const deletes = new Map();
  const plannedTeamIds = new Map();
  const autoAssignedTeamIds = new Set();

  for (const target of targets) {
    if (!target.taskId && target.deleting && typeof target.entity === "string") {
      const node = nodeById.get(target.entity);
      if (node?.specSlug === spec && node.kind === "TASK") target.taskId = node.localId;
    }
    if (!target.taskId && target.deleting) continue;
    if (!target.taskId) throw teamTaskError("INVALID_TASK_ID", "team task operation needs a local TASK id");
    const key = `${project}\\0${spec}\\0${target.taskId}`;
    const canonicalId = `${spec}:${target.taskId}`;
    const taskNode = nodeById.get(canonicalId) ?? null;
    const existing = await store.getTeamSpecsTaskBinding({ project, spec, taskId: target.taskId });
    const trackingHint = isTeamTracking(taskNode?.attributes?.tracking) || isTeamTracking(target.operation?.tracking);
    let teamId = typeof target.teamId === "string" && target.teamId.trim() !== "" ? target.teamId : null;
    const planned = plannedTeamIds.get(key);
    if (teamId === null && planned !== undefined) teamId = planned;

    if (existing && teamId === null) {
      throw teamTaskError("TEAM_ID_REQUIRED", `shared task ${canonicalId} requires its registry-issued teamId`);
    }
    if (existing && existing.teamId !== teamId) {
      throw teamTaskError("TEAM_TASK_ACCESS_DENIED", `teamId does not own shared task ${canonicalId}`);
    }
    // A pre-existing unbound task may be personal or belong to another context.
    // Linking a spec to one team is not evidence of ownership of old tasks.
    if (teamId === null && !taskNode && target.operation?.kind === "upsert_task") {
      const scope = requireScope(ctx?.scope, "team task write");
      if (!scope.allows(project)) {
        throw teamTaskError("PROJECT_NOT_ALLOWED", "team task write is outside the caller's allowed project scope");
      }
      const linkedTeams = await store.listTeamSpecsTeamsForBinding({ project, spec });
      if (linkedTeams.length > 1) {
        throw teamTaskError("TEAM_ID_REQUIRED", `multiple teams are linked to ${project}/${spec}; select the teamId explicitly`);
      }
      if (linkedTeams.length === 1) {
        teamId = linkedTeams[0].teamId;
        autoAssignedTeamIds.add(key);
      }
    }
    if (!existing && trackingHint && teamId === null) {
      throw teamTaskError("TEAM_ID_REQUIRED", `team task ${canonicalId} requires its registry-issued teamId`);
    }
    if (planned !== undefined && planned !== teamId) {
      throw teamTaskError("TEAM_ID_REQUIRED", `all writes to shared task ${canonicalId} must carry the same teamId`);
    }
    if (teamId === null) continue;
    const { ownerPrincipal } = await requireTeamSpecBinding({ store, ctx, teamId, project, spec });
    if (planned === undefined) plannedTeamIds.set(key, teamId);

    if (!target.deleting) {
      requireFinalRequirementLink({ graph, spec, taskCanonicalId: canonicalId, taskNode, operation: target.operation });
      const binding = { teamId, ownerPrincipal, project, spec, taskId: target.taskId, createdAt: new Date().toISOString() };
      if (autoAssignedTeamIds.has(key)) binding.requireUnambiguous = true;
      binds.set(key, binding);
    } else if (existing) {
      deletes.set(key, { teamId, ownerPrincipal, project, spec, taskId: target.taskId, createdAt: new Date().toISOString() });
    }
  }
  return { binds: [...binds.values()], deletes: [...deletes.values()] };
}
