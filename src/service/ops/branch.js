import { serviceErrorEnvelope } from "../dispatch.js";

export const BRANCH_CONTRACTS = Object.freeze([
  {
    tool: "spec_branch",
    label: "Spec Branch",
    operation: "specBranch",
    mutating: true,
    description: "Create, merge, delete, or delete a demo spec branch.",
    fields: [
      { name: "action", kind: "enum", values: ["create", "merge", "delete", "deleteSpec"], optional: false },
      { name: "spec", kind: "string", optional: false },
      { name: "topic", kind: "string", optional: true },
      { name: "force", kind: "boolean", optional: true },
      { name: "demo", kind: "boolean", optional: true },
    ],
  },
]);

export function createBranchOps({ branches }) {
  return {
    specBranch: {
      async run({ args, project, requestId, ctx, force = false }) {
        if (!project) {
          // The dispatcher never reaches here with an unresolved project; the
          // refusal exists for direct callers and goes through the one envelope
          // builder instead of a hand-written literal.
          return {
            envelope: serviceErrorEnvelope("specBranch", requestId, "INVALID_REQUEST", "project is required", { parameter: "project" }),
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
