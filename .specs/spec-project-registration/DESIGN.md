# Design

## DEC-1: Registration is a service decision that an agent may request

Date: 2026-11-08
Scope: spec-project-registration
Key: registration-authority
Value: service-authorized-action
Status: decided

The tool relays a registration request; the service decides it. Role, repository access and secret handling stay on the service side, and the agent surface only reports the outcome and the one next action. Rejected alternatives: serving an unregistered corpus locally, which hides the missing authorization instead of fixing it, and letting the agent write a project binding by hand, which produces exactly the refusal loop observed in the field report.

The owner's decision of 2026-11-08 is recorded here: a project must be registered; the release fixes the path to registration, not the requirement.
