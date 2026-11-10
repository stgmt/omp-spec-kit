/**
 * Cheap "did the remote move?" probe (FR-10).
 *
 * A reconcile that fetches every mounted mirror pays for a git process, a TLS
 * handshake and a ref negotiation per repository per cycle, plus one
 * `git show` per spec branch to read `.spec-kit.json`. None of that is needed
 * when the remote's `spec-*` tips still equal the mirror's: nothing can have
 * changed. One HTTPS GET against the GitHub refs API on a keep-alive socket
 * answers that question in milliseconds, and the expensive path only runs
 * when the answer is "moved".
 */
import https from "node:https";

/**
 * One socket pool for every probe: a fresh TLS handshake per cycle would
 * bring back most of the cost this module exists to remove.
 */
const KEEP_ALIVE_AGENT = new https.Agent({ keepAlive: true, keepAliveMsecs: 1_000, maxSockets: 4 });

/** `https://github.com/<owner>/<repo>[.git]` → `{ owner, repo }`, else null. */
export function parseGitHubRepo(repoUrl) {
  let parsed;
  try {
    parsed = new URL(repoUrl);
  } catch {
    return null;
  }
  if (parsed.hostname !== "github.com") return null;
  const match = /^\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/u.exec(parsed.pathname);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

/** Stable signature of a `branch → sha` map, so two sides compare in one string. */
export function refsSignature(refs) {
  return [...refs.entries()]
    .map(([branch, sha]) => `${branch} ${sha}`)
    .sort()
    .join("\n");
}

export function sameRefs(left, right) {
  return refsSignature(left) === refsSignature(right);
}

function httpsJson(url, { token, timeoutMs = 8_000 } = {}) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "GET",
        agent: KEEP_ALIVE_AGENT,
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
          "user-agent": "spec-registryd",
          "x-github-api-version": "2022-11-28",
        },
        timeout: timeoutMs,
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (response.statusCode !== 200) {
            reject(new Error(`GitHub refs API answered ${response.statusCode}: ${body.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`GitHub refs API returned malformed JSON: ${error.message}`));
          }
        });
        response.on("error", reject);
      },
    );
    request.on("timeout", () => request.destroy(new Error(`GitHub refs API timed out after ${timeoutMs}ms`)));
    request.on("error", reject);
    request.end();
  });
}

/**
 * `probe(repoUrl, auth)` resolves to `{ supported: false, reason }` whenever the
 * cheap answer is unavailable (not GitHub, no credential, API error, rate
 * limit) — the caller must then take the ordinary fetch path, never treat an
 * unavailable probe as "unchanged".
 */
export function createRemoteRefsProbe({ logger = () => {}, request = httpsJson, refPrefix = "heads/spec-" } = {}) {
  return {
    async probe(repoUrl, auth) {
      const target = parseGitHubRepo(repoUrl);
      if (!target) return { supported: false, reason: "not-github" };
      if (!auth || typeof auth.token !== "string" || auth.token.length === 0) {
        return { supported: false, reason: "no-credential" };
      }
      const url = `https://api.github.com/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/git/matching-refs/${refPrefix}`;
      try {
        const payload = await request(url, { token: auth.token });
        if (!Array.isArray(payload)) return { supported: false, reason: "unexpected-payload" };
        const refs = new Map();
        for (const entry of payload) {
          if (typeof entry?.ref !== "string" || typeof entry?.object?.sha !== "string") continue;
          // The mirror stores remote-tracking refs; compare on branch names so
          // both sides speak the same key space.
          refs.set(entry.ref.replace(/^refs\/heads\//u, ""), entry.object.sha);
        }
        return { supported: true, refs };
      } catch (error) {
        logger(`refs probe failed for ${repoUrl}: ${String(error?.message ?? error).split("\n")[0]}`);
        return { supported: false, reason: "probe-failed" };
      }
    },
  };
}
