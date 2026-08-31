# User Stories

## US-1: Reviewer receives a clear verdict

**Priority:** Must

**Story:** As a reviewer, I want one manual validation result so that I can distinguish an actionable plan from an incomplete plan and from a validator that could not run.

**Independent Test:** Submit one complete plan, one plan missing verification, and one request with a mismatched expected hash; observe `VALID`, `INVALID`, and `UNAVAILABLE`.

## US-2: Author receives bounded repair guidance

**Priority:** Must

**Story:** As a plan author, I want findings with lines and hints so that I can repair the exact missing or malformed content without reading an implementation trace.

**Independent Test:** Submit a plan with more findings than the response limit; verify stable ordering, complete rows, and the exact omitted count.

## US-3: Maintainer can trust the portable core

**Priority:** Must

**Story:** As a maintainer, I want validation to depend only on explicit bytes so that installed behavior is deterministic and independent of repository layout or OMP internals.

**Independent Test:** Run the installed module outside the source checkout with no network, daemon, credentials, or external dependencies and reconcile real fixture results.
