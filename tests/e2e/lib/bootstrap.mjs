import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createYouTrackAdmin } from "./youtrack.mjs";
import { REPO_ROOT } from "./compose.mjs";

const execFileAsync = promisify(execFile);

export const ADMIN_PASSWORD = "SpecE2eAdmin!2026";
export const USERS = Object.freeze({
  alice: { password: "AlicePass!2026", groups: ["spec-alpha", "spec-alpha-writers"], role: "writer" },
  bob: { password: "BobPass!2026", groups: ["spec-alpha", "spec-alpha-readers"], role: "reader" },
  carol: { password: "CarolPass!2026", groups: ["spec-alpha", "spec-alpha-owners"], role: "owner" },
  dave: { password: "DavePass!2026", groups: [], role: null },
  erin: { password: "ErinPass!2026", groups: ["spec-alpha", "spec-alpha-writers"], role: "writer" },
  // Two matched tenants: proves the AC-4 rule that an omitted `project` is
  // refused when more than one tenant matches, and that an explicit project
  // stays inside its own scope.
  frank: {
    password: "FrankPass!2026",
    groups: ["spec-alpha", "spec-alpha-writers", "spec-beta", "spec-beta-writers"],
    role: "writer",
  },
});
export const BRIDGE_TOKEN = "e2e-bridge-token-0123456789";
export const APP_NAME = "spec-graph-app";

const SEED_FILES = Object.freeze({
  "README.md": "# Alpha Spec\n\nStatus: DRAFT\n\nSeeded corpus for the live auth E2E.\n",
  "TASKS.md": "# Tasks\n\nStatus: DRAFT\n\n## TASK-1 — seed task\n- **Status:** todo\n- **Done When:** seeded corpus is readable.\n- **Requirements:** FR-1\n",
  "FR.md": "# Functional requirements\n\nStatus: DRAFT\n\n## FR-1 — seeded requirement\n\nThe system SHALL expose the seeded spec to authorized callers only.\n",
  "ACCEPTANCE_CRITERIA.md": "# Acceptance criteria\n\nStatus: DRAFT\n\n## AC-1 — seeded criterion\n\n**Given** the seeded corpus, **when** an authorized caller reads it, **then** it is visible.\n",
});

// Second project for the AC-4 isolation scenarios: its own scope, its own spec.
const BETA_SEED_FILES = Object.freeze({
  "README.md": "# Beta Spec\n\nStatus: DRAFT\n\nSecond seeded corpus for the live auth E2E.\n",
  "TASKS.md": "# Tasks\n\nStatus: DRAFT\n\n## TASK-1 — beta seed task\n- **Status:** todo\n- **Done When:** the beta corpus is readable inside its own scope.\n- **Requirements:** FR-1\n",
  "FR.md": "# Functional requirements\n\nStatus: DRAFT\n\n## FR-1 — beta seeded requirement\n\nThe system SHALL keep beta readable only through the beta scope.\n",
  "ACCEPTANCE_CRITERIA.md": "# Acceptance criteria\n\nStatus: DRAFT\n\n## AC-1 — beta seeded criterion\n\n**Given** the beta corpus, **when** an authorized beta caller reads it, **then** it is visible.\n",
});

// TASK-13: the external-IdP tenant's corpus — readable only through a binding
// that registers acme/gamma, so seeding it is itself an isolation probe.
const GAMMA_SEED_FILES = Object.freeze({
  "README.md": "# Gamma Spec\n\nStatus: DRAFT\n\nExternal tenant corpus for the IdP binding E2E.\n",
  "TASKS.md": "# Tasks\n\nStatus: DRAFT\n\n## TASK-1 — gamma seed task\n- **Status:** todo\n- **Done When:** readable only through the external tenant scope.\n- **Requirements:** FR-1\n",
  "FR.md": "# Functional requirements\n\nStatus: DRAFT\n\n## FR-1 — gamma requirement\n\nThe system SHALL serve gamma only to callers of the bound external IdP.\n",
  "ACCEPTANCE_CRITERIA.md": "# Acceptance criteria\n\nStatus: DRAFT\n\n## AC-1 — gamma criterion\n\n**Given** the external binding, **when** an external caller reads, **then** only their corpus is visible.\n",
});

const SEED_TREES = Object.freeze([
  { project: "stgmt/alpha", spec: "alpha-spec", files: SEED_FILES },
  { project: "stgmt/beta", spec: "beta-spec", files: BETA_SEED_FILES },
  { project: "acme/gamma", spec: "gamma-spec", files: GAMMA_SEED_FILES },
]);

