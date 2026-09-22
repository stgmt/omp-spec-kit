import path from "node:path";
import { pathToFileURL } from "node:url";
import { GitClient, botIdentityFromEnv, gitAuthFromEnv } from "./git.js";
import { loadProjectsConfig, MountManager } from "./mounts.js";
import { createYouTrackAuth } from "./auth.js";
import { createServiceApp } from "./http.js";
import { createClaimStore } from "./claims.js";
import { createClaimOps, CLAIM_CONTRACTS } from "./ops/claim.js";
import { createRegistryOps, REGISTRY_CONTRACTS } from "./ops/registry.js";
import { createWritePipeline } from "./writepath.js";
import { createStore } from "./ledger.js";
import { buildRegistryIndex } from "./registry.js";
import { computeDrift } from "./drift.js";
import { startSync } from "./sync.js";
import { createOnboarding } from "./onboarding.js";
import { digest } from "../adapters/youtrack-projection.js";
import { createProjection } from "./projection.js";
import { createPublisher } from "./publish.js";
import { createVersionedReads } from "./versioned.js";
import { createRepoManager } from "./repos.js";
import { createIdpManager } from "./idps.js";
import { secretsKeyFromEnv } from "./secrets.js";

export async function bootService({ configPath, cloneDir, git = new GitClient({ gitAuth: gitAuthFromEnv() }), identity, store = null, secretsKey = null, logger = () => {} }) {
  const config = await loadProjectsConfig(configPath);
  const resolvedCloneDir = path.resolve(cloneDir ?? path.join(path.dirname(configPath), "..", "data", "specs-clone"));
  const mounts = new MountManager({ config, cloneDir: resolvedCloneDir, git, identity, store, secretsKey, logger });
  const report = await mounts.boot();
  return { config, mounts, report };
}

export function buildServiceStack({ mounts, config, identity = botIdentityFromEnv(), logger = () => {}, store, secretsKey = null, syncIntervalMs = 0, env = process.env }) {
  const repos = createRepoManager({ mounts, store, config, identity, secretsKey, logger });
  const idpManager = createIdpManager({
    store, config, secretsKey, logger,
    // The IdP binder provisions the tenant's specs repo in the same act — an
    // external project without a repo binding refuses all data operations.
    bindProjectRepo: (input) => repos.bindInternal(input),
    unbindProjectRepo: (project) => repos.unbindInternal(project),
  });
  // IdP-bound tenant projects are configured through their binding, not the
  // operator config — MountManager consults the resolver on every check.
  mounts.extraProjects = () => idpManager.projectScopes();
  const auth = createYouTrackAuth({
    youtrack: {
      baseUrl: env.SPEC_REGISTRY_YT_URL ?? config.auth.youtrack.baseUrl,
      serviceToken: env.SPEC_REGISTRY_YT_SERVICE_TOKEN ?? config.auth.youtrack.serviceToken,
    },
    appBridgeToken: env.SPEC_REGISTRY_APP_BRIDGE_TOKEN ?? config.auth.appBridgeToken,
    tenants: config.tenants,
    roleGroups: config.auth.roleGroups,
    idps: { list: () => idpManager.listActiveIdps() },
    cacheTtlMs: Number(env.SPEC_REGISTRY_AUTH_CACHE_MS ?? 60_000),
    logger,
  });
  const claims = createClaimStore({ store });
  const claimOps = createClaimOps({ claims });
  const registryIndex = () => buildRegistryIndex({ mounts, claims, ledger: store ?? { getLedger: () => [] } });
  const driftReport = async () => {
    // A drift report is only honest against freshly fetched remotes — every
    // mounted repo (default + bound) is fetched and checked.
    const events = [];
    for (const mount of mounts.activeMounts()) {
      await mount.git.fetch({ cwd: mount.cwd }).catch(() => {});
      const report = await computeDrift({ git: mount.git, branch: mount.branch, identity, cwd: mount.cwd }).catch((error) => ({ events: [{ kind: "repo-unreachable", detail: String(error?.message ?? error).split("\n")[0] }] }));
      for (const event of report.events) events.push({ ...event, repo: mount.repoUrl });
    }
    // Publish rejections are drift too: a version squatted by different
    // content must surface next to non-bot commits, not only in access_log.
    const rejections = store?.listAccess?.({ resultPrefix: "publish-rejected:", limit: 50 }) ?? [];
    for (const entry of rejections) {
      events.push({ kind: "publish-rejected", spec: entry.spec, project: entry.project, detail: entry.result, detectedAt: entry.ts });
    }
    return { events, branch: config.branch };
  };
  const registryOps = createRegistryOps({ registryIndex, driftReport });
  const publisher = store ? createPublisher({ mounts, store, identity, logger }) : null;
  // Tracker projection is opt-in: deployments without a YouTrack write target
  // (pure MCP service) leave it off; the demo stack enables it via env.
  const projection = env.SPEC_REGISTRY_PROJECTION === "1" || env.SPEC_REGISTRY_PROJECTION === "true"
    ? createProjection({
        mounts,
        baseUrl: env.SPEC_REGISTRY_YT_URL ?? config.auth.youtrack.baseUrl,
        serviceToken: env.SPEC_REGISTRY_YT_SERVICE_TOKEN ?? config.auth.youtrack.serviceToken,
        projectShortName: env.SPEC_REGISTRY_YT_PROJECT ?? "SPEC",
        markerSecret: env.SPEC_SYNC_MARKER_KEY ?? digest(`projection-marker:${secretsKey ?? "unkeyed"}`),
        logger,
      })
    : null;
  const writePath = createWritePipeline({ mounts, claims, identity, logger, publish: publisher, projection });
  const onboarding = createOnboarding({ config, audit: (entry) => store?.logAccess?.(entry), logger, idps: { list: () => idpManager.listActiveIdps() } });
  const versionedReads = createVersionedReads({ mounts, store });
  let sync = null;
  if (syncIntervalMs > 0) {
    sync = startSync({
      mounts, identity, intervalMs: syncIntervalMs, logger,
      afterReconcile: async () => {
        try {
          await publisher?.publishAll();
        } finally {
          // Publish failure must not suppress projection: an accepted remote
          // move may carry spec edits, and the tracker should never sit
          // behind a break-glass or out-of-band push.
          projection?.syncNow();
        }
      },
    });
  }
  return {
    auth,
    claims,
    sync,
    registryIndex,
    driftReport,
    publisher,
    projection,
    authenticate: (req) => auth.authenticate(req),
    serviceOps: { specClaim: claimOps.specClaim, specRelease: claimOps.specRelease, specRegistry: registryOps.specRegistry, specDrift: registryOps.specDrift },
    serviceContracts: [...CLAIM_CONTRACTS, ...REGISTRY_CONTRACTS],
    wrappers: { specPatch: writePath.specPatch, documents: versionedReads },
    endpoints: {
      registry: () => registryIndex(),
      drift: () => driftReport(),
      onboarding: async (input) => {
        // Bring-your-own specs repo at onboarding: the caller's project is
        // bound to their repository before the agent token is minted, so
        // specs never land in the operator's shared repo by default.
        if (input.repo && typeof input.repo === "object") {
          const project = input.repo.project ?? input.project ?? input.ctx?.defaultScope ?? null;
          if (typeof project !== "string" || project.length === 0) {
            const error = new Error("repo.project or a caller default scope is required to bind a specs repo at onboarding");
            error.status = 400;
            error.code = "REPO_PROJECT_REQUIRED";
            throw error;
          }
          await repos.bind({ ctx: input.ctx, project, repoUrl: input.repo.url, branch: input.repo.branch, token: input.repo.token, username: input.repo.username, migrate: input.repo.migrate });
        }
        return onboarding.issueToken(input);
      },
      me: (ctx) => repos.me(ctx),
      repoBindings: (ctx) => repos.bindings(ctx),
      repoBind: (input) => repos.bind(input),
      repoProbe: (input) => repos.probeAccess(input),
      repoUnbind: (input) => repos.unbind(input),
      idpBindings: (ctx) => idpManager.bindings(ctx),
      idpBind: (input) => idpManager.bind(input),
      idpProbe: (input) => idpManager.probe(input),
      idpUnbind: (input) => idpManager.unbind(input),
    },
    audit: (entry) => store?.logAccess?.(entry),
  };
}

