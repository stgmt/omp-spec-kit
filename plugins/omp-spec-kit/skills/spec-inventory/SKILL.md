---
name: spec-inventory
description: List the specifications in the active project with the read-only spec_catalog tool, and report entries and diagnostics as returned.
---

# Specification inventory

Call `spec_catalog` with `view: "inventory"` when the user wants to see which specifications exist in the active project.

- Use the active tool context; do not substitute the plugin directory or process working directory.
- Pass only documented fields: `specSlugs` to narrow the listing, `includeDocuments` to include document entries, `limit` to bound the page, and `cursor` to continue a previous page.
- Present the returned entries and diagnostics without upgrading them into readiness, coverage, or health claims.
- If the result is truncated, say so and offer to continue with the returned `nextCursor`, narrow the listing with `specSlugs`, or inspect a named returned spec.
- Do not reproduce the filesystem scan, follow symlinks, repair files, or write state.
