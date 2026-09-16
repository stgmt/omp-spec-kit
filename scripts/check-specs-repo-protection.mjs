#!/usr/bin/env node
/**
 * Specs-repository protection posture check (TASK-2).
 *
 * The service is the only writer to the canonical specs repository, so the
 * repository's own posture is the enforcement boundary: it must be private and
 * carry no collaborators beyond the operator owner and the service identity.
 * Anything else is a direct human write path around the service.
 *
 * Configuration:
 *   SPEC_REGISTRY_REPO           owner/name (default stgmt/spec-database)
 *   SPEC_REGISTRY_GIT_TOKEN      GitHub token with repo access (falls back to
 *                                GH_TOKEN). The token's own login is resolved
 *                                via GET /user and counted as an allowed actor.
 *   SPEC_REPO_ALLOWED_ACTORS     extra comma-separated logins allowed as
 *                                collaborators (break-glass operators)
 *
 * Hard gates: repository exists and is private; collaborator set ⊆ allowed.
 * Report-only: branch protection / ruleset presence (plan-dependent).
 */
const repo = process.env.SPEC_REGISTRY_REPO ?? "stgmt/spec-database";
const token = (process.env.SPEC_REGISTRY_GIT_TOKEN ?? process.env.GH_TOKEN ?? "").trim();
const extraAllowed = (process.env.SPEC_REPO_ALLOWED_ACTORS ?? "")
  .split(",")
  .map((login) => login.trim())
  .filter(Boolean);

function fail(message) {
  console.error(`specs-repo posture: ${message}`);
  process.exit(1);
}

if (!token) fail("set SPEC_REGISTRY_GIT_TOKEN or GH_TOKEN to a token that can read the specs repository");

async function api(pathname) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
    signal: AbortSignal.timeout(30_000),
  }).catch((error) => fail(`github api unreachable: ${error instanceof Error ? error.message : String(error)}`));
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const error = new Error(`GET ${pathname} -> HTTP ${response.status}: ${body.slice(0, 200)}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

const checks = [];
const report = (name, ok, detail) => {
  checks.push({ name, status: ok ? "passed" : "failed", detail });
  return ok;
};

const [owner] = repo.split("/");
const me = await api("/user").catch((error) => fail(error.message));
const allowedActors = new Set([owner, me.login, ...extraAllowed]);

const info = await api(`/repos/${repo}`).catch((error) => fail(error.message));
report("repository private", info.private === true, `private=${info.private}`);

const collaborators = await api(`/repos/${repo}/collaborators?per_page=100`).catch((error) => fail(error.message));
const logins = collaborators.map((entry) => entry.login);
const unexpected = logins.filter((login) => !allowedActors.has(login));
report(
  "collaborators limited to service + owner",
  unexpected.length === 0,
  unexpected.length === 0 ? `actors: ${logins.join(", ") || "<none>"}` : `unexpected: ${unexpected.join(", ")}`,
);

// Report-only: rulesets/branch protection harden the boundary but are
// plan-dependent on the hosting tier — surface them without failing.
let protection = "none";
try {
  const rulesets = await api(`/repos/${repo}/rulesets`);
  protection = Array.isArray(rulesets) && rulesets.length > 0 ? `${rulesets.length} ruleset(s)` : "none";
} catch {
  protection = "unreadable";
}
const branchProtection = await api(`/repos/${repo}/branches/${info.default_branch}/protection`).then(() => "enabled").catch(() => "none");

const failed = checks.filter((check) => check.status === "failed");
console.log(
  JSON.stringify(
    {
      schema: "omp-spec-kit-specs-repo-posture@1",
      repository: repo,
      status: failed.length === 0 ? "passed" : "failed",
      checks,
      hardening: { rulesets: protection, defaultBranchProtection: branchProtection },
    },
    null,
    2,
  ),
);
if (failed.length > 0) process.exit(1);
