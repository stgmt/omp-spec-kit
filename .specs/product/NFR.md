# Non-functional requirements

## NFR-SECURITY-1 — Contained writes

Direct-write protection for `.specs/**` SHALL use canonical repository containment, real-path/link/reparse checks, and repository-relative diagnostics. Unknown or unresolved targets SHALL fail closed when they may reach `.specs/**`.

**Traces:** `product:FR-4`, `product:AC-4.2`.

## NFR-PROVENANCE-1 — Release proof provenance

A SHIPPED claim SHALL cite a bounded record captured from the real release producer. The record SHALL identify the released version and artifact without copying release assets into the specification.

**Traces:** `product:FR-1`, `product:FR-3`.

## NFR-RELIABILITY-1 — Conservative status

A missing, unreadable, stale, or mismatched current proof SHALL never produce SHIPPED. Status evaluation SHALL be deterministic for the same roadmap and proof inputs.

**Traces:** `product:FR-3`.

## NFR-USABILITY-1 — Manager-readable roadmap

A reader SHALL answer what is shipped, what is next, and what is later from one short table and list without learning implementation-specific states.

**Traces:** `product:FR-1`, `product:FR-4`, `product:FR-5`.

## NFR-MAINTAINABILITY-1 — Single ownership boundary

Product documents SHALL state externally visible outcomes and SHALL link detailed owner contracts instead of copying their internal checks. Task status SHALL exist only in canonical task blocks, not in a second hand-maintained summary.

**Traces:** `product:FR-2`, `product:FR-4`, `product:FR-5`.