async function git(cwd, args) {
  return (await execFileAsync("git", args, { cwd })).stdout.trim();
}

/**
 * Seeds the specs repo from INSIDE the git container. Pushes over git:// from
 * the Windows host to the published daemon port hang in Docker Desktop's
 * port-forwarder (clone works, push stalls) — the in-container route is the
 * reliable one and still exercises the real daemon + receive-pack.
 */
export async function seedSpecsRepo({ logger = () => {} } = {}) {
  const heredocs = SEED_TREES.flatMap((tree) =>
    Object.entries(tree.files).map(
      ([name, content]) =>
        `if [ ! -f "${tree.project}/.specs/${tree.spec}/${name}" ]; then cat > "${tree.project}/.specs/${tree.spec}/${name}" <<'SEED_EOF'\n${content}SEED_EOF\nfi`,
    ),
  ).join("\n");
  const script = [
    "set -e",
    "rm -rf /tmp/seed && git clone -q git://127.0.0.1/specs.git /tmp/seed",
    "cd /tmp/seed",
    "git config user.email seed@example.invalid",
    "git config user.name seed",
    ...SEED_TREES.map((tree) => `mkdir -p ${tree.project}/.specs/${tree.spec}`),
    heredocs,
    "git add .",
    'if git status --porcelain | grep -q .; then git commit -qm "seed: alpha-spec + beta-spec" && git push -q origin HEAD:refs/heads/main && echo SEEDED; else echo UP_TO_DATE; fi',
    "rm -rf /tmp/seed",
  ].join("\n");
  const { stdout } = await execFileAsync("docker", ["exec", "spec-auth-e2e-spec-git-1", "sh", "-c", script]);
  if (!/SEEDED|UP_TO_DATE/.test(stdout)) throw new Error(`specs repo seeding produced no marker: ${stdout.slice(0, 200)}`);
  logger(`specs repo: ${stdout.trim().split("\n").pop()}`);
}

/**
 * Installs the app through the official JetBrains CLI against the same
 * manifest-derived package CI builds (one build path for CI, release and
 * this fixture), then verifies the installed version matches the manifest.
 */
