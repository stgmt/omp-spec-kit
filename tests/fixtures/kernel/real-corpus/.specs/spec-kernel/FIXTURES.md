# Fixtures

## Policy

No executable target fixture is claimed present or passing in this specification-only state. The pinned upstream files below are real provenance references and capture candidates, not admitted target test fixtures. `IMPORT_MANIFEST.yaml` records `MIT_ATTESTED_SOURCE_OWNER` for the copied snapshot; fixture admission still requires a complete fixture manifest, exact bytes, reviewed ground truth, and the remaining kernel evidence.

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
- `groundTruth` counts for documents, definition occurrences, unique nodes, ambiguous occurrences, rejected definitions, reference occurrences, resolved edges, unresolved references, and diagnostics by code/severity
- `allowedClaims`
- `forbiddenClaims`

A stored fixture is immutable. A byte change requires a new fixture ID or explicit version plus reviewed ground truth. “Copied from a test” without producer/source identity is not provenance.

## FIXTURE-1: Pinned upstream graph-schema reference

**Type:** real source document, research-only; not admitted executable fixture

**Source:** `.specs/spec-generator-v4/spec-generator-v4_SCHEMA.md` at dev-pomogator commit `158cd5ccfe4d08625734fc1692d8916cc5838fd6`

**Pinned target path:** `docs/upstream/dev-pomogator/spec-generator-v4/spec-generator-v4_SCHEMA.md`

**SHA-256:** `44d233d6f2db1c36f500f58d16f8b52cab39ec000ffafe4460dc62581183cedb`

**Manifest evidence:** `IMPORT_MANIFEST.yaml`

**License disposition:** MIT source-owner attested; research reference only, not admitted as an executable fixture

**Allowed claims:** The source described an historical in-memory graph and query shapes.

**Forbidden claims:** Target schema compatibility, parser parity, executable-fixture admission by license alone, or passing behavior.

## FIXTURE-2: Pinned upstream feature reference

**Type:** real source document, research-only; not admitted executable fixture

**Source:** `.specs/spec-generator-v4/spec-generator-v4.feature` at dev-pomogator commit `158cd5ccfe4d08625734fc1692d8916cc5838fd6`

**Pinned target path:** `docs/upstream/dev-pomogator/spec-generator-v4/spec-generator-v4.feature`

**SHA-256:** `3d7757d3b9fd179928d43253f7ea69227aaaaafdc7da2dae757d0da8cb775c96`

**Manifest evidence:** `IMPORT_MANIFEST.yaml`

**License disposition:** MIT source-owner attested; research reference only, not admitted as an executable fixture

**Allowed claims:** The bytes demonstrate real historical Gherkin shapes and can inform target capture selection.

**Forbidden claims:** Any scenario execution result, target support for every historical construct, or executable fixture admission.

## FIXTURE-3: Pinned upstream requirements reference

**Type:** real source document, research-only; not admitted executable fixture

**Source:** `.specs/spec-generator-v4/FR.md` at dev-pomogator commit `158cd5ccfe4d08625734fc1692d8916cc5838fd6`

**Pinned target path:** `docs/upstream/dev-pomogator/spec-generator-v4/FR.md`

**SHA-256:** `cbcd2a59b1e1aefd121ab61b5590c3c77c29059e8f281607ae89281eb70f6ce2`

**Manifest evidence:** `IMPORT_MANIFEST.yaml`

**License disposition:** MIT source-owner attested; research reference only, not admitted as an executable fixture

**Allowed claims:** The bytes are a real large Markdown capture candidate and provenance input to the migration matrix.

**Forbidden claims:** Target heading compatibility, imported product authority, or executable fixture admission.

## FIXTURE-4: Pinned upstream fixture-inventory reference

**Type:** real source document, research-only; not admitted executable fixture

**Source:** `.specs/spec-generator-v4/FIXTURES.md` at dev-pomogator commit `158cd5ccfe4d08625734fc1692d8916cc5838fd6`

