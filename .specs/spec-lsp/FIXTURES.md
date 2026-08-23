# Fixtures

## Policy

No executable target fixture is claimed present or passing in this specification-only state. The pinned upstream files and OMP documentation references below are real provenance references and capture candidates, not admitted target test fixtures. Fixture admission requires a complete fixture manifest, exact bytes, reviewed ground truth, and the remaining adapter evidence per `spec-kernel:FR-11` posture.

A real fixture manifest SHALL record all of:

- `fixtureId`
- `fixtureType: real`
- `producerName`
- `producerVersionOrCommit`
- `captureCommandOrMethod`
- `captureDate`
- `sourcePathOrUrl`
- `sourceSha256`
- `storedRelativePath`
- `storedSha256`
- `byteCount`
- `licenseDisposition`
- `trimmed` and exact `trimProcedure`
- `groundTruthReviewer`
- `groundTruth` counts for step verdicts (defined/undefined/ambiguous), diagnostic mappings, definition/reference results, and completion items
- `allowedClaims`
- `forbiddenClaims`

A stored fixture is immutable. A byte change requires a new fixture ID or explicit version plus reviewed ground truth. "Copied from a test" without producer/source identity is not provenance.

## FIXTURE-1: Pinned upstream spec-generator-v4 feature reference

**Type:** real source document, research-only; not admitted executable fixture

**Source:** `.specs/spec-generator-v4/spec-generator-v4.feature` at dev-pomogator commit `158cd5ccfe4d08625734fc1692d8916cc5838fd6`

**Pinned target path:** `docs/upstream/dev-pomogator/spec-generator-v4/spec-generator-v4.feature`

**SHA-256:** `3d7757d3b9fd179928d43253f7ea69227aaaaafdc7da2dae757d0da8cb775c96`

**Manifest evidence:** `IMPORT_MANIFEST.yaml`

**License disposition:** MIT source-owner attested; research reference only, not admitted as an executable fixture

**Allowed claims:** The source contained Gherkin scenarios with step definitions as provenance for step-layer design.

**Forbidden claims:** Step-verdict parity, executable-fixture admission by license alone, or passing behavior.

## FIXTURE-2: Shared kernel corpus for adapter-to-service parity

**Type:** real producer corpus, capture candidate; not yet admitted

**Source:** The `spec-kernel` reference benchmark corpus (30 specs, 450 canonical documents) defined in `spec-kernel:NFR-PERF-1`.

**Intended use:** CHK-FR8-01 parity harness input. Both the LSP adapter and kernel query service are queried on this corpus; responses must match byte-for-byte on the declared fingerprint.

**Ground truth required:** Expected definition locations, reference sets, and diagnostic findings per document, reviewed against kernel query service output.

**Status:** Pending capture and provenance recording.

## FIXTURE-3: Cucumber-runner step-binding fixtures for oracle parity

**Type:** real producer `.feature` + step-definition files, capture candidate; not yet admitted

**Source:** To be captured from a real cucumber-runner project with known step bindings.

**Intended use:** CHK-FR12-01 oracle parity harness input. Both the custom server and `@cucumber/language-server` oracle produce step verdicts on these fixtures; verdicts must match.

**Ground truth required:** Per-step-line expected verdict (defined/undefined/ambiguous) with matching step-definition expression or absence reason.

**Status:** Pending producer identification, capture, and provenance recording.

## FIXTURE-4: pytest-bdd step-binding fixtures

**Type:** real producer `.feature` + Python step-definition files, capture candidate; not yet admitted

**Source:** To be captured from a real pytest-bdd project with known step bindings.

**Intended use:** Verify that step diagnostics for pytest-bdd files are served without silence and with equivalent quality to cucumber-runner fixtures.

**Ground truth required:** Per-step-line expected verdict with matching Python step decorator or absence reason.

**Status:** Pending producer identification, capture, and provenance recording.

## Synthetic fixture policy

Synthetic fixtures MAY be used only for scale testing or minimal negative variants (e.g., a `.feature` file with exactly one undefined step). They SHALL be labeled synthetic and SHALL NOT serve as primary parity or oracle evidence.
