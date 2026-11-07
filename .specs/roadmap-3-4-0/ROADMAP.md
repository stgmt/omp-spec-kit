# Release 3.4.0

> **Profile: roadmap** — human-facing convention; the kernel identifies this spec by the `roadmap-` slug prefix.

## Authored narrative

Issue #51 is the brief and the record; this specification is the release. Four waves, in the order that unblocks the next one, plus the hygiene items the issue lists as defects rather than capabilities.

Registration comes first and is not optional: the registry stays the authority, and the tool gains the path from an unknown project to a registered one instead of a refusal with no exit. The bundle comes second because unbatched edits are what produced duplicate headings. Decisions come third because a contradiction costs a wrong implementation. Verification closes the loop, so completion stops being a claim.

## Auto-assembled items

<!-- roadmap:auto:start -->
### roadmap-3-4-0
- [planned] FR-1 — Phase 1 — the registration path exists (FR)
- [planned] FR-2 — Phase 2 — one bundle, one diff (FR)
- [planned] FR-3 — Phase 3 — decisions and open questions (FR)
- [planned] FR-4 — Phase 4 — executable verification (FR)
- [planned] FR-5 — Phase 5 — release hygiene from issue #51 (FR)
- [planned] FR-6 — Phase 5b — later waves declared and gated (FR)

### spec-decision-drift
- [planned] FR-1 — Open questions as entities (FR)
- [planned] FR-2 — Structured decision metadata (FR)
- [planned] FR-3 — Decision drift diagnostic (FR)
- [planned] FR-4 — Open questions block work (FR)
- [planned] FR-5 — Superseded decisions (FR)

### spec-patch-bundle
- [planned] FR-1 — Unified diff with hunks and context (FR)
- [planned] FR-2 — Section-end append and keyed bullet upsert (FR)
- [planned] FR-3 — Ordered operations on one document (FR)
- [planned] FR-4 — Explicit preview truncation and size report (FR)
- [planned] FR-5 — Create a specification with authored documents (FR)

### spec-project-registration
- [planned] FR-1 — An unknown project is diagnosed, not merely denied (FR)
- [planned] FR-2 — Registration an authorized principal can drive (FR)
- [planned] FR-3 — First specification bootstrap (FR)
- [planned] FR-4 — Credential diagnosis names the repair (FR)
- [planned] FR-5 — No registry-less fallback (FR)

### spec-verify-runner
- [planned] FR-1 — Executable task checks (FR)
- [planned] FR-2 — Run under an allowlist and a timeout (FR)
- [planned] FR-3 — Evidence records (FR)
- [planned] FR-4 — Completion requires a fresh green run (FR)
- [planned] FR-5 — Spend authorization (FR)
- [planned] FR-6 — External result writers and last-green answers (FR)
<!-- roadmap:auto:end -->

## Out of scope

- A registry-less local mode, in any form. An unregistered project is refused by design.
- The registry service's own hosting model and the tracker projection.
- The coverage matrix and the zone guard as shipped capabilities; they are declared in phase 5 and get their own specifications in the next release.
