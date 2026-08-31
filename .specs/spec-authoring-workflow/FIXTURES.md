# Fixtures

## Status and provenance rule

Fixtures are planned evidence inputs; none is claimed executed by this specification. Every committed capture SHALL record producer/version, exact command or API invocation, platform/filesystem, capture date, source hash, trimming steps, expected ground truth, and independent reconciliation hashes. External producer shapes SHALL come from the real producer, never hand fabrication. Secrets and user data are replaced only by documented deterministic redaction.

## FX-1: Real canonical spec corpus

**Producer:** shipped/candidate `spec-kernel` over an ordinary unlinked repository spec.  
**Capture:** canonical 15 documents, source hashes, parsed nodes, headings, generated anchors, link occurrences, and FR↔AC↔Scenario↔CHK↔TASK edges.  
**Ground truth:** kernel summary and independently hashed source bytes agree.  
**Used by:** AC-2.1, AC-3.2, AC-6.1.

## FX-2: Real Markdown anchor corpus

**Producer:** the exact kernel Markdown slug and link-inventory implementation.  
**Capture:** punctuation, dots, Unicode, repeated headings, same-file links, same-spec cross-file links, ambiguity, and cross-spec inbound links.  
**Ground truth:** accepted links resolve once; unsafe rename cases refuse without bytes changed.  
**Used by:** AC-3.2, AC-6.1.

## FX-3: Windows containment capture

**Producer:** Windows filesystem APIs on a supported OMP host.  
**Capture:** ordinary directory, symlink where permitted, junction, reparse metadata, drive-relative, UNC/device, alternate data stream, case/Unicode collision, and component-switch race.  
**Ground truth:** metadata/final-path evidence and tree hashes prove refusal before target mutation.  
**Used by:** AC-1.2, AC-3.1, AC-4.2.

## FX-4: POSIX containment capture

**Producer:** supported POSIX filesystem APIs.  
**Capture:** ordinary path, symlink chain, mount boundary where reproducible, Unicode collision, traversal, rename/fsync behavior, and component-switch race.  
**Ground truth:** lstat/realpath/device-inode observations and tree hashes prove the contracted result.  
**Used by:** AC-3.1, AC-5.1.

## FX-5: Real multi-process CAS race

**Producer:** at least two real processes using the authoring lock/CAS service plus one coordinated reader.  
**Capture:** request/proposal IDs, lease order, base hashes, commit order, outcomes, and observed generation hashes.  
**Ground truth:** one stale-base writer at most commits; loser returns conflict; replay adds no commit; reader sees no mixed generation.  
**Used by:** AC-4.1, AC-4.2.

## FX-6: Generation writer fault timeline

**Producer:** real generation writer with deterministic faults at prepare, file write, sync, pre-swap check, swap, and cleanup.  
**Capture:** old/new/stage hashes, reader observations, fault point, rollback decision, final tree hash, and no-survivor branch.  
**Ground truth:** final visible state is complete old or complete new; if neither is provable, result is `RECOVERY_REQUIRED`, no further write occurs, and the next action is manual VCS/backup restore.  
**Used by:** AC-5.1, AC-5.2.

## FX-7: Receipt redaction corpus

**Producer:** real Proposal/Error/MutationReceipt serializers.  
**Capture:** success/refusal outcomes with planted body text, credentials, environment values, absolute unrelated paths, and stack-like failures.  
**Ground truth:** compact schema validates; hashes and relative changed-document paths reconcile; planted sensitive values are absent.  
**Used by:** AC-6.2.

## Historical release provenance

v0.3.2 remains the real shipped read-only baseline for compatibility captures: tag commit `2938389e34e2d06bdd497291ed01e0a2d89146c9`, candidate digest `526ef6ff94ea682a116a43e4de0b5f622686b8ef36648b7884c830ba1eac25b4`, package-tree digest `e8d53934122a495e1003f17126785dcd181f5d6d5f417270844e17fc25f12f92`, archive SHA-256 `26a2ebadd7d1888c10dc9bdbdc25e11fecf5b15c7e3bb363a0cbea9`. Captures may compare against that baseline, but those receipts are not live authoring eligibility inputs.
