# spec-mcp-access-gate Schema

## Constants

```ts
type AuthoringToolName = "spec_patch";

const AUTHORING_TOOL_NAMES: readonly AuthoringToolName[] = [
  "spec_patch",
];

type ResolutionClass = "SPEC" | "NON_SPEC" | "INDETERMINATE";

type DecisionCode =
  | "AUTHORING_TOOL_ALLOWED"
  | "MCP_OPERATION_ALLOWED"
  | "UNREGISTERED_AUTHORING_CALL"
  | "NON_SPEC_ALLOWED"
  | "RAW_SPEC_WRITE"
  | "TARGET_INDETERMINATE";

```

The allowlist has exactly one entry. Comparison is exact and case-sensitive; no prefix, suffix, qualification, alias, or pattern match is valid.

## Input

```ts
type McpAuthority = {
  kind: "registered-mcp";
  providerKind: "mcp";
  serverId: string;
  registeredName: string;
  sourceToolName: string;
  inputSchemaSha256: string;
  registrySnapshotSha256: string;
  sourcePath: string;
};

type ToolCallPathPolicyInput = {
  toolName: string;
  projectRoot: string;
  directMutator: boolean;
  authority: McpAuthority | null;
  targets: readonly RawMutationTarget[];
};

type ResolutionCode =
  | "SPEC_ROOT"
  | "SPEC_DESCENDANT"
  | "OUTSIDE_SPEC_ROOT"
  | "INVALID_PATH"
  | "ABSOLUTE_PATH"
  | "UNC_OR_DEVICE_PATH"
  | "ADS_PATH"
  | "NUL_PATH"
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

1. reject a raw path containing NUL, an alternate-data-stream suffix, a UNC/device prefix, or an absolute path as INDETERMINATE with the corresponding special-path code;
2. normalize separators and remove dot segments;
3. anchor a relative path to the canonical project root;
4. inspect existing components with lstat and resolve them with realpath;
5. resolve POSIX symbolic links and Windows reparse points, or return INDETERMINATE;
6. for a new target, resolve the nearest existing ancestor and append the normalized missing suffix;
7. compare canonical components case-insensitively on Windows and case-sensitively on POSIX;
8. equality with canonical .specs is SPEC_ROOT; a child is SPEC_DESCENDANT; a component such as .specs2 is OUTSIDE_SPEC_ROOT;
9. an empty target list, unsupported metadata, unresolved links, deadline, or exception is INDETERMINATE.

No absolute path is copied to a public result.

## Decision

```ts
type PathPolicyDecision =
  | { action: "ALLOW"; code: "AUTHORING_TOOL_ALLOWED" }
  | { action: "ALLOW"; code: "MCP_OPERATION_ALLOWED" }
  | { action: "ALLOW"; code: "NON_SPEC_ALLOWED" }
  | { action: "BLOCK"; code: "UNREGISTERED_AUTHORING_CALL"; reason: string }
  | { action: "BLOCK"; code: "RAW_SPEC_WRITE"; reason: string; target?: string }
  | { action: "BLOCK"; code: "TARGET_INDETERMINATE"; reason: string; target?: string };

Decision order is normative:

1. valid registered MCP authority plus exact authoring name -> ALLOW AUTHORING_TOOL_ALLOWED;
2. valid registered MCP authority plus any other registered omp-spec-kit operation -> ALLOW MCP_OPERATION_ALLOWED;
3. exact authoring name without valid registered authority -> BLOCK UNREGISTERED_AUTHORING_CALL;
4. non-allowlisted direct mutator with an empty or indeterminate target -> BLOCK TARGET_INDETERMINATE;
5. otherwise, any SPEC target -> BLOCK RAW_SPEC_WRITE;
6. otherwise, all targets proven NON_SPEC -> ALLOW NON_SPEC_ALLOWED.

The block reason is deterministic, at most 512 UTF-8 bytes, and follows:

```text
<CODE>: direct specification write blocked for <repo-relative-target-or-unknown>. Use spec_patch.
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

The authority field is host-generated from the actual registered MCP tool object. registeredName MUST be a member of the installed omp-spec-kit registry, sourceToolName MUST equal the hook-visible name, and all hashes and source identity fields MUST be present. Missing, malformed, or mismatched authority is non-MCP and cannot receive an allow code.

## OMP access-gate target classes

The gate recognizes MCP-authorized operations, non-MCP targets proven outside canonical .specs, canonical .specs targets, and indeterminate targets. Indeterminate includes unsupported or unavailable target extraction and always blocks.


## Decision code extension

- `SPEC_READ_REDIRECT` is a blocked decision for direct `read`, `grep`, and `glob` calls whose explicit path target is inside `.specs`.
- `RAW_SPEC_WRITE` remains the decision for mutators and recursive `code`/`command` references.
- Recovery text is bounded to 512 UTF-8 bytes and contains no absolute path.