export async function deployApp({ admin, token, hostUrl = null, logger = () => {} }) {
  const appDir = path.join(REPO_ROOT, "tools", "spec-graph-app");
  const work = await mkdtemp(path.join(tmpdir(), "spec-e2e-app-"));
  try {
    const { buildPackage } = await import("../../../scripts/app-package.mjs");
    const outDir = path.join(work, "package");
    await buildPackage(appDir, { outDir, zipPath: path.join(work, `${APP_NAME}.zip`) });
    const { YT_URL } = await import("./compose.mjs");
    const cli = path.join(REPO_ROOT, "node_modules", "@jetbrains", "youtrack-apps-tools", "bin", "youtrack-app");
    await execFileAsync(process.execPath, [cli, "app", "upload", "--directory", outDir], {
      env: { ...process.env, YOUTRACK_HOST: hostUrl ?? YT_URL, YOUTRACK_TOKEN: token },
      timeout: 120_000,
    });
    const app = await admin.appByName(APP_NAME);
    const manifest = JSON.parse(await readFile(path.join(appDir, "manifest.json"), "utf8"));
    if (app.version !== manifest.version) {
      throw new Error(`installed app version ${app.version} != manifest version ${manifest.version}`);
    }
    logger(`deployed ${APP_NAME} ${app.version} into YouTrack (${app.id}) via youtrack-app CLI`);
    return app.id;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/**
 * Creates the whole live fixture through real APIs: groups, users with
 * passwords, memberships, permanent tokens, SPEC project + issue, the app
 * with its bridge settings, and the seeded specs repo. Returns the handles
 * the scenarios need. No mocks anywhere.
 */
export async function bootstrapFixture({ deployApp: shouldDeployApp = true, logger = () => {} } = {}) {
  const admin = createYouTrackAdmin({ login: "admin", password: ADMIN_PASSWORD, logger });
  const me = await admin.me();
  const meNative = await admin.meNative();
  const serviceIds = [await admin.youtrackServiceId(), await admin.hubServiceId()];

  const groupNames = ["spec-alpha", "spec-alpha-readers", "spec-alpha-writers", "spec-alpha-owners", "spec-beta", "spec-beta-writers"];
  const groups = {};
  for (const name of groupNames) {
    groups[name] = await admin.createGroup(name);
  }

  const users = {};
  for (const [userLogin, spec] of Object.entries(USERS)) {
    const user = await admin.createUser({ login: userLogin, password: spec.password, email: `${userLogin}@example.invalid` });
    await admin.banUser(user.id, false); // a failed prior run may leave a user banned
    await admin.setPassword({ userId: user.id, login: userLogin, password: spec.password });
    for (const groupName of spec.groups) {
      await admin.addUserToGroup(groups[groupName].id, user.id);
    }
    // Lifecycle: replace the previous run's token instead of piling up a new one.
    await admin.revokePermanentTokens({ userId: user.id, name: `${userLogin}-e2e` });
    await admin.revokePermanentTokens({ userId: user.id, prefix: `suite-${userLogin}` });
    const token = await admin.createPermanentToken({ userId: user.id, name: `${userLogin}-e2e`, serviceIds });
    users[userLogin] = { id: user.id, login: userLogin, password: spec.password, token: token.token, tokenId: token.id, role: spec.role };
    logger(`provisioned ${userLogin} (${spec.role ?? "no groups"})`);
  }

  await admin.revokePermanentTokens({ userId: me.id, name: "e2e-service" });
  const adminToken = await admin.createPermanentToken({ userId: me.id, name: "e2e-service", serviceIds });

  const project = await admin.createProject({ name: "Spec E2E", shortName: "SPEC", leaderId: meNative.id });
  const hubProjectId = await admin.hubProjectId("SPEC");
  // dave is on the project team (so the widget renders for him) but stays out
  // of every tenant/role group — the service must refuse him, not YouTrack.
  for (const userLogin of ["alice", "bob", "carol", "dave", "erin"]) {
    await admin.addUserToProjectTeam({ hubProjectId, userId: users[userLogin].id });
  }
  logger("project team: alice, bob, carol, dave (dave has no service groups)");
  // The UI-driven BDD suite installs and configures the app through the
  // browser itself; deployApp:false keeps the operator path honest.
  let app = null;
  if (shouldDeployApp) {
    const appId = await deployApp({ admin, token: adminToken.token, logger });
    await admin.setAppSettings(appId, { serviceUrl: "http://spec-registryd:8642", serviceBridgeToken: BRIDGE_TOKEN });
    await admin.attachAppToProject(appId, project.id);
    app = await admin.appById(appId);
  }

  const { YT_URL } = await import("./compose.mjs");
  let issue = null;
  const existingIssues = await fetch(`${YT_URL}/api/issues?query=project:SPEC&fields=id,idReadable`, {
    headers: { authorization: `Basic ${Buffer.from(`admin:${ADMIN_PASSWORD}`).toString("base64")}`, accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  }).then((response) => (response.ok ? response.json() : [])).catch(() => []);
  if (Array.isArray(existingIssues) && existingIssues.length > 0) {
    issue = existingIssues[0];
    logger(`reusing anchor issue ${issue.idReadable}`);
  } else {
    const issueResponse = await fetch(`${YT_URL}/api/issues?fields=id,idReadable`, {
      method: "POST",
      headers: { authorization: `Basic ${Buffer.from(`admin:${ADMIN_PASSWORD}`).toString("base64")}`, "content-type": "application/json" },
      body: JSON.stringify({ project: { id: project.id }, summary: "Auth E2E anchor issue" }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!issueResponse.ok) throw new Error(`issue creation failed: ${issueResponse.status} ${(await issueResponse.text()).slice(0, 200)}`);
    issue = await issueResponse.json();
    logger(`created anchor issue ${issue.idReadable}`);
  }

  await seedSpecsRepo({ logger });

  const config = {
    specsRepo: "git://spec-git/specs.git",
    branch: "main",
    projects: [{ id: "stgmt/alpha" }, { id: "stgmt/beta" }],
    tenants: [
      { tenant: "alpha", projects: ["stgmt/alpha"], hubGroups: ["spec-alpha"], defaultProject: "stgmt/alpha" },
      { tenant: "beta", projects: ["stgmt/beta"], hubGroups: ["spec-beta"], defaultProject: "stgmt/beta" },
    ],
    auth: {
      youtrack: { baseUrl: "http://youtrack:8080", serviceToken: adminToken.token },
      appBridge: { token: BRIDGE_TOKEN },
      roleGroups: { owner: ["spec-alpha-owners"], writer: ["spec-alpha-writers"], reader: ["spec-alpha-readers"] },
    },
  };

  return { admin, serviceIds, groups, users, adminToken: adminToken.token, project, app, issue, config };
}