export async function startService({ configPath, cloneDir, storeFile, syncIntervalMs = Number(process.env.SPEC_REGISTRY_SYNC_MS ?? 0), port = Number(process.env.SPEC_REGISTRY_PORT ?? 8642), host = process.env.SPEC_REGISTRY_HOST ?? "127.0.0.1", identity = botIdentityFromEnv(), logger = console.error, env = process.env }) {
  const git = new GitClient({ gitAuth: gitAuthFromEnv(env) });
  const secretsKey = secretsKeyFromEnv(env);
  // The store must exist before mounts: bound projects resolve their clone
  // through repo_bindings during boot reconciliation.
  const resolvedCloneDir = path.resolve(cloneDir ?? path.join(path.dirname(configPath), "..", "data", "specs-clone"));
  const store = await createStore({ file: storeFile ?? env.SPEC_REGISTRY_STORE ?? path.join(path.dirname(resolvedCloneDir), "registry.db") });
  const { config, mounts } = await bootService({ configPath, cloneDir: resolvedCloneDir, git, identity, store, secretsKey, logger });
  const stack = buildServiceStack({ mounts, config, identity, logger, store, secretsKey, syncIntervalMs, env });
  const app = createServiceApp({ mounts, ...stack });
  const server = app.listen(port, host);
  await new Promise((resolve, reject) => {
    server.once("listening", () => {
      logger(`spec-registryd listening on http://${host}:${server.address().port}/mcp`);
      resolve();
    });
    server.once("error", reject);
  });
  // Boot-time publish pass (FR-16-adjacent): commits that landed while the
  // service was down — accepted drift pushes, crashed post-push publishes —
  // still get their ACTIVE specs tagged and ledgered.
  if (stack.publisher) {
    stack.publisher.publishAll()
      .then((results) => {
        for (const result of results) {
          if (result.outcome === "published" || result.outcome === "adopted") logger(`boot publish: ${result.spec}@${result.version}`);
        }
      })
      .catch((error) => logger(`boot publish failed: ${error.message}`));
  }
  // Boot-time projection: covers commits that landed while the service was
  // down AND projectionVersion upgrades — the pointer check makes it a no-op
  // when the committed snapshot is already current.
  stack.projection?.syncNow();
  return { mounts, auth: stack.auth, claims: stack.claims, store, sync: stack.sync, publisher: stack.publisher, projection: stack.projection, driftReport: stack.driftReport, server, port: server.address().port, host };
}

export async function main() {
  const configPath = process.env.SPEC_REGISTRY_CONFIG ?? path.resolve("config/projects.json");
  const cloneDir = process.env.SPEC_REGISTRY_CLONE ?? undefined;
  const storeFile = process.env.SPEC_REGISTRY_STORE ?? undefined;
  const { server } = await startService({ configPath, cloneDir, storeFile });
  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`spec-registryd failed to start: ${error?.message ?? error}`);
    process.exit(1);
  });
}
