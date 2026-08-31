# Non-Functional Requirements

## NFR-SAFETY-1: Fail closed

A missing validator, unresolved target, incomplete preview, CAS mismatch, uncertain writer state, or malformed response SHALL never authorize a write. `RECOVERY_REQUIRED` allows only manual VCS/backup restoration outside the public tool surface.

## NFR-DURABILITY-1: Atomic visibility

On supported filesystems, staging SHALL be same-filesystem and file/directory synchronization SHALL occur where available. Coordinated readers SHALL observe a complete old or new generation only.

## NFR-DETERMINISM-1: Stable proposal identity

Equal canonical snapshot bytes, operations, policy, and bounds SHALL produce equal normalized operations, finding order, diffs, after-hashes, and Proposal hash.

## NFR-CONCURRENCY-1: Bounded locking

Lock acquisition SHALL have a documented finite bound. A timeout returns `CONFLICT` without changing bytes; every successful lock holder rechecks CAS and containment immediately before commit.

## NFR-PORTABILITY-1: Platform containment

Windows reparse/junction/device/ADS rules and POSIX symlink/mount rules SHALL be tested on their real platforms. Unsupported metadata or durability primitives fail closed with a bounded diagnostic.

## NFR-PRIVACY-1: Redaction

Errors and receipts SHALL use repository-relative document paths and hashes only. They SHALL contain no document body, secret, environment value, stack trace, absolute unrelated path, or retained generation bytes.

## NFR-COMPATIBILITY-1: Byte and EOL conservation

Untouched spans SHALL remain byte-identical. Existing encoding, EOL style, and final-newline state SHALL be preserved unless an explicit whole-document operation intentionally replaces them and the preview shows the exact result.

## NFR-PERFORMANCE-1: Bounded work

Preview bytes, operation count, document count, findings, and diagnostic text SHALL have explicit implementation constants. Exceeding a bound returns `INVALID_REQUEST` with exact observed and allowed counts and no partial preview or write.

## NFR-MAINTAINABILITY-1: One core

Both public tools and all internal helpers SHALL use one operation normalizer, one validator composition, one containment resolver, and one writer. No parallel task lifecycle, review state, release evaluator, recovery API, or audit ledger is permitted.
