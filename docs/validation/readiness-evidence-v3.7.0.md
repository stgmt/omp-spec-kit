# Canonical readiness execution proof — 3.7.0

Captured 2026-11-16 on Windows with Node 24.17.0. This receipt covers the FR-1 L3/L4 integration and the AC-2.1 scaffold repair. It does not replace the final tagged release preflight, Linux checks, attestations or installed-package verification.

## Bound inputs

| File | SHA-256 |
| --- | --- |
| `src/evidence/service.js` | `45bdb812e33a08171454a8677fb78788093bb04aca54a8ecd357a27981c3276f` |
| `src/kernel/readiness.js` | `a14c13c0c6ff1b8add36e7e9f9251f4905e8eea4e98475b3130e0e7293cbce60` |
| `src/adapters/query-service.js` | `dc332369c603db99c5d59c9049024787fdede8aad8a8e25b4cea59bcecb63ce1` |
| `tests/helpers/readiness-e2e.mjs` | `bb5134918e41f4a5d37db1808aba12519b44a7adf46e7a922acee84763734988` |
| `scripts/verify-readiness-mutations.mjs` | `20d2a9490e4c8eba0566076a60aa722f764d3d30dfbdb92524ac23f3bed0dfa0` |
| `tests/helpers/readiness-mutation-driver.mjs` | `29a26372f6970891d757a0058b0c98e745c468a0221032181b14f1ecaf7e6b72` |

## Genuine producer evidence

Positive cases use the unchanged bytes returned by `readVerifiedCucumberFixture`: the repository-owned Docker Cucumber capture, its closed provenance receipt, producer-input manifest, every producer-input digest, aggregate, and frame counts are verified first. The final capture contains eight scenarios / 77 steps and binds 459 source inputs. No authored `passed` status or hand-authored passing message stream supplies L3.

Runtime sources are `.omp-spec-kit/evidence/last-test-run.ndjson` and `.omp-spec-kit/evidence/bdd-results/run.ndjson`; the frozen source is `tests/fixtures/release-candidate/cucumber-messages.ndjson`. Docker publishes both runtime paths only after a successful unfiltered run and message validation. Final preflight must record their hashes and require identical runtime bytes.

## Focused and real-server results

```bash
node --experimental-sqlite --test tests/readiness-gate.test.mjs tests/readiness-surface.test.mjs tests/readiness-drift.test.mjs tests/claude/archive-smoke.test.mjs
```

44 passed; zero failures, cancellations or skips. This includes the actual default and safe-authoring archive smoke, not archive inventory alone.

```bash
npm run test:tool-e2e
```

57 scenarios / 342 steps passed. `SCEN-readiness-execution-proof` performs real JSON-RPC initialization, inventory and calls. The reusable matrix runs the same proof against the extracted archive. Inspection and preview agree on L3 before a task and L4 after an admitted, traced task; snapshots prove that inspection and preview do not write project bytes.

Eleven copied-state negative cases exercise unsuccessful runs, wrong run identity, retry-only completion, missing pickle, missing step, malformed messages, wrong captured source, stale explicit binding, changed corpus source, a junctioned evidence directory and an individually symlinked capture. Both escape cases require `spec_evidence` to report `NOT_RUN` without a source hash and readiness to stay at L2; outside bytes remain unchanged. The identical capture placed inside the project is the passing positive control. Evidence-only updates are observed without restarting the server and preserve the document graph fingerprint. Closed-schema and absent-specification errors are checked. Cleanup restores both project bytes and the long-lived server's document snapshot before subsequent matrix phases.

AC-2.1 additionally checks that a scaffold reports missing requirements, criteria and design in level order, and that the entire ordered fix list replays without defining the first requirement twice.

## Code mutation proof

```bash
npm run check:readiness-mutations
```

The repository-owned runner first verifies a pristine copied-project baseline. Four async mutant workers then each use their own copied tracked tree; only read-only dependencies are shared. The real capture is authenticated against pristine inputs **before** deliberately mutating the implementation under test. Neither capture bytes nor their provenance/manifest are rewritten to bless a mutant. Tracked inputs are checked again after each run against exactly the intended mutation.

| Removed guard | Expected deciding leaf | Result |
| --- | --- | --- |
| Successful `testRunFinished` required | unsuccessful producer run cannot prove L3 | KILLED, `ERR_ASSERTION`, exit 1 |
| Captured source must identify the corpus feature | different executed source cannot prove L3 | KILLED, `ERR_ASSERTION`, exit 1 |
| Capture must be well formed | malformed producer capture cannot prove L3 | KILLED, `ERR_ASSERTION`, exit 1 |
| Evidence realpath must remain inside the project | escaped evidence directory cannot prove project execution | KILLED, `ERR_ASSERTION`, exit 1 |

Baseline: five leaf tests passed. Each mutant executed all five leaf tests with zero cancellations/skips. Four of four killed; zero survivors; no infrastructure or cleanup failures. Timeouts, missing imports, syntax/spawn failures, stale producer inputs and cleanup errors cannot count as kills. Per-case receipts are saved immediately under ignored operator logs; Windows cleanup retries are mandatory. The gate is part of `npm run verify` and therefore the full release preflight.
