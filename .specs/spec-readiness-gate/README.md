# Spec readiness gate

Status: DRAFT

## Purpose

Turn the specification corpus into something a machine refuses to abuse: no task exists
outside a spec that is actually assembled, and no entity exists without a graph edge that
explains why it is there. The gate is a compiler stage, not a prompt.

## Scope

In scope: the readiness verdict, the write-path admission for tasks and scenarios, the
single source of the rule text, and identical behaviour on every transport that speaks MCP.

Out of scope: user interface for the blockers (separate specification), migration of legacy
corpora beyond the documented compatibility window, and any change to the document set.

## Decisions taken by the owner

- A task requires an FR, an AC under that FR, and a DESIGN that is not a stub.
- A scenario must carry `@featureN` or `@AC-N.M`; there is no exploratory exception.
- Tasks without traceability are forbidden outright; backlog intents are removed.
- Rule text, refusal text and the ordered fix steps come from one generated source, and a
  drift test fails when a copy diverges.
