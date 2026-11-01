import { serviceErrorEnvelope, serviceSuccess } from "../dispatch.js";

const MUTATING_VARIANT_ANNOTATIONS = Object.freeze({
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
});

const READ_VARIANT_ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
});

const LOCAL_READ_VARIANT_ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

function field(name, kind) {
  return { name, kind };
}

function optionalField(name, kind) {
  return { name, kind, optional: true };
}

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
    description: "Bind, unbind, probe, or list the specs repository of a project. bind and unbind mutate; probe and bindings read.",
    fields: [],
    discriminator: "action",
    variants: Object.freeze({
      bind: Object.freeze({
        description: "Verify the credential against the repository, then bind the project to it (migrating an existing .specs snapshot when the project was bound elsewhere).",
        operation: "specRepoBind",
        setupExempt: true,
        annotations: MUTATING_VARIANT_ANNOTATIONS,
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
        annotations: MUTATING_VARIANT_ANNOTATIONS,
        fields: Object.freeze([]),
      }),
      probe: Object.freeze({
        description: "Check that the supplied credential can read the repository, without persisting a binding.",
        setupExempt: true,
        annotations: READ_VARIANT_ANNOTATIONS,
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
        annotations: LOCAL_READ_VARIANT_ANNOTATIONS,
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
export function createRepoOps({ repos }) {
  return {
    specRepo: {
      listing: false,
      async run({ args, ctx, project, requestId }) {
        switch (args.action) {
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
