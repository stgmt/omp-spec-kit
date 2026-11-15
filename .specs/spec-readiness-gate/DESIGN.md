# Design

Status: DRAFT

## DEC-1 — Readiness is a pure function of the graph

Context: the kernel already builds the graph and already computes orphan findings
(`UNCOVERED_FR`, `ORPHAN_TASK`, `SCENARIO_TAG_ORPHAN`) plus a coarse `readiness` string.
Decision: add `specReadiness(graph, specSlug)` next to those checks and treat it as the only
source of the level and blockers. It reads no files and calls no service.
Consequences: the verdict is cheap, testable with fixtures, and cannot drift between the
preview and the write; anything that needs filesystem facts must be folded into the graph
before this function is called.

## DEC-2 — The gate lives in the compiler, before any operation

Context: validation today is spread between the tool contract, the authoring service and the
plugin hook, and the hook cannot see the graph.
Decision: the admission check runs in `ProposalCompiler.compile`, before operations are
normalised, for the intents that create tasks and for patches that touch `TASKS.md` or add
scenarios. Hooks keep only the raw-path and tool-authority rules.
Consequences: one place decides, both transports inherit it, and the hook no longer needs a
second implementation of the cycle; the cost is that a hook-only client sees refusals as tool
responses rather than as a blocked command.

## DEC-3 — Refusals are a plan, not a sentence

Context: today an agent gets one code and, at best, a list of existing ids; the examples are
even drawn from the wrong kind.
Decision: every refusal carries `blockers[]` in level order and `fix[]` of ready-to-call
tool invocations, and the same text is rendered into the tool description so a model that
reads the schema already knows the order.
Consequences: identical behaviour across agents; the message catalogue becomes part of the
contract and needs its own drift test.

## DEC-4 — Scenario traceability is a tag rule, not a review

Context: scenarios enter through Gherkin tags only; a scenario without tags has no incoming
edge.
Decision: require `@featureN` or `@AC-N.M` at parse-accept time, with no exception flag.
Consequences: exploratory scenarios must reference the requirement they explore; the corpus
becomes fully traceable, and legacy scenarios without tags must be tagged in the migration
commit.
