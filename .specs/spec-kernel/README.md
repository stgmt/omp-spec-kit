# Spec Kernel

## Status

The v0.3.2 eight-name MCP runtime is **SHIPPED**. This standalone one-core rewrite is **NEXT**. Speculative extensions are **LATER** or omitted.

## Product boundary

The kernel turns caller-supplied, bounded canonical spec documents into one deterministic occurrence-first graph and four internal primitives:

- `inventory` — contained document/spec inventory;
- `findNodes` — typed and filterable node lookup;
- `traverse` — bounded directed graph traversal;
- `diagnostics` — deterministic diagnostics, orphan/status/structural-validation views.

Every primitive uses one cursor/error envelope. The core owns graph semantics only. Host adapters own transport and contained source reading; editor navigation and anchors remain outside the kernel.

## Compatibility

The exact historical MCP names remain thin adapters over the core: `spec_inventory`, `spec_get_node`, `spec_find_nodes`, `spec_get_edges`, `spec_trace`, `spec_diagnostics`, `spec_overview`, and `spec_markdown_inventory`. They are the released v0.3.2 first slice, not a claim that future adapters are impossible.

Historical decoders, serializers, immutable fixture replay, dependency-absent smoke, and public receipt identity remain available for released formats only. They do not create a second runtime or change the current core fingerprint.

## Canonical documents and evidence

The allowlist is defined in [FR-2](FR.md#fr-2-canonical-documents-and-qualified-ids). Real-corpus hashes, independent oracles, and receipt references remain in [FIXTURES.md](FIXTURES.md). Implementation mapping is in [FILE_CHANGES.md](FILE_CHANGES.md).

## Current lifecycle contract

The read-complete stage adds bounded task, anchor, policy, archival, status, specification-document, and contained-attachment reads over this same graph. No second graph engine is introduced.
