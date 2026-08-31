# User stories

## US-1 — Manager sees the current product

**Priority:** Must

**Why:** A manager needs one current answer, not the release history as four active rows.

**Independent test:** Read the status table without opening task files; it shows one SHIPPED v0.3.2 baseline and its proof.

**Acceptance scenarios:** `SCEN-current-release-proof`.

## US-2 — User installs one product

**Priority:** Must

**Why:** Multiple product identities make discovery and support ambiguous.

**Independent test:** Inspect marketplace, package, and extension identities; exactly one is `omp-spec-kit@omp-spec-kit`.

**Acceptance scenarios:** `SCEN-one-product-identity`.

## US-3 — Release owner prevents premature claims

**Priority:** Must

**Why:** Plans and passing-looking prose must not be presented as shipped behavior.

**Independent test:** Remove the current proof from an isolated status input; the affected row is not SHIPPED.

**Acceptance scenarios:** `SCEN-missing-proof-is-not-shipped`, `SCEN-unexecuted-text-is-not-proof`.

## US-4 — Spec author gets a safe mutation path

**Priority:** Must

**Why:** Atomic authoring is unsafe if a direct writer can bypass it.

**Independent test:** Confirm two public mutation names, apply one real patch, refuse one non-allowlisted `.specs/**` write, and refuse one link escape.

**Acceptance scenarios:** `SCEN-authoring-tools-are-bounded`, `SCEN-direct-spec-write-is-refused`.

## US-5 — Contributor sees one next step

**Priority:** Should

**Why:** A short roadmap prevents internal readiness details from becoming promises.

**Independent test:** Read the roadmap; only SHIPPED, NEXT, and LATER appear, with one NEXT row and plain later outcomes.

**Acceptance scenarios:** `SCEN-roadmap-has-three-buckets`.
