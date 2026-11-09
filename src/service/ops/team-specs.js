import { randomUUID } from "node:crypto";
import { isValidSpecSlug } from "../../kernel/identity.js";
import { serviceErrorEnvelope, serviceSuccess } from "../dispatch.js";
import { requireScope } from "../scope.js";
import { requireTeamOwner, teamPrincipal } from "../team-specs-auth.js";
import {
  field,
  optionalField,
  LOCAL_READ_TOOL_ANNOTATIONS,
  MUTATING_TOOL_ANNOTATIONS,
} from "../../adapters/tool-contracts.js";

export const TEAM_SPECS_CONTRACTS = Object.freeze([
  {
    tool: "team_specs",
    label: "Team Spec Bindings",
    operation: "teamSpecs",
    description: "Register a server-issued team id and manage that team's spec bindings using the authenticated registry principal and project scope.",
    commonFields: Object.freeze([field("requestId", "string")]),
    fields: Object.freeze([]),
    discriminator: "action",
    variants: Object.freeze({
      identity: Object.freeze({
        description: "Identify the persistent registry and authenticated principal for team registration.",
        setupExempt: true,
        annotations: LOCAL_READ_TOOL_ANNOTATIONS,
        fields: Object.freeze([]),
      }),
      register: Object.freeze({
        description: "Create or recover the persistent team id for this authenticated principal.",
        setupExempt: true,
        annotations: MUTATING_TOOL_ANNOTATIONS,
        fields: Object.freeze([
          optionalField("expectedSecurityStoreId", "string"),
          optionalField("expectedIdp", "string"),
          optionalField("expectedUserId", "string"),
        ]),
      }),
      list: Object.freeze({
        description: "List every binding for this team that is within the caller's project scopes.",
        listing: true,
        setupExempt: true,
        annotations: LOCAL_READ_TOOL_ANNOTATIONS,
        fields: Object.freeze([field("teamId", "string")]),
      }),
      link: Object.freeze({
        description: "Link a project spec that exists in its bound repository to this team.",
        setupExempt: true,
        annotations: MUTATING_TOOL_ANNOTATIONS,
        fields: Object.freeze([field("teamId", "string"), field("spec", "string")]),
      }),
      unlink: Object.freeze({
        description: "Remove one project/spec binding from this team without importing or deleting spec data.",
        setupExempt: true,
        annotations: MUTATING_TOOL_ANNOTATIONS,
        fields: Object.freeze([field("teamId", "string"), field("spec", "string")]),
      }),
    }),
  },
]);

function operationError(code, message, { retryable = false } = {}) {
  const error = new Error(message);
  error.code = code;
  error.retryable = retryable;
  return error;
}


function requireRequestId(value) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 256) {
    throw operationError("INVALID_REQUEST", "team_specs requires a non-empty requestId of at most 256 characters");
  }
  return value;
}


function requireVisibleBindings(bindings, scope) {
  for (const binding of bindings) {
    if (!scope.allows(binding.project)) {
      throw operationError("PROJECT_NOT_ALLOWED", `team binding is outside the caller's allowed project set: ${binding.project}`);
    }
  }
}

function validateStore(store) {
  if (!store || [
    "getTeamSpecsTeam",
    "listTeamSpecsBindings",
    "getTeamSpecsRequest",
    "registerTeamSpecsTeam",
    "applyTeamSpecsBinding",
    "getTeamSpecsTaskBinding",
    "applyTeamSpecsTaskBindings",
  ].some((method) => typeof store[method] !== "function")) {
    throw operationError("TEAM_STORE_UNAVAILABLE", "the persistent team-spec registry is unavailable", { retryable: true });
}
}

async function settled(requestId, run) {
  try {
    return { envelope: serviceSuccess("teamSpecs", requestId, await run()) };
  } catch (error) {
    const code = typeof error?.code === "string" && error.code.length > 0 ? error.code : "TEAM_SPECS_FAILED";
    return {
      envelope: serviceErrorEnvelope("teamSpecs", requestId, code, String(error?.message ?? error), {
        retryable: error?.retryable === true || error?.status === 503,
      }),
    };
  }
}

