# Fixture Contract

The v0.3.2 producer suite is delivered. Fixture presence is not execution evidence; only current producer receipts and the independent attestation over their exact evidence subject support distribution eligibility.

## Provenance requirements

Every committed or captured fixture records producer/source, immutable version/commit, capture command, retained-byte SHA-256/counts, trimming rationale, expected ground truth, license disposition and safety review. Synthetic variants are labeled and derive from a real admitted base. Real OMP/Cucumber output is never reconstructed from memory.

## Delivered fixture and producer matrix

| Surface | Current path / producer | Ground truth |
|---|---|---|
| Pinned Docker runtime | `tests/distribution/Dockerfile` | Digest-pinned Node/Bun plus OMP v17.3.7; no user credentials/state. |
| Distribution behavior | `tests/features/plugin-distribution.feature`, `tests/step-definitions/plugin-distribution.steps.mjs` | Real package/topology/inventory/dependency/negative decisions. |
| Lifecycle behavior | `tests/features/lifecycle-producers.feature`, `tests/step-definitions/lifecycle-producers.steps.mjs` | Install/reload/fresh session/uninstall/reinstall and real v0.3.0↔v0.3.2 upgrade/rollback observations. |
| Candidate world | `tests/helpers/release-candidate-world.mjs` | Exact candidate/digest/evidence identities and one-fault mutations. |
| Real Cucumber messages | `tests/fixtures/release-candidate/cucumber-messages.ndjson` plus provenance JSON | Real full Docker Cucumber stream; scenario/step counts and required passing scenario chains reconcile. |
| Frozen real corpus | `tests/fixtures/kernel/real-corpus/` plus manifest | Byte/hash/count ground truth independent of mutable `.specs`. |
| Pinned OMP discovery | `tests/fixtures/omp-discovery-runtime/`, `tests/helpers/omp-discovery-world.mjs` | Target-only manager connection and active-project query. |
| Distribution evidence subject | `create-distribution-evidence.mjs` output in `distribution-evidence.yml` | Complete FR-1..FR-12 content-addressed matrix for one candidate/platform/applicability profile. |
| Public safety | candidate `public-safety.json`/release evidence asset | Provenance/license/secret/state/path/package violations block without leaking sentinel values. |
| Generated negative variants | disposable temp roots derived by step definitions | Missing/non-directory/excess/unreadable/link escape, duplicate topology, malformed requests, identity/trust/receipt faults each change one observable dimension. |

## Isolation contract

The producer SHALL:

- pin OMP/runtime/container identities;
- use disposable project and OMP user roots without host plugins, credentials, caches or marketplace state;
- observe zero inventory writes/network/process/model/credential access;
- hide source checkout/root/external `node_modules` for installed dependency proof;
- install the exact candidate by digest;
- use separate pre-install/reload/fresh sessions;
- hash non-OMP-managed project files before/after every lifecycle transition;
- use real public predecessor bytes after the first release;
- clean only roots it created.

## Evidence distinction

Spec Gherkin and executable feature files state behavior; skipped/pending/undefined scenarios and parser reports are not passing evidence. Each distribution claim binds one regular canonical-contained `omp-spec-kit-distribution-producer-receipt@1` through `omp-spec-kit-distribution-evidence@1`. Self-authored producer fields remain diagnostic. Forward eligibility additionally requires a verifier-passing GitHub Artifact Attestation over the exact matrix subject under the fixed repository/workflow/tag trust tuple.
