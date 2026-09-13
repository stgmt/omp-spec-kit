# Changelog

## 2026-09-10 — adapter contract correction

- Replaced the implicit direct-kernel sync design with explicit ports, pure translators, and infrastructure adapters.
- Defined one complete MCP spec_graph board projection without adding an eleventh tool.
- Defined last-complete snapshot visibility, read-only parity before skip, and same-fingerprint drift repair.
- Unified the panel and V1 Flow, V2 Cluster, and V3 Lineage board views on one committed snapshot.
- Superseded the old live-issue-link board path, the fingerprint-only skip, and the three-link schema.

## Historical notes

Earlier drafts described board.json as a separately derived file, a live REST issue graph, and a CLI upload path. Those descriptions are superseded by DESIGN.md and REQUIREMENTS.md. They remain history only and are not implementation contracts.
