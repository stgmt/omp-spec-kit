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
- `groundTruth` for diagnostic mappings, definition/reference results, completion items and coordinate/severity conversion; step-verdict counts are required only when `fixtureProfile: "spec-lsp-step@1"` and are forbidden for current `spec-lsp-read@1` parity fixtures
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

## FIXTURE-2: Real omp-spec-kit corpus for adapter-to-service parity

**Type:** real authored project corpus and future real producer-output capture; not yet admitted

**Source input:** The candidate commit's actual repository `.specs/**` corpus (currently ten specs and 150 canonical documents), captured by exact git commit/tree identity. This is not the synthetic 30-spec performance benchmark.

**Producer:** The delivered kernel query service and the candidate LSP adapter, both invoked against the identical admitted corpus fingerprint.

**Intended use:** CHK-FR8-01 parity. Definition, references and diagnostics outputs from both real producer paths are normalized to `LspKernelProjectionV1`; only the schema-listed transport metadata is removed before canonical-byte comparison.

**Ground truth required:** Exact source commit/tree, corpus and kernel fingerprints, capture commands, raw kernel/LSP outputs, normalized outputs, expected definition locations/reference sets/diagnostics, independent reviewer, and every general manifest field in Policy.

**Status:** Pending implementation and real dual-producer capture. The current corpus text alone is input, not parity evidence.

## FIXTURE-3: Future kernel step-profile projection

**Type:** real cucumber-js `.feature` plus allowlisted step-definition files; future-profile capture

**Source:** captured only after `kernel-step-bindings@1` has a real producer fixture and accepted ground truth.

**Intended use:** dedicated `spec-lsp-step@1` projection parity: kernel STEP diagnostics and BINDS_STEP navigation equal LSP responses. It is not CHK-FR12-01 and uses no external cucumber language-server oracle.

**Status:** Future profile; excluded from `spec-lsp-read@1`.

## FIXTURE-4: Additional runner step sources

**Type:** future kernel step-source extension input

**Source:** a real pytest-bdd producer may be admitted only after the kernel defines a Python step-source kind and matcher contract.

**Intended use:** future kernel/profile work, never current LSP behavior or “equivalent quality” prose.

**Status:** Deferred; excluded from both current read profile and initial cucumber-js step profile.

## Synthetic fixture policy

Synthetic fixtures MAY be used only for scale testing or minimal negative variants (e.g., a `.feature` file with exactly one undefined step). They SHALL be labeled synthetic and SHALL NOT serve as primary parity or oracle evidence.

## FIXTURE-5: Synthetic scale benchmark

**Type:** synthetic benchmark only

**Source:** The deterministic 30-spec / 450-canonical-document generator defined by `spec-kernel:NFR-PERF-1`, with generator version, seed and output fingerprint recorded at capture.

**Intended use:** CHK-FR9-02 cold-build, warm-query and cancellation measurements only.

**Forbidden claims:** semantic parity, real-corpus compatibility, producer correctness, or oracle evidence.

**Status:** Pending generation and benchmark capture.
