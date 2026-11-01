# Decision: widget marker trust model

Date: 2026-11-01
Status: accepted
Related: `youtrack-visualization` FR-13/FR-14, review finding "unsigned-widget trust"

## Problem

The Spec Board and Spec Panel read committed `SPEC:SYNC-STATE` markers directly
from YouTrack with the user's session. The service signs every marker with
HMAC-SHA256, but the widget cannot verify the signature: the key must never be
shipped to the browser. The v7 project index adds a second redirect surface —
`projects[].pointer` tells the widget which project issue to read.

A SPEC-project member with issue-edit rights could edit the root index or a
project pointer and make the shared dashboard render fabricated cards.

## Decision

Keep the direct read, but treat the marker store as **service-owned**:

- `SPEC:SYNC-STATE` and every `SPEC:SYNC-STATE:<project>` issue are writable
  only by the `spec-registryd` service account (and by YouTrack administrators,
  who are already trusted to edit the tracker).
- Ordinary users and dashboard readers have **read-only** access to those
  issues; the board never writes them.
- The widget validates structure, projection version, `complete`, and project
  scope, but not the signature. The signature protects service-side consumers
  (sweep, writeback) and the release gate; browser-side HMAC is not possible.
- If the deployment cannot restrict edit access to the marker project, the
  fallback is a service read/verify endpoint; that is a follow-up, not the v1
  contract.

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Verify HMAC in the widget | Requires shipping the marker secret to every dashboard viewer; the secret would no longer be a secret. |
| Serve every board snapshot through `spec-registryd` | Adds a service round-trip and a hard runtime dependency to a widget that is designed to render the committed tracker state without the service. |
| Read-only mirror project with a second writer | Operationally heavier than restricting edit rights on the existing marker issues. |

## Required deployment

- The marker issues live in the projection project (`SPEC` by default).
- Grant `spec-registryd`'s account write access; grant dashboard readers read
  access only.
- Audit the project team/permissions when enabling projection; a user with
  `Update Issue` on marker issues can forge a snapshot and is outside the
  trust model.
- The project index and project pointers are covered by the same rule.

## Residual risk

A YouTrack administrator or a user explicitly granted `Update Issue` on the
marker issues can forge a marker. This is accepted: those roles can already
edit the projected cards and the tracker. If that is unacceptable, enable the
service read/verify endpoint described above and make the widget consume it.

## Evidence

- Live v7: root `projectionVersion=7`, `projects[].pointer=SPEC-837`, project
  pointer scope `project`, 713 nodes.
- `readCommitted` verifies the root and every project pointer (`projectIndexComplete`).
- The board fails closed with `PROJECTION_INDEX_REQUIRED` for a v6/incomplete index.
