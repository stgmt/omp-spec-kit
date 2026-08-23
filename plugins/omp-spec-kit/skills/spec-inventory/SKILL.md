---
name: spec-inventory
description: Use the read-only spec_inventory tool to list direct specification directories in the active OMP project.
---

# Specification inventory

Call `spec_inventory` when the user wants to discover the direct children of the active project's `.specs` directory.

- Use the active tool context; do not substitute the plugin directory or process working directory.
- Pass only request fields supported by the tool schema.
- Present the returned entries and diagnostics without upgrading them into readiness, coverage, or health claims.
- If the result is truncated, say so and suggest a lower `maxSpecs`, a higher `maxDiagnostics` within the documented cap when diagnostics were omitted, or a follow-up inspection of a named returned spec.
- Do not reproduce the filesystem scan, follow symlinks, read document contents, repair files, or write state.
