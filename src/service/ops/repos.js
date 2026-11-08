import { serviceErrorEnvelope, serviceSuccess } from "../dispatch.js";
import {
  field,
  LOCAL_READ_TOOL_ANNOTATIONS,
  MUTATING_TOOL_ANNOTATIONS,
  optionalField,
  READ_TOOL_ANNOTATIONS,
} from "../../adapters/tool-contracts.js";

/**
 * Repo variants reach a remote git host, so they extend the shared annotation
 * contracts with `openWorldHint: true` instead of re-declaring every field.
 */
const MUTATING_REMOTE_ANNOTATIONS = Object.freeze({ ...MUTATING_TOOL_ANNOTATIONS, openWorldHint: true });
const READ_REMOTE_ANNOTATIONS = Object.freeze({ ...READ_TOOL_ANNOTATIONS, openWorldHint: true });
const LOCAL_READ_REMOTE_ANNOTATIONS = LOCAL_READ_TOOL_ANNOTATIONS;

/**
 * One typed tool for the project's specs repository: setup, accessibility and
 * current bindings. `bind` and `unbind` are mutating variants with their own
 * operation names, so the dispatcher refuses a reader before any repository
 * access; `probe` and `bindings` are read-only. Every variant is setup-exempt:
 * it must run for a project that has no binding yet. `bindings` is a listing
 * variant: omitting `project` reports every project the caller may see.
 */
export const REPO_CONTRACTS = Object.freeze([
  {
    tool: "spec_repo",
    label: "Spec Repository",
    operation: "specRepo",
    description: "Register a project the deployment does not know (queued, then cloned in the background), report its progress, bind a project to its specs repository, unbind it, probe a credential, or list bindings. register, bind and unbind mutate; status, probe and bindings read.",
    fields: [],
    discriminator: "action",
    variants: Object.freeze({
      register: Object.freeze({
        description: "Queue registration of a project the deployment does not know and bind it to its specs repository: requires the owner role on the operator's YouTrack, a credential that reads the repository, and a project id no tenant, config entry or binding already owns. Returns a pending registration; poll status for the phase.",
        operation: "specRepoRegister",
        setupExempt: true,
        annotations: MUTATING_REMOTE_ANNOTATIONS,
        fields: Object.freeze([
          field("repoUrl", "string"),
          field("token", "string"),
          optionalField("branch", "string"),
          optionalField("username", "string"),
          optionalField("migrate", "boolean"),
        ]),
      }),
      status: Object.freeze({
        description: "Report one project's registration and binding state with the current phase and elapsed time; poll this after register, which clones the repository in the background.",
        operation: "specRepoStatus",
        setupExempt: true,
        annotations: LOCAL_READ_REMOTE_ANNOTATIONS,
        fields: Object.freeze([]),
      }),
      bind: Object.freeze({
        description: "Verify the credential against the repository, then bind the project to it (migrating an existing .specs snapshot when the project was bound elsewhere).",
        operation: "specRepoBind",
        setupExempt: true,
        annotations: MUTATING_REMOTE_ANNOTATIONS,
        fields: Object.freeze([
          field("repoUrl", "string"),
          field("token", "string"),
          optionalField("branch", "string"),
          optionalField("username", "string"),
          optionalField("migrate", "boolean"),
        ]),
      }),
      unbind: Object.freeze({
        description: "Remove the project's repository binding; the bound clone stays on disk for versioned reads.",
        operation: "specRepoUnbind",
        setupExempt: true,
        annotations: MUTATING_REMOTE_ANNOTATIONS,
        fields: Object.freeze([]),
      }),
      probe: Object.freeze({
        description: "Check that the supplied credential can read the repository, without persisting a binding.",
        setupExempt: true,
        annotations: READ_REMOTE_ANNOTATIONS,
        fields: Object.freeze([
          field("repoUrl", "string"),
          field("token", "string"),
          optionalField("username", "string"),
        ]),
      }),
      bindings: Object.freeze({
        description: "List the caller's project repository bindings; omit project to report every project in the caller's scopes.",
        listing: true,
        setupExempt: true,
        annotations: LOCAL_READ_REMOTE_ANNOTATIONS,
        fields: Object.freeze([]),
      }),
    }),
  },
]);

/** Every refusal keeps its application-service code; nothing is flattened. */
async function settled(operation, requestId, run) {
  try {
    const data = await run();
    return { envelope: serviceSuccess(operation, requestId, data) };
  } catch (error) {
    const code = typeof error?.code === "string" && error.code.length > 0 ? error.code : "REPO_OPERATION_FAILED";
    return {
      envelope: serviceErrorEnvelope(operation, requestId, code, String(error?.message ?? error), {
        retryable: error?.retryable === true || error?.status === 503,
      }),
    };
  }
}

/** Thin handlers over the existing repository application services. */
export function createRepoOps({ repos, jobs = null }) {
  return {
    specRepo: {
      listing: false,
      async run({ args, ctx, project, requestId }) {
        switch (args.action) {
          case "register":
            // The call queues the work and returns; the mirror clone runs under
            // the job, which keeps the phase current for `status` to report.
            return settled("specRepo", requestId, async () => {
              const started = await repos.registerStart({
                ctx,
                project,
                repoUrl: args.repoUrl,
                branch: args.branch,
                token: args.token,
                username: args.username,
                migrate: args.migrate,
              });
              if (started.job !== null && jobs !== null && jobs !== undefined) jobs.start(started.job);
              return started.data;
            });
          case "status":
            return settled("specRepo", requestId, async () => ({
              ...repos.registrationStatus({ project }),
              running: jobs?.isRunning?.(project) === true,
            }));
          case "bind":
            return settled("specRepo", requestId, () => repos.bind({
              ctx,
              project,
              repoUrl: args.repoUrl,
              branch: args.branch,
              token: args.token,
              username: args.username,
              migrate: args.migrate,
            }));
          case "unbind":
            return settled("specRepo", requestId, () => repos.unbind({ ctx, project }));
          case "probe":
            return settled("specRepo", requestId, () => repos.probeAccess({
              ctx,
              project,
              repoUrl: args.repoUrl,
              token: args.token,
              username: args.username,
            }));
          case "bindings":
            // Scope filtering belongs to the application service: it already
            // reports exactly the rows whose project is in ctx.scopes.
            return settled("specRepo", requestId, () => repos.bindings(ctx));
          default:
            // validateContractArguments already refused an unknown action
            // against the declared variants; reaching here is a contract bug.
            throw new Error(`spec_repo action is not handled: ${String(args.action)}`);
        }
      },
    },
  };
}
