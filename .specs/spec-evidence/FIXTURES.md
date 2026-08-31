# Fixtures

Executable fixtures follow the repository real-producer policy. No fixture proves delivery until its bytes and manifest are captured and reviewed.

## Required real captures

| Category | Source | Required observable |
|---|---|---|
| Cucumber Messages full run | Actual Cucumber-JS or Reqnroll invocation emitting NDJSON | FULL scope, stable join, passed/failed rows, trace |
| Second producer | Actual supported producer distinct from the first | Same normalized `ScenarioEvidence` shape |
| Filtered run | Actual runner invocation with a tag/name/path selector | Capture-derived PARTIAL; never readiness authority |
| Failed run | Actual producer failure with steps/error | Trace pages resolve the result `EvidenceRef` |
| pytest-bdd cucumber-json | Actual pytest-bdd run when that adapter is implemented | Supported secondary format normalization |

## Manifest fields

Each real fixture record SHALL include:

- fixture ID and category;
- exact capture command or documented capture method;
- producer name and version/commit;
- source path or URL;
- capture date;
- artifact SHA-256 and byte count;
- license disposition;
- permitted trimming and a statement that the trimmed bytes remain valid producer output;
- reviewed expected admission, scope, parsed rows, stable join outcomes, freshness, evidence references, task blockers, and trace outcome.

The manifest hash describes the fixture record for review convenience; it is not runtime authentication and never substitutes for re-hashing producer bytes.

## Derived negative fixtures

A derived negative starts from a named real capture and changes exactly one fact:

- corrupt one frame for malformed input;
- remove the stable ID/tag for unmatched evidence;
- plant two verified tag candidates for ambiguity;
- change scenario, applicable step, or implementation identity for staleness;
- remove one required binding for indeterminate freshness;
- exceed one byte/count limit.

Each derivative records its source fixture, exact mutation, new hash, and expected single blocker. Hand-authored positive producer payloads are forbidden.

## Synthetic fixtures

Synthetic data is allowed only for scale after semantic real fixtures pass. It SHALL be labeled `synthetic`, SHALL NOT establish parser compatibility or provenance, and SHALL state the generator and seed.

## Provenance boundary

Upstream artifacts are capture candidates only. Importing bytes requires the repository's hash, source, license, and review policy. Existing historical v0.3.2 release fixtures/receipts are preserved but do not prove this NEXT evidence capability.
