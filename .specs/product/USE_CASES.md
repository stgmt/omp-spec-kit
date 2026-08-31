# Use cases

## UC-1 — Read current status

**Actor:** Product manager.

**Precondition:** The public status and bounded v0.3.2 proof are readable.

**Main flow:**
1. Open the product README.
2. Read the single SHIPPED row.
3. Follow the proof link and confirm version `0.3.2` and installed identity `omp-spec-kit@omp-spec-kit`.

**Outcome:** The manager sees the current read-only baseline without treating prior releases as separate current products.

**Trace:** `product:FR-1`, `product:AC-1.1`, `SCEN-current-release-proof`.

## UC-2 — Verify one product identity

**Actor:** OMP user.

**Main flow:** Inspect the marketplace entry, package, extension, and public mutation inventory.

**Outcome:** All surfaces belong to one installed product and no competing writer exists.

**Trace:** `product:FR-2`, `product:AC-2.1`, `SCEN-one-product-identity`.

## UC-3 — Evaluate a shipment claim

**Actor:** Release owner.

**Main flow:**
1. Select a proposed SHIPPED row.
2. Read its current proof.
3. Compare the proof's release identity with the row.
4. Refuse SHIPPED if proof is absent or mismatched.

**Outcome:** Specification text, tasks, Gherkin, and old receipts cannot promote a row.

**Trace:** `product:FR-3`, `product:AC-3.1`, `product:AC-3.2`, `SCEN-missing-proof-is-not-shipped`, `SCEN-unexecuted-text-is-not-proof`.

## UC-4 — Author through the safe path

**Actor:** Spec author.

**Main flow:**
1. Call `propose_patch`.
2. Review the proposal.
3. Call `apply_proposed_patch`.
4. Observe atomic contained application.
5. Attempt a non-allowlisted direct `.specs/**` write and observe refusal.

**Outcome:** Authoring and direct-write protection are one product outcome.

**Trace:** `product:FR-4`, `product:AC-4.1`, `product:AC-4.2`, `SCEN-authoring-tools-are-bounded`, `SCEN-direct-spec-write-is-refused`.

## UC-5 — Read the roadmap

**Actor:** Contributor.

**Main flow:** Read one SHIPPED row, one NEXT row, and the plain LATER list.

**Outcome:** The contributor knows the current product, the next safe outcome, and later ideas without internal state machinery.

**Trace:** `product:FR-5`, `product:AC-5.1`, `SCEN-roadmap-has-three-buckets`.
