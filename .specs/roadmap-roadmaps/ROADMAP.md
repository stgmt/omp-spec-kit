# Roadmap: Roadmap Specs

> **Profile: roadmap** — human-facing convention; the kernel identifies this
> spec by the `roadmap-` slug prefix.

This roadmap tracks the implementation of canonical ROADMAP.md support and
governed auto-assembly for roadmap specs.

## Authored narrative

The roadmap spec itself is the first consumer of the canonical ROADMAP.md
document kind. The generated region below is assembled from the graph
entities of the scope implied by this spec's own `Implements:` and `Refs:`
links — no explicit `Covers:` declaration is needed.

## Auto-assembled items

<!-- roadmap:auto:start -->
<!-- roadmap:auto:end -->

## Notes

Reassembly merges by canonical ID and never touches authored bytes outside
the `roadmap:auto` markers. When the graph is unchanged, the generated
region is byte-for-byte identical (idempotent).
