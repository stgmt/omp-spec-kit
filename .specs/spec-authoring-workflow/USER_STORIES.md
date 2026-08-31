# User Stories

## US-1: Review exact changes before mutation

**Priority:** P0  
As a spec author, I want a deterministic complete preview so that I can inspect the exact resulting bytes and findings before any write.

**Independent test:** Propose a valid multi-document edit and prove every target hash is unchanged.

## US-2: Reject stale edits

**Priority:** P0  
As a concurrent editor, I want expected-hash comparison so that another accepted change is never overwritten.

**Independent test:** Race two applies from the same base and observe one winner plus one `CONFLICT` without lost bytes.

## US-3: Commit related documents together

**Priority:** P0  
As a maintainer, I want one-spec changes to become visible all at once so that FR, AC, scenario, check, and task traces cannot be partially installed.

**Independent test:** Inject a fault at each writer boundary and observe only a complete old or complete new generation.

## US-4: Contain the write boundary

**Priority:** P0  
As a repository owner, I want canonical path and reparse checks plus a host path policy so that raw tools cannot mutate `.specs/**`.

**Independent test:** Exercise traversal, absolute, UNC/device, symlink, junction, and non-allowlisted writer cases before content mutation.

## US-5: Preserve anchors and bytes

**Priority:** P0  
As a Markdown author, I want anchor-aware edits that conserve untouched bytes and EOLs so that links and unrelated text do not drift.

**Independent test:** Rename a heading through the proposal compiler and reconcile all same-spec inbound links and hashes.

## US-6: Receive a useful private receipt

**Priority:** P1  
As an operator, I want a compact outcome with document hashes, findings, and next action so that I can reconcile a mutation without leaking content or credentials.

**Independent test:** Plant secrets and document text, then prove neither appears in proposal errors or apply receipts.

## US-7: Recover without another public repair API

**Priority:** P0  
As an operator, I want deterministic internal rollback and clear manual restore instructions if storage is unrecoverable so that a failed commit does not invent a risky automated repair path.

**Independent test:** Destroy the staged and retained recovery candidates in a fault fixture and observe `RECOVERY_REQUIRED`, no further writes, and a bounded VCS/backup restore instruction.
