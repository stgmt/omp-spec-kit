import { createServer } from "node:http";

/** A local read-only YouTrack protocol stub for hosted service tests. */
export async function startMigrationAuthMock() {
  const calls = [];
  const server = createServer((req, res) => {
    calls.push({ method: req.method, path: req.url });
    if (req.method !== "GET") { res.writeHead(405).end(); return; }
    const url = new URL(req.url, "http://127.0.0.1");
    const bearer = req.headers.authorization;
    let body;
    if (url.pathname === "/hub/api/rest/users/me") {
      const login = bearer === "Bearer owner-token" ? "carol" : bearer === "Bearer writer-token" ? "alice" : null;
      if (login === null) { res.writeHead(401).end(); return; }
      body = { id: login, login, banned: false };
    } else if (url.pathname === "/hub/api/rest/users" && bearer === "Bearer service-token-0123456789") {
      const login = url.searchParams.get("query")?.replace(/^login:/u, "");
      const role = login === "carol" ? "owners" : login === "alice" ? "writers" : null;
      body = { users: role ? [{ id: login, login, name: login, banned: false, transitiveGroups: [{ name: "team" }, { name: role }] }] : [] };
    } else { res.writeHead(404).end(); return; }
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(body));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url, calls, owner: "owner-token", writer: "writer-token",
    config(project, repoUrl) {
      return {
        projects: [{ id: project }], bindings: [{ project, repoUrl }],
        tenants: [{ tenant: "alpha", projects: [project], hubGroups: ["team"], defaultProject: project }],
        auth: {
          youtrack: { baseUrl: url, serviceToken: "service-token-0123456789" },
          appBridge: { token: "bridge-token-0123456789" },
          roleGroups: { owner: ["owners"], writer: ["writers"], reader: ["readers"] },
        },
      };
    },
    async close() {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
