import { assertHostReachableUrl } from "../service/endpoint-url.js";

const FILE_REF = /\$\{file:([^}]+)\}/;

function authToken(header, secrets = {}) {
  const value = String(header ?? "");
  const file = FILE_REF.exec(value);
  if (file) return secrets[file[1]] ?? null;
  const bearer = /^Bearer\s+(.+)$/i.exec(value);
  return bearer ? bearer[1] : value || null;
}

function entryStatus(observation, manifest) {
  if (observation.status === 0 || observation.status === undefined) return "unreachable";
  if (
    observation.fingerprint != null &&
    manifest?.fingerprint != null &&
    observation.fingerprint !== manifest.fingerprint
  ) {
    return "wrong-instance";
  }
  if (observation.status === 401 || observation.status === 403) return "unauthorized";
  if (observation.ok) {
    if (manifest?.fingerprint != null && observation.fingerprint != null) return "ok";
    return "ok";
  }
  return "unreachable";
}

export async function diagnoseMcpConfig({ configText, probe, manifest = null, secrets = {} }) {
  const config = JSON.parse(configText);
  const entries = [];
  for (const [server, def] of Object.entries(config?.mcpServers ?? {})) {
    const url = def?.url ?? null;
    if (typeof url !== "string" || url.length === 0) {
      entries.push({ server, url, status: "unreachable" });
      continue;
    }
    const observation = await probe(url, authToken(def?.headers?.Authorization, secrets));
    entries.push({ server, url, status: entryStatus(observation ?? {}, manifest), fingerprint: observation?.fingerprint ?? null });
  }
  return { entries };
}

export async function repairMcpConfig({ configText, manifest, probe, secrets = {}, tokenProvider, dryRun = false }) {
  if (manifest == null) {
    throw new Error("cannot repair without a runtime manifest — the live host URL would be a guess");
  }
  assertHostReachableUrl(manifest.hostUrl);

  const config = JSON.parse(configText);
  const changed = [];
  const report = [];
  const secretsWritten = {};
  const targetUrl = `${String(manifest.hostUrl).replace(/\/+$/u, "")}/mcp`;

  for (const [server, def] of Object.entries(config?.mcpServers ?? {})) {
    const url = def?.url ?? null;
    if (typeof url !== "string" || url.length === 0) continue;
    const header = def?.headers?.Authorization;
    const observation = await probe(url, authToken(header, secrets));
    const status = entryStatus(observation ?? {}, manifest);
    report.push({ server, url, status, fingerprint: observation?.fingerprint ?? null });
    if (status === "ok") continue;

    changed.push(server);
    if (dryRun) continue;

    const token = await tokenProvider({ server });
    if (status !== "unauthorized") {
      def.url = targetUrl;
    }
    const file = FILE_REF.exec(String(header ?? ""));
    if (file) {
      secretsWritten[file[1]] = token;
    } else {
      def.headers = { ...(def.headers ?? {}), Authorization: `Bearer ${token}` };
    }
  }

  return {
    configText: dryRun || changed.length === 0 ? configText : `${JSON.stringify(config, null, 2)}\n`,
    changed,
    report,
    secretsWritten,
  };
}
