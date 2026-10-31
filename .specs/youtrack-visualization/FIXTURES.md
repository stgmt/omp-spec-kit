# Fixtures

Fixtures are deterministic and contain no credentials or live tracker state.

## MCP board fixtures

1. full corpus: six board kinds, raw edges, counts, fingerprint, and complete=true;
2. scoped corpus: two specifications with cross-scope edges omitted;
3. empty scope: complete response with zero nodes and edges;
4. duplicate identity: typed validation error;
5. malformed endpoint: typed validation error;
6. over-size response: RESPONSE_TOO_LARGE with no partial data.

## Tracker fixtures

Card fixtures cover every board kind, human title, full body, escaped text, source footer, content hash, evidence, and native Type. Link fixtures cover all nine types, reverse labels, duplicate suppression, and stale-link removal.

## Commit fixtures

Parity fixtures cover valid equal state, same-fingerprint drift, invalid pointer, changed fingerprint, card failure, link failure, snapshot failure, and marker failure. Every failure asserts that the previous committed marker remains readable.

## Writeback fixtures

TASK fixtures cover Open to Fixed to Verified, resolved to Reopened, invalid non-TASK identity, invalid transition, and spec_patch rejection. A successful tracker-only state change without spec_patch is never a passing fixture.

## Staging transport note

The checked staging uploader uses raw REST with credentials supplied out of band. CLI commands and permanent tokens are not part of this fixture contract. Upload and dashboard verification are deployment evidence, separate from pure adapter fixtures.