**Pinned target path:** `docs/upstream/dev-pomogator/spec-generator-v4/FIXTURES.md`

**SHA-256:** `49bcfaee155fb27ecc62526ee49f62922eb1828e3f8464ed829966f830638007`

**Manifest evidence:** `IMPORT_MANIFEST.yaml`

**License disposition:** MIT source-owner attested; research reference only, not admitted as an executable fixture

**Allowed claims:** The source documents prior use of real-world, error-case, NDJSON, and generated benchmark fixture categories.

**Forbidden claims:** That the referenced historical fixture paths exist in this repository or are target fixtures.

## FIXTURE-5: Target-owned canonical spec capture

**Type:** planned real fixture

**Future path:** `plugins/omp-spec-kit/test/fixtures/real/target-spec-corpus/`

**Capture method:** Copy exact committed bytes from the target-owned `product`, `plugin-distribution`, `spec-kernel`, and `spec-authoring-workflow` corpus at a recorded omp-spec-kit commit after its license is established; record commit/path and per-file hashes before any trimming. The captured FR, AC, and TASK documents SHALL retain the authored forms rather than rewriting them to one separator.

**Required definition grammar ground truth:**

| Owning document | Positive forms present across the capture | Required negative controls |
|---|---|---|
| `FR.md` | level-2 `FR-N: title` and `FR-N — title` | bare/wrong-level/other-separator FR, plus every FR grouping heading in `ACCEPTANCE_CRITERIA.md`, yields no FR definition |
| `ACCEPTANCE_CRITERIA.md` | level-2/3 `AC-N.M: title`, `AC-N.M — title`, and bare exact `AC-N.M` | suffix prose after a bare ID, other separators, and AC IDs outside the AC document yield no AC definition |
| `TASKS.md` | level-2 `TASK-N: title` and `TASK-N — title` | bare/wrong-level/other-separator TASK and task IDs in matrices/prose yield no TASK definition |

The reviewer SHALL enumerate every current FR, AC, and TASK ID per owning document and assert one definition occurrence for each, zero definition occurrences for grouping/reference headings, and the closed task-status results `Planned` → `planned`, `todo` → `todo`, and `Completed` → `done`.

**Required inventory ground truth:** All canonical documents present in the capture; every definition/reference occurrence and unique/ambiguous/rejected/edge outcome; every ordinary-or-ID ATX/Setext heading with `glfm-anchor@1` base/canonical anchor and selected duplicate ordinal; adversarial rendered-heading vectors `Foo`/`Foo`/`Foo-1` → `foo`/`foo-1`/`foo-1-1`, `Foo-1`/`Foo`/`Foo` → `foo-1`/`foo`/`foo-2`, and `Foo`/`Foo-1`/`Foo` → `foo`/`foo-1`/`foo-2`; pairwise uniqueness against the complete previously emitted anchor set; every inline/reference/autolink semantic use, destination rewrite span/key, enclosing heading, and internal-heading/internal-document/external/unresolved outcome; and all diagnostic/count conservation reconciled by an independent reviewer.

**Allowed claims after admission:** The v0.2 parser handles the exact captured target format, heading/link inventory, and reconciled counts.

**Forbidden claims:** All Markdown/Gherkin compatibility, upstream parity, or scenario pass status.

## FIXTURE-6: Target-owned Gherkin parser capture

**Type:** planned real fixture

**Future path:** `plugins/omp-spec-kit/test/fixtures/real/target-spec-corpus/.specs/sample/sample.feature`

**Capture method:** Exact committed target feature bytes, including Feature, Background, Scenario, Scenario Outline, Examples, explicit `@id`, `@featureN`, and `@AC-N.M` tags.

**Required ground truth:** Scenario declaration count, tag/reference count, step count, example header/row count, generated Scenario IDs, resolved/unresolved outcomes, and expected diagnostics.

**Forbidden claims:** Cucumber execution results; the fixture exercises authored parsing only.

## FIXTURE-7: Generated 30-spec benchmark

**Type:** planned synthetic scale fixture

