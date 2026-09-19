# YouTrack app request signature and per-user identity

Status: decided (implemented in TASK-12/TASK-13; formalized 2026-09-18)

## Context

The installed YouTrack app is global: every user of a bound project sees the
widgets and may connect an agent. The service must know who is calling and
which tenant they belong to, without any per-user install or per-user service
credential.

## The request signature

A call arriving **through the installed app** carries a fixed signature:

```
Authorization: Bearer <bridgeToken>     # app↔service secret, minted at idp/bind
X-Spec-User: <login>                    # session user asserted by YouTrack
```

`classifyRequest()` in `src/service/auth.js` is the single recognizer: a
bearer whose sha256 matches a bound IdP's `bridgeTokenHash` makes the request
a *bridge* request; anything else is a *direct* user-token request.

- Bridge without `X-Spec-User` → `401 MISSING_USER` — the signature is
  incomplete, not "bridge with no user".
- `X-Spec-User` on a direct-token request is ignored — a user credential can
  never assert someone else's identity.
- `X-Spec-Idp` / `X-Spec-Project` are routing hints only, never authorization.

## Trust model: asserted, never trusted

YouTrack verifies the browser session and stamps `ctx.currentUser` inside the
app backend — the widget cannot forge it. The service still does not trust the
header: every asserted login is re-resolved against the bound IdP with its
service token (`/hub/api/rest/users?query=login:`, `transitiveGroups`), then
mapped to tenant scopes and a role.

**What the signature actually proves is possession of the bridge secret — not
a live session.** Re-verification gates *existence, groups and ban status*, not
whether the asserted user is really at the keyboard: a holder of the bridge
token can assert **any** login resolvable on that IdP and inherits that user's
real role — the secret is a tenant-wide impersonation deputy by design (the
app backend is a trusted deputy). It never reaches the widget DOM: it lives
only in `ctx.settings` inside YouTrack's server-side handler isolate, and is
readable only by that instance's admins via app settings. Treat it as tenant
root: leak → re-bind (`idp/unbind` + `idp/bind`) to rotate. Fail-closed
outcomes:

| Assertion | Result |
|---|---|
| login unknown to the IdP | `401 UNKNOWN_USER` |
| user in no tenant hub group | `403 NO_SCOPES` |
| tenant member without a role group | `403 NO_ROLE` |
| banned user | `403 BANNED` (checked before group gates) |
| bound IdP unreachable | `503 UNAVAILABLE`, scoped to that tenant only |

## Per-user agent credential

"Get my .mcp.json" calls `POST /onboarding/token` through the same bridge.
The service mints a **YouTrack permanent token for that user** via Hub
(`users/{id}/permanenttokens`, scope = all Hub services) using the IdP's
service token — it never issues credentials of its own:

- One token per (login, purpose): the previous `omp-spec-kit agent` token is
  revoked before re-mint; issuance is audited, the value never persisted.
- `MINT_NOT_PERMITTED` → the widget offers paste-your-own-token; the pasted
  token is verified as the same user (`TOKEN_MISMATCH` if not) and wrapped
  into the snippet — still never stored.
- The snippet pins `X-Spec-Idp` (which bound YouTrack issued it) and
  `X-Spec-Project` (caller scope) — hints the server re-checks anyway.

## Consequences

- A second user of the same tenant uses the same installed app with their own
  identity immediately — writer, reader and no-access states resolve per call.
- `serviceUrl`/`serviceBridgeToken` remain required app settings: the values
  come from the `install` block shown once at `idp/bind` (or a self-hosted
  deployment URL). No default is baked into the ZIP — a placeholder pointing
  at localhost or an unowned host would silently misroute customer traffic.
- Losing the bridge token means re-binding (`idp/unbind` + `idp/bind`) — there
  is deliberately no read-back of the secret; only its hash is stored.

## Evidence

`tests/idps.test.mjs` — "bridge signature: asserted users are re-verified per
call, spoofs and out-of-tenant logins fail"; "onboarding accepts only the
caller's own pasted token". Live UI journeys: `tests/features/app-install-live.feature`.
