# spec-enforcement Schema

## Constants

```ts
type AuthoringToolName = "propose_patch" | "apply_proposed_patch";

const AUTHORING_TOOL_NAMES: readonly AuthoringToolName[] = [
  "propose_patch",
  "apply_proposed_patch",
];

type ResolutionClass = "SPEC" | "NON_SPEC" | "INDETERMINATE";

type DecisionCode =
  | "AUTHORING_TOOL_ALLOWED"
  | "NON_SPEC_ALLOWED"
  | "RAW_SPEC_WRITE"
  | "TARGET_INDETERMINATE";
```

The allowlist has exactly two entries. Comparison is exact and case-sensitive; no prefix, suffix, qualification, alias, or pattern match is valid.

## Input

```ts
type ToolCallPathPolicyInput = {
  toolName: string;
  projectRoot: string;
  directMutator: boolean;
  targets: readonly RawMutationTarget[];
};

type RawMutationTarget = {
  ordinal: number;
  rawPath: string;
};
```

The existing `tool_call` adapter supplies these values from the current call. A non-allowlisted direct mutator with no provable target resolves as indeterminate; it is never a vacuous allow.

## Resolution

```ts
type ResolutionCode =
  | "SPEC_ROOT"
  | "SPEC_DESCENDANT"
  | "OUTSIDE_SPEC_ROOT"
  | "INVALID_PATH"
  | "ROOT_UNAVAILABLE"
  | "ANCESTOR_UNREADABLE"
  | "LINK_UNRESOLVED"
  | "REPARSE_UNRESOLVED"
  | "REALPATH_FAILED"
  | "TARGET_CHANGED"
  | "DEADLINE_EXCEEDED";

type TargetResolution = {
  ordinal: number;
  classification: ResolutionClass;
  code: ResolutionCode;
  normalizedRepositoryPath?: string;
};
```

Resolution rules are exhaustive:

1. normalize `/` and `\` and remove dot segments;
2. anchor a relative path to the canonical project root;
3. inspect existing components with `lstat` and resolve them with `realpath`;
4. resolve POSIX symbolic links and Windows reparse points, or return `INDETERMINATE`;
5. for a new target, resolve the nearest existing ancestor and append the normalized missing suffix;
6. compare canonical components case-insensitively on Windows and case-sensitively on POSIX;
7. equality with canonical `.specs` is `SPEC_ROOT`; a child is `SPEC_DESCENDANT`; a component such as `.specs2` is `OUTSIDE_SPEC_ROOT`.

No absolute path is copied to a public result.

## Decision

```ts
type PathPolicyDecision =
  | { action: "ALLOW"; code: "AUTHORING_TOOL_ALLOWED" }
  | { action: "ALLOW"; code: "NON_SPEC_ALLOWED" }
  | { action: "BLOCK"; code: "RAW_SPEC_WRITE"; reason: string; target?: string }
  | { action: "BLOCK"; code: "TARGET_INDETERMINATE"; reason: string; target?: string };
```

Decision order is normative:

1. exact authoring name -> ALLOW `AUTHORING_TOOL_ALLOWED`;
2. non-allowlisted direct mutator with any `INDETERMINATE` target -> BLOCK `TARGET_INDETERMINATE`;
3. otherwise, any `SPEC` target -> BLOCK `RAW_SPEC_WRITE`;
4. otherwise, all targets proven `NON_SPEC` -> ALLOW `NON_SPEC_ALLOWED`.

The block reason is deterministic, at most 512 UTF-8 bytes, and follows:

```text
<CODE>: direct specification write blocked for <repo-relative-target-or-unknown>. Use propose_patch, then apply_proposed_patch.
```

It omits absolute paths, environment values, credentials, stacks, and raw operating-system errors.

## Fixture record

```ts
type PathPolicyFixtureGroundTruth = {
  toolName: string;
  rawPath: string;
  normalizedPath?: string;
  resolutionCode: ResolutionCode;
  decision: "ALLOW" | "BLOCK";
  decisionCode: DecisionCode;
};
```

## OMP authority ABI

The enforcement input is host-generated tool-call authority ABI tool-call-authority-abi@1: providerKind, registeredName, serverId, sourceToolName, inputSchemaSha256, registrySnapshotSha256, and sourcePath. It is projected from the actual registered MCP tool object. Direct writes under .specs and same-name non-MCP callers are blocked before execution.
