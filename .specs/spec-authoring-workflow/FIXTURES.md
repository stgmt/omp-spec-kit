# Fixtures

## Status

Fixtures listed here are planned evidence inputs. None exists or is claimed executed at specification time. Runtime implementation must capture real producer output and filesystem behavior before trimming it into committed fixtures.

## Fixture principles

1. Capture from the real producer: the implemented kernel parser, OMP installed plugin, platform filesystem, selected BDD runner, audit serializer, and mutation engine.
2. Record provenance: producer/version, command or API invocation, platform/filesystem, capture date, source hash, trimming steps, and expected ground truth.
3. Trim only to a valid minimal subset that preserves the result space; do not hand-fabricate external producer shapes.
4. Keep secrets and user data out. Replace sensitive values only with documented deterministic redaction while preserving schema.
5. Reconcile the fixture with the producer's own summary or filesystem hashes.
6. A fixture proves input shape and expected behavior, not current runtime success.

## Planned fixture families

### FX-1 — Real canonical spec corpus

**Producer:** read-only `spec-kernel` over a real ordinary unlinked repository spec.
**Capture:** the canonical 15 documents, content hashes, parsed nodes, complete heading definitions, generated anchors, link occurrences, and trace edges for a small valid spec.
**Ground truth:** parser summary, `spec-kernel:FR-13` inventory, and independently hashed source bytes agree.
**Used by:** proposal, explicit review, validation, anchor, status, and byte-conservation scenarios.

### FX-2 — Real Markdown slug and inbound-link inventory

**Producer:** the exact Markdown/slug and `spec-kernel:FR-13` inventory implementation, exercised on headings with punctuation, dots, Unicode, repeated text, same-file and cross-file links.
**Ground truth:** captured heading/anchor/link-occurrence inventory resolves every accepted link, identifies duplicates/external inbound occurrences, and proves completeness for one snapshot.
**Used by:** FR-7 and the anchor mutation family.

### FX-3 — Windows filesystem containment

**Producer:** Windows filesystem APIs on a supported OMP host.
**Capture:** ordinary directory, symlink where permission permits, junction, mount/reparse metadata, drive-relative, UNC/device, alternate-data-stream, case collision, linked-spec read attempt, and component-switch race outcomes.
**Ground truth:** lstat/reparse tag, resolved final path, before-content-read refusal for linked roots/specs/targets, and before/after tree hashes.
**Used by:** FR-3, FR-5, FR-6.

### FX-4 — POSIX filesystem containment

**Producer:** supported POSIX filesystem APIs.
**Capture:** ordinary path, symlink chain, mount boundary where reproducible, linked-spec read attempt, Unicode normalization collision, relative traversal, component-switch race, rename, fsync, and crash-recovery behavior.
**Ground truth:** lstat/realpath/device-inode observations, before-content-read refusal for linked roots/specs/targets, and before/after tree hashes.
**Used by:** FR-3, FR-5, FR-6.

### FX-5 — Transaction fault timeline

**Producer:** real transaction writer and recovery coordinator with deterministic fault injection at each defined boundary.
**Capture:** proposal/review identities; blocked-current, journal/missing-marker, original, result, retained-assessment, and candidate hashes; coordinated reader observations; retained-selection authorization; valid/invalid original/result selections; no-survivor operator authorization; root-contained ordinary and escaping/linked candidate sources; dry-run proposal/full-preview review; atomic rebaseline; mismatch/link/validation/audit/concurrency refusals; pre/post hashes; append-only audit chain; and cleanup/retention tree.
**Ground truth:** every normal observation is one complete old/new generation; returned failure exposes originals; unresolved case is `RECOVERY_REQUIRED`; a complete retained generation exits only through authenticated retained recovery to `COMMITTED` or `ROLLED_BACK`; only a proven no-survivor state admits authenticated proposal-before-write rebaseline to `REBASELINED`; every refusal changes no bytes, leaks no candidate data, and erases no transaction/journal/recovery/candidate/audit history.
**Used by:** AC-2.4, AC-6.1–6.8 and safety-critical mutation families.

### FX-6 — Concurrent process race

**Producer:** at least two real processes using the shipped lease/CAS service plus one real kernel reader.
**Capture:** request IDs, lease order, both base hashes, commit order, error/result envelopes, and document generation hashes.
**Ground truth:** at most one stale-base writer commits; reader sees no mixed generation; replay adds no event.
**Used by:** AC-3.1–3.3, AC-6.3, AC-8.4, AC-9.2.

### FX-7 — Task evidence and transitions

