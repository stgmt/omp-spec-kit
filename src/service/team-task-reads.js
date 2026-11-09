import { isValidSpecSlug } from "../kernel/identity.js";
import { serviceErrorEnvelope } from "./dispatch.js";
import { requireTeamSpecBinding } from "./team-specs-auth.js";

function taskReadError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function createTeamTaskReads({ store, mounts }) {
  return {
    async tasks({ args, ctx, project, requestId, schemaVersion }) {
      if (args.teamId === undefined) return undefined;
      try {
        if (typeof args.teamId !== "string" || args.teamId.trim() === "") {
          throw taskReadError("INVALID_TEAM_ID", "team-scoped task reads require a non-empty teamId");
        }
        if (!isValidSpecSlug(args.spec)) {
          throw taskReadError("INVALID_SPEC_SLUG", `invalid project spec slug: ${String(args.spec)}`);
        }
        if (!store || typeof store.listTeamSpecsTaskBindings !== "function") {
          throw taskReadError("TEAM_STORE_UNAVAILABLE", "the persistent team task registry is unavailable");
        }
        await requireTeamSpecBinding({ store, ctx, teamId: args.teamId, project, spec: args.spec });
        const bindings = await store.listTeamSpecsTaskBindings({ teamId: args.teamId, project, spec: args.spec });
        if (
          !Array.isArray(bindings) ||
          bindings.some((binding) =>
            !binding ||
            binding.teamId !== args.teamId ||
            binding.project !== project ||
            binding.spec !== args.spec ||
            typeof binding.taskId !== "string" ||
            binding.taskId.trim() === ""
          )
        ) {
          throw taskReadError("TEAM_REGISTRY_CORRUPT", "the team task registry returned an invalid or out-of-scope task binding");
        }
        const taskIds = bindings.map((binding) => binding.taskId);

        const envelope = await mounts.serviceFor(project).runQuery("tasks", {
          spec: args.spec,
          statuses: args.statuses,
          phase: args.phase,
          requirement: args.requirement,
          includeComments: args.includeComments,
          limit: args.limit,
          cursor: args.cursor,
        }, {
          requestId,
          schemaVersion,
          project,
          taskFilter: { teamId: args.teamId, taskIds },
        });
        return { envelope };
      } catch (error) {
        const extra = error?.retryable === true || error?.status === 503 ? { retryable: true } : {};
        return {
          envelope: serviceErrorEnvelope(
            "tasks",
            requestId,
            typeof error?.code === "string" && error.code.length > 0 ? error.code : "TEAM_TASK_READ_FAILED",
            String(error?.message ?? error),
            extra,
          ),
        };
      }
    },
  };
}