export function createTeamSpecsOps({ store, mounts }) {
  return {
    teamSpecs: {
      listing: false,
      async run({ args, ctx, project, requestId }) {
        return settled(requestId, async () => {
          validateStore(store);
          const scope = requireScope(ctx?.scope, "team_specs");
          const ownerPrincipal = teamPrincipal(ctx);
          const stableRequestId = requireRequestId(args.requestId ?? requestId);
          const createdAt = new Date().toISOString();

          const expectedKeys = ["expectedSecurityStoreId", "expectedIdp", "expectedUserId"];
          const hasExpected = expectedKeys.some((key) => Object.hasOwn(args, key));
          if (args.action === "identity" || (args.action === "register" && hasExpected)) {
            if (typeof project !== "string" || !scope.allows(project)) {
              throw operationError("PROJECT_REQUIRED", `${args.action} requires one project selected from the caller's RequestScope`);
            }
            if (hasExpected && expectedKeys.some((key) => typeof args[key] !== "string" || args[key].trim().length === 0)) {
              throw operationError("INVALID_REQUEST", "expected registry identity must include all three non-empty fields");
            }
            if (typeof store.getSecurityStoreId !== "function") {
              throw operationError("TEAM_STORE_UNAVAILABLE", "the persistent registry identity is unavailable", { retryable: true });
            }
            const [idp, userId] = JSON.parse(ownerPrincipal);
            const identity = { securityStoreId: await store.getSecurityStoreId(), idp, userId };
            if (args.action === "identity") return identity;
            if (args.expectedSecurityStoreId !== identity.securityStoreId || args.expectedIdp !== idp || args.expectedUserId !== userId) {
              throw operationError("TEAM_IDENTITY_MISMATCH", "expected registry identity does not match the authenticated registry principal");
            }
            const payload = JSON.stringify({ action: "register", project });
            const prior = await store.getTeamSpecsRequest({ ownerPrincipal, requestId: stableRequestId, payload });
            if (prior) {
              await requireTeamOwner(store, prior.teamId, ownerPrincipal);
              const bindings = await store.listTeamSpecsBindings(prior.teamId);
              requireVisibleBindings(bindings, scope);
              return { teamId: prior.teamId, bindings, ...identity };
            }
            const result = await store.registerTeamSpecsTeam({
              teamId: randomUUID(), ownerPrincipal, requestId: stableRequestId, payload, project, createdAt,
            });
            return { ...result, ...identity };
          }
          if (args.action === "register") {
            if (typeof project !== "string" || !scope.allows(project)) {
              throw operationError("PROJECT_REQUIRED", "register requires one project selected from the caller's RequestScope");
            }
            const payload = JSON.stringify({ action: "register", project });
            const prior = await store.getTeamSpecsRequest({ ownerPrincipal, requestId: stableRequestId, payload });
            if (prior) {
              await requireTeamOwner(store, prior.teamId, ownerPrincipal);
              const bindings = await store.listTeamSpecsBindings(prior.teamId);
              requireVisibleBindings(bindings, scope);
              return { teamId: prior.teamId, bindings };
            }
            return store.registerTeamSpecsTeam({
              teamId: randomUUID(), ownerPrincipal, requestId: stableRequestId, payload, project, createdAt,
            });
          }

          const teamId = args.teamId;
          await requireTeamOwner(store, teamId, ownerPrincipal);
          const bindings = await store.listTeamSpecsBindings(teamId);
          requireVisibleBindings(bindings, scope);

          if (args.action === "list") {
            return { teamId, bindings };
          }

          if (args.action !== "link" && args.action !== "unlink") {
            throw operationError("INVALID_REQUEST", `unsupported team_specs action: ${String(args.action)}`);
          }
          if (typeof project !== "string" || !scope.allows(project)) {
            throw operationError("PROJECT_REQUIRED", `${args.action} requires a project selected from the caller's RequestScope`);
          }
          if (!isValidSpecSlug(args.spec)) {
            throw operationError("INVALID_SPEC_SLUG", `invalid project spec slug: ${String(args.spec)}`);
          }

          const payload = JSON.stringify({ action: args.action, teamId, project, spec: args.spec });
          const prior = await store.getTeamSpecsRequest({ ownerPrincipal, requestId: stableRequestId, payload });
          if (prior) {
            if (prior.teamId !== teamId) throw operationError("TEAM_REQUEST_ID_REUSED", "requestId belongs to another team");
            const current = await store.listTeamSpecsBindings(teamId);
            requireVisibleBindings(current, scope);
            return { teamId, bindings: current };
          }

          if (args.action === "link") {
            const { branches } = await mounts.listBranches(project);
            if (!branches.some((branch) => branch.kind === "spec" && branch.spec === args.spec)) {
              throw operationError("SPEC_NOT_FOUND", `spec ${args.spec} does not exist in the bound repository for ${project}`);
            }
          }

          const current = await store.applyTeamSpecsBinding({
            teamId, ownerPrincipal, requestId: stableRequestId, payload, action: args.action,
            project, spec: args.spec, createdAt, allowedProjects: scope.projects,
          });
          requireVisibleBindings(current.bindings, scope);
          return current;
        });
      },
    },
  };
}