**Producer:** kernel status/trace projection over a real spec plus a real BDD evidence artifact in the product's canonical format.
**Capture:** each status, all legal edges, representative illegal edges, complete/incomplete trace, strong/weak/stale/filtered outcomes, and Done When state.
**Ground truth:** transition reducer output agrees with documented exhaustive table.
**Used by:** FR-8.

### FX-8 — Audit envelopes

**Producer:** real audit projector for proposal, explicit review, success, refusal, rollback, automatic/manual retained recovery, rebaseline proposal/review/success/refusal, replay, concurrent commit, and pre/post-commit sink failure.
**Capture:** serialized envelopes, pre/post/current/journal/assessment/candidate fingerprints, history-chain continuity, and redaction report.
**Ground truth:** schema validates; proposal review and recovery identities are present without preview/body/authorization secrets/candidate paths/bytes; rebaseline records actor and reason and appends without rewriting failed-transaction history; digest chain reconciles; planted secrets and document bodies are absent.
**Used by:** FR-2, FR-6, FR-9 and FR-10.

### FX-9 — Installed OMP lifecycle

**Producer:** exact released child plugin installed through documented OMP marketplace lifecycle from https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/marketplace.md.
**Capture:** built release-candidate and installed artifact identities, product revision and artifact-lineage identity, internal deferred implementation evidence, FR-13 evaluation, registration state, install/reload/fresh-session invocation, ambient-dependency isolation, upgrade, uninstall, every FR-1..FR-12 envelope, current `plugin-distribution:FR-13`, separately identified `kernel-release-eligibility@1` v0.2 and v0.3 envelopes, both evidence fingerprints, v0.2 artifact hash, v0.3 artifact and declared-parent hashes, evaluated/valid/revoked times, and user-spec before/after hashes. Include one valid `A != B` linked predecessor/current pair and deterministic variants for one unqualified kernel envelope, duplicate stage, v0.3-for-v0.2 substitution, wrong parent hash, stale parent, and revoked parent.
**Ground truth:** schema/service/fixture/evaluator evidence may exist while lifecycle remains `DEFERRED`, but authoring actions stay unavailable until exact all-of FR-13 evidence includes one current non-revoked accepted v0.2 result and one current non-revoked accepted v0.3 result with `v03.v02ParentArtifactSha256 == v02.artifactSha256`, the same product revision/artifact lineage, all FR-1..FR-12 evidence, and current distribution evidence. The valid linked pair becomes `ELIGIBLE` even when predecessor/current hashes differ; every one-fault variant remains `DEFERRED` with the exact target-stage blocker. Registration uses only the existing extension and installed proof advances `ELIGIBLE→IMPLEMENTED→PROVEN`; uninstall or evidence regression preserves user bytes and unregisters actions.
**Used by:** FR-1, FR-12 and FR-13.

### FX-10 — Mutation engine run

**Producer:** the MP-1-selected real mutation engine against built plugin code and real behavioral runner.
**Capture:** engine/version/config, full mutant inventory, critical-family mapping, baseline, per-mutant result, restoration run, duration, errors, and artifact hashes.
**Ground truth:** producer totals reconcile with per-mutant rows; every critical family is represented; restoration hashes equal baseline.
**Used by:** FR-11.

### FX-11 — MCP facade compiler and registry

**Producer:** real facade compiler over captured canonical spec documents plus the built MCP registry inventory.
**Capture:** each of seventeen registered v1 facade requests, normalized proposal operations/hashes/findings, one review-only then one commit-only apply call, the exact tools/list registry, and the capability manifest's seven `unsupportedLaterNames`.
**Ground truth:** every v1 name maps byte-for-byte to its schema table row; one apply call never both reviews and commits; semantic repair refuses; v2 names are absent from v1 tools/list/tools/call and remain explicitly listed as later; no authoring name appears in historical v0.3.
**Used by:** FR-14.

## Prohibited fixtures

- invented JSON that merely resembles a kernel, OMP, filesystem, BDD, audit, or mutation result;
- mocked internal state injected around the real public handler;
- a source-tree run presented as installed-artifact proof;
- copied dev-pomogator runtime logs, state, user paths, or secrets;
- canonical repository documents mutated in place to create damaged cases;
- an aggregate mutation summary without per-mutant reconciliation and restoration proof.
- an apply fixture that creates and commits its own preview without a separate review event;
- a retained-recovery fixture containing replacement document bytes rather than a retained generation selection;
- a rebaseline request fixture embedding document bytes, omitting operator authorization/current or journal hashes/separate review, sourcing a candidate outside the fixed root-contained ordinary directory grammar, or erasing failed-transaction history;
- a linked spec directory presented as supported read-only input.
