export const BRANCH_CONTRACTS = Object.freeze([
  {
    tool: "spec_branch",
    label: "Spec Branch",
    operation: "specBranch",
    description: "Create, merge, or delete spec branches.",
    fields: [
      { name: "action", type: "string", required: true, enum: ["create", "merge", "delete"] },
      { name: "spec", type: "string", required: true },
      { name: "topic", type: "string", required: false },
    ],
  },
]);

export function createBranchOps({ branches }) {
  return {
    specBranch: {
      async run({ args, project, requestId, ctx }) {
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
        const envelope = await branches.run({ args, project, requestId, login: ctx?.identity?.login ?? null });
        return { envelope };
      },
    },
  };
}