**Future path:** `plugins/omp-spec-kit/test/fixtures/generated/benchmark-30-specs.json`

**Generator contract:** A versioned deterministic generator with recorded seed SHALL produce exactly 30 specs, 450 canonical documents, 6,000 definitions, 18,000 domain references, 7,500 Markdown headings, 24,000 semantic Markdown link occurrences, and 10 MiB total UTF-8 bytes. The generated corpus is synthetic and is not used to prove real parser-shape fidelity.

**Ground truth:** Generator-derived counts plus an independently reconciled parser count; both must agree before performance results are accepted.

## FIXTURE-8: Aggregate release-evidence variants

**Type:** planned synthetic stage-profile contract fixture derived from admitted real artifact/fixture/benchmark evidence sets

**Future path:** `plugins/omp-spec-kit/test/release/evidence/`

**Generator contract:** Create two hash-valid `kernel-release-evidence@1` bases. The v0.2 base SHALL declare `targetStage=v0.2`, `evidenceProfile=kernel-v0.2`, and exactly one passing record for FR-1..FR-8 and FR-10..FR-13 checks, with no FR-9 or MCP evidence; its `CHK-FR10-01` record SHALL declare `packageSurface=OMP_EXTENSION_ONLY` and bind the dependency-absent extension smoke to the exact v0.2 artifact. The v0.3 base SHALL declare `targetStage=v0.3`, `evidenceProfile=kernel-v0.3`, contain exactly one passing record for the complete v0.2 check set plus FR-9, bind fresh MCP-inclusive FR-10 and FR-12 evidence, and embed the complete re-evaluable v0.2 base as its declared parent artifact; its `CHK-FR10-01` record SHALL declare `packageSurface=OMP_EXTENSION_AND_MCP` and bind extension plus server execution to the exact v0.3 artifact.

From those bases, generate deterministic one-fault-at-a-time variants for unknown/missing/mismatched stage/profile, wrong release line, v0.2 with FR-9, v0.2 with MCP-inclusive package surface, v0.3 without FR-9, v0.3 with extension-only package surface, missing/non-eligible/cross-lineage v0.2 parent, cross-stage record reuse, missing, extra, duplicate, failed, stale, mismatched, waived, partial, unverifiable, empty-evidence, bad-evidence-hash, artifact-binding, corpus-binding, and package/fixture/budget gate-binding failures. Record both base manifest SHA-256 values, the accepted v0.2 evidence fingerprint, and each variant transformation.

**Ground truth:** The v0.2 base yields `eligible=true` after the dependency-absent extension smoke and before any MCP implementation exists. The v0.3 base yields `eligible=true` only with its same-lineage accepted v0.2 input and fresh evidence that both extension and MCP server execute from the exact v0.3 artifact. Every variant yields `eligible=false` with the exact ordered blocker code/check ID declared by `spec-kernel_SCHEMA.md`; in particular, `CHK-FR10-01` retains one ID but rejects the other profile’s `packageSurface`, v0.2 FR-9/MCP evidence is rejected rather than ignored, and v0.3 cannot pass with a v0.2-only package or budget record. These synthetic variants prove evaluator logic only and do not replace the underlying real package, fixture, benchmark, or review evidence.

## Admission and conservation procedure

1. Verify producer/source identity and license disposition.
2. Capture exact bytes and compute source SHA-256 and byte count.
3. If trimming is necessary, keep syntax producer-valid, document every removed range, and hash stored bytes separately.
4. Have a reviewer who did not author the parser enumerate ground truth.
5. Parse the fixture and reconcile:
   - `definitions = unique + ambiguous + rejected`;
   - `references = resolved + unresolved`;
   - `headings = headingOccurrences`;
   - `markdownLinks = internalHeading + internalDocument + external + unresolved`;
   - `documents = accepted + rejected`.
6. Refuse admission on hash, count, license, or provenance mismatch.
7. Record only the narrowly allowed contract claim; never label these Gherkin scenarios passing without separate runner evidence.
