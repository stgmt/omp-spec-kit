# Design

## DEC-1: Drift detection compares a declared pattern, not free text

Date: 2026-11-08
Scope: spec-decision-drift
Key: drift-mechanism
Value: declared-pattern
Status: decided

A decision states its value once and declares the pattern that finds other mentions of the same value. The check is a comparison of captured text with the declared value, not a semantic reading of prose. Rejected alternatives: natural-language inference, which cannot fail deterministically, and a per-key schema of every rule, which would duplicate the corpus it is meant to guard.

The declared pattern is written as `Guard: <regular expression with one capture group>`. A decision without a guard declares a value that nothing checks, which the report states explicitly as `no-guard`.
