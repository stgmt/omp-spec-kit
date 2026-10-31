export const BRANCH_CONTRACTS = Object.freeze([
  {
    tool: "spec_branch",
    label: "Spec Branch",
    operation: "specBranch",
    description: "Create, merge, or delete spec branches.",
    fields: [
      { name: "action", kind: "enum", values: ["create", "merge", "delete", "deleteSpec"], optional: false },
      { name: "spec", kind: "string", optional: false },
      { name: "topic", kind: "string", optional: true },
      { name: "force", kind: "boolean", optional: true },
    ],
  },
]);

export function createBranchOps({ branches }) {
  return {
    specBranch: {
      async run({ args, project, requestId, ctx, force = false }) {
        if (!project) {
          return {
            envelope: {
              schemaVersion: "spec-kernel@2",
              requestId: requestId ?? null,
              operation: "specBranch",
              ok: false,
              graph: null,
              page: null,
              data: null,
              error: { code: "INVALID_REQUEST", message: "project is required", parameter: "project", retryable: false },
              diagnostics: [],
              provenance: null,
            },
          };
        }
        const envelope = await branches.run({
          args,
          project,
          requestId,
          login: ctx?.identity?.login ?? null,
          // `force` is a transport field: the dispatcher strips it from `args`
          // and passes it beside them. Reading `args.force` here silently
          // disabled owner force-delete.
          force: force === true,
          role: ctx?.role ?? null,
        });
        return { envelope };
      },
    },
  };
}
