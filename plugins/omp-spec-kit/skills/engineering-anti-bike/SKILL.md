---
name: engineering-anti-bike
description: Anti-bikeshedding and anti-fake-green discipline for specification authoring and implementation — evidence-first claims, prior-art scan before custom code, and a mandatory self-test check when authoring BDD scenarios.
---

# Engineering anti-bike

Operating discipline that prevents two failure modes: bikeshedding (debating taste instead of shipping the boring correct thing) and fake-green (tests that pass without proving anything).

## Evidence-first claims

- Every claim about code, tests, tools, or documents must be grounded in bytes you actually read or a command you actually ran. Mark anything unobserved as inference.
- Never assert "the test covers X" from the test name; read the assertion body.
- Never assert "the tool does Y" from its description; run it or read its handler.

## Prior-art scan before custom implementation

- Before writing a new mechanism, search the repository and the installed toolchain for an existing one. Name what you found and why it does not fit, or reuse it.
- Prefer the boring option that already exists over a novel abstraction. A second convention beside an existing one is prohibited.

## Self-test / fake-green check at BDD scenario authoring

Draft scenarios require complete Given/When/Then steps and valid links. To add `@spec-ready` or change a protected scenario, send `spec_patch` with a `designReview` field (schema `omp-spec-kit/design-review@1`). This includes moving or deleting the scenario and changing its effective background or examples. The server reports `DESIGN_REVIEW_REQUIRED` for a missing review and `DESIGN_REVIEW_INVALID` for a malformed review. Approval of the scenario text for task scope is handled separately through the owner's BDD coverage map.

The review must answer, with evidence:

- **boundary** — which external contract, external system, or user-visible contract the scenario pins, and the claim being made about it.
- **evidence** — 2–8 items; at least one `kind:"test"` and at least one non-test kind (`source`, `documentation`, or `research`).
- **alternatives** — 1–5 rejected approaches with a reason each.
- **selfTestCheck** — proof the scenario is not vacuous: `status:"passed"`, `mutation:"failed-as-expected"`, plus the command run, the hypothesis, the answer, the positive case, the negative case, the expected failure, and the observed failure.

Before marking a scenario executable, verify that it fails for the specific wrong behavior it claims to catch.

## Hypothesis Q&A

- Ask only questions whose answer changes a requirement, acceptance criterion, or boundary claim. Name the gap each question closes.
- Never reverse a decision under pressure alone; reverse only on new evidence, and record the evidence.
