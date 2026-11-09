import { requireScope } from "./scope.js";

function teamAuthError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function teamPrincipal(ctx) {
  const userId = ctx?.identity?.userId;
  if ((typeof userId !== "string" && typeof userId !== "number") || String(userId).trim().length === 0) {
    throw teamAuthError("TEAM_IDENTITY_UNAVAILABLE", "team access requires a stable authenticated identity.userId");
  }
  if (ctx.idp !== null && ctx.idp !== undefined && (typeof ctx.idp !== "string" || ctx.idp.trim().length === 0)) {
    throw teamAuthError("TEAM_IDENTITY_UNAVAILABLE", "team access requires a stable authenticated IdP identity");
  }
  return JSON.stringify([ctx.idp ?? "default", String(userId)]);
}

export async function requireTeamOwner(store, teamId, ownerPrincipal) {
  if (typeof store?.getTeamSpecsTeam !== "function") {
    throw teamAuthError("TEAM_STORE_UNAVAILABLE", "the persistent team-spec registry is unavailable");
  }
  const team = await store.getTeamSpecsTeam(teamId);
  if (!team || team.ownerPrincipal !== ownerPrincipal) {
    throw teamAuthError("TEAM_ACCESS_DENIED", "team access is not authorized for this authenticated principal");
  }
  return team;
}

export async function requireTeamSpecBinding({ store, ctx, teamId, project, spec }) {
  const scope = requireScope(ctx?.scope, "team task write");
  if (typeof project !== "string" || !scope.allows(project)) {
    throw teamAuthError("PROJECT_NOT_ALLOWED", "team task write is outside the caller's allowed project scope");
  }
  const ownerPrincipal = teamPrincipal(ctx);
  await requireTeamOwner(store, teamId, ownerPrincipal);
  if (typeof store?.listTeamSpecsBindings !== "function") {
    throw teamAuthError("TEAM_STORE_UNAVAILABLE", "the persistent team-spec registry is unavailable");
  }
  const bindings = await store.listTeamSpecsBindings(teamId);
  if (!bindings.some((binding) => binding.project === project && binding.spec === spec)) {
    throw teamAuthError("TEAM_SPEC_NOT_LINKED", `team ${teamId} is not linked to ${project}/${spec}`);
  }
  return { ownerPrincipal, scope };
}
