# Spec Review: mcp-release-integrity

**Phase:** corrective post-implementation review

## Verdict

**NOT READY for public release.** The deterministic pinned OMP manager handoff is now captured and has a repeatable BDD gate; public lifecycle, upgrade, rollback, and release-asset receipts remain incomplete.

## Confirmed fixes

- Docker BDD now covers malformed raw JSON: one `-32700` response with null id, then successful recovery.
- Candidate evidence parser rejects non-NDJSON, meta-only streams, duplicate `testRunFinished`, retried-without-terminal attempts, missing chain members, and non-passing terminal steps.
- `tests/fixtures/release-candidate/cucumber-messages.ndjson` is captured real Cucumber 13.2.1 output with provenance documentation.
- Corrective Docker suite: 43 scenarios / 353 steps passed.
- Tasks and CHKs were reopened: 0 verified, 9 in progress, 2 blocked.
- The prior `omp-manager-handoff-probe@2` receipt reached `PluginManager.link` → `omp-plugins` → sole target config/source → `MCPManager.connectServers`, reported eight tools, and left the manager empty after disconnect. The strengthened `SCEN-MRI-012` now additionally requires a real manager-owned `spec_inventory` execution from project-a, exclusion of package-decoy, project-root evidence for the child fallback, and pre-enrollment manifest/launcher hash binding; it remains unverified until the targeted Docker scenario is run.
- Receipt and Cucumber message paths now reject a symlinked evidence root or parent, canonical realpath escape, non-regular file, and digest mismatch before bytes are read.
- Distribution eligibility now rejects self-authored `claims` placeholders: every required FR claim must bind a copied, digest-verified producer receipt with matching candidate/platform fixture and passed observations. No live producer provenance is present, so notes, candidate upload, and publication remain blocked.
- Public-safety BDD mutates the real package with only synthetic Authorization/Bearer, credential, cookie, PEM, and known-prefix sentinels; each is detected without disclosing its value.

## Historical interactive CLI observation

| Code | Severity | Evidence | Current interpretation |
|------|----------|----------|------------------------|
| `PINNED_OMP_MCP_DISCOVERY_MISSING` | Historical diagnostic | A fresh pinned `@oh-my-pi/pi-coding-agent@17.3.7` session listed `omp-spec-kit@0.3.1` under `/plugins list`, but `/mcp list` omitted it and `/mcp test omp-spec-kit` returned `Server "omp-spec-kit" not found.` | Retained as receipt history. The deterministic manager probe is the authoritative manager-level check because it directly performs enrollment, capability/config conversion, target-only connection, and disconnect; this does not supersede public release/lifecycle obligations. |

## Release boundary

No v0.3.1 tag, GitHub release, upgrade proof, rollback proof, or live release asset was created. The release workflow is intentionally fail-closed until those receipts exist.
