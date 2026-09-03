# Migration to the single 38-tool surface (v0.8.0)

v0.8.0 deletes 11 tools with zero unique logic and all release stages. Everything below maps 1:1 to a surviving tool. The proposal engine and operation kinds are unchanged — only names moved.

## Apply verbs (identical arguments)

`apply_spec_change`, `apply_spec_transaction`, `apply_spec_repairs` → **`apply_proposed_patch`**.
Same `requestId / proposalId / proposalSha256 / expectedDocuments / reason / approval: "approve"`.
Multi-document proposals still apply in one call — `apply_spec_transaction` added nothing.

## Single-operation compilers (same fields, wrapped in operations)

`append_to_section`, `insert_after_heading`, `insert_at_eof`, `replace_in_section` →
**`propose_patch`** with `operations: [{ kind, document, ... }]` plus `repositoryRootFingerprint`, `spec`, `reason`:

```json
{
  "spec": "my-spec",
  "reason": "why",
  "repositoryRootFingerprint": "<from spec_overview>",
  "operations": [
    { "kind": "append_to_section", "document": "README.md", "heading": "Section", "text": "note" }
  ]
}
```

Available op kinds: `replace_document`, `delete_document`, `replace_task_status`,
`insert_at_eof`, `replace_section`, `insert_after_heading`, `append_to_section`,
`rename_heading`, `replace_in_section`, `rename_document`, `archive_document`.
Several operations on distinct documents go in ONE proposal (same document
twice in one proposal is rejected — split it).

## Proposal variants

- `propose_spec_change{ spec, doc, change, reason }` → `propose_patch` with
  `operations: [{ ...change, kind: change.kind ?? "replace_document", document: doc }]`
  (`replace_document` needs `content`).
- `propose_spec_repairs{ spec, reason, repairs }` → `propose_patch` with
  `operations` set to the `repairs` array.
- `propose_requirement_contract{ spec, requirement, contract, reason }` →
  `set_requirement_metadata{ spec, requirement, metadata: <contract>, reason }`.

## Queries

- `list_phase_tasks{ spec, phase, ... }` → `list_tasks{ spec, phase, ... }`
  (the `phase` filter already existed).

## Server help

Calling a removed tool returns `-32602` with a `use X instead` hint, e.g.
`Unknown tool: append_to_section (removed in v0.8.0; use propose_patch ...)`.
The review pipeline is unchanged: proposal → human review → `apply_proposed_patch`.
