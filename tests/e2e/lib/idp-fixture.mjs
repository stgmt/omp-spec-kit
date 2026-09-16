import { compose, waitFor, YT_URL } from "./compose.mjs";
import { completeWizard, youtrackNeedsWizard } from "./wizard.mjs";
import { createYouTrackAdmin } from "./youtrack.mjs";
import { ADMIN_PASSWORD } from "./bootstrap.mjs";

/**
 * TASK-13 external-IdP fixture: a second YouTrack (`youtrack-ext`) playing
 * the customer's own identity provider. Hosts: `127.0.0.1:8082` from the
 * test runner, `youtrack-ext:8080` inside the compose network. Wizard runs
 * once per volume; the user/group seed is idempotent.
 */
export const EXT_YT_HOST_URL = "http://127.0.0.1:8082";
export const EXT_YT_NET_URL = "http://youtrack-ext:8080";
export const EXT_TENANT = "acme";
export const EXT_PROJECTS = ["acme/gamma"];
export const EXT_HUB_GROUPS = ["ext-spec-users"];
export const EXT_ROLE_GROUPS = {
  owner: ["ext-spec-owners"],
  writer: ["ext-spec-writers"],
  reader: ["ext-spec-readers"],
};
export const EXT_GROUPS = [...EXT_HUB_GROUPS, ...EXT_ROLE_GROUPS.owner, ...EXT_ROLE_GROUPS.writer, ...EXT_ROLE_GROUPS.reader];

export const EXT_USERS = Object.freeze({
  mia: { password: "MiaPass!2026", groups: ["ext-spec-users", "ext-spec-writers"], role: "writer" },
  noa: { password: "NoaPass!2026", groups: ["ext-spec-users", "ext-spec-readers"], role: "reader" },
  oda: { password: "OdaPass!2026", groups: [], role: null },
});

export function extAdmin() {
  return createYouTrackAdmin({ login: "admin", password: ADMIN_PASSWORD, baseUrl: EXT_YT_HOST_URL });
}

/** Brings youtrack-ext up, completes the wizard if needed, seeds users/groups. */
export async function ensureExtYoutrack({ logger = () => {} } = {}) {
  compose(["up", "-d", "youtrack-ext"]);
  await waitFor(`${EXT_YT_HOST_URL}/`, { label: "ext YouTrack HTTP", timeoutMs: 300_000 });
  if (await youtrackNeedsWizard(EXT_YT_HOST_URL)) {
    await completeWizard({ adminPassword: ADMIN_PASSWORD, url: EXT_YT_HOST_URL, serviceName: "youtrack-ext", logger });
  }
  const admin = extAdmin();
  await admin.me();
  const serviceIds = [await admin.youtrackServiceId(), await admin.hubServiceId()];

  const groups = {};
  for (const name of EXT_GROUPS) {
    groups[name] = await admin.createGroup(name);
  }
  const users = {};
  for (const [login, spec] of Object.entries(EXT_USERS)) {
    const user = await admin.createUser({ login, password: spec.password, email: `${login}@ext.example.invalid` });
    await admin.banUser(user.id, false);
    await admin.setPassword({ userId: user.id, login, password: spec.password });
    for (const groupName of spec.groups) {
      await admin.addUserToGroup(groups[groupName].id, user.id);
    }
    await admin.revokePermanentTokens({ userId: user.id, name: `${login}-ext-e2e` });
    const token = await admin.createPermanentToken({ userId: user.id, name: `${login}-ext-e2e`, serviceIds });
    users[login] = { id: user.id, login, password: spec.password, token: token.token, role: spec.role };
    logger(`ext: provisioned ${login} (${spec.role ?? "no groups"})`);
  }

  const me = await admin.me();
  await admin.revokePermanentTokens({ userId: me.id, name: "ext-e2e-service" });
  const serviceToken = await admin.createPermanentToken({ userId: me.id, name: "ext-e2e-service", serviceIds });
  return { admin, users, serviceToken: serviceToken.token, groups };
}

/** Minimal bind body for the ext tenant against a service on the same network. */
export function extBindBody({ serviceToken, youtrackUrl = EXT_YT_NET_URL }) {
  return {
    tenant: EXT_TENANT,
    youtrackUrl,
    serviceToken,
    projects: EXT_PROJECTS,
    hubGroups: EXT_HUB_GROUPS,
    roleGroups: EXT_ROLE_GROUPS,
    defaultProject: EXT_PROJECTS[0],
  };
}
