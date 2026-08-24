# Use Cases

## UC-1: Fresh project-scoped MCP discovery

**Stories:** User Story 1, User Story 4.

1. A user creates project-a with real `.specs` content and installs the v0.3.1 package at project scope.
2. OMP starts a fresh session from project-a and discovers the package `.mcp.json`.
3. The package-relative launcher finds `dist/mcp/server.js`; omitted `cwd` lets OMP pass project-a as the process cwd.
4. The client calls each read-only MCP tool.
5. Every answer is built from project-a; no package or second-project data appears.

## UC-2: Invalid protocol request receives one answer

**Stories:** User Story 2.

1. A client sends a newline-delimited JSON-RPC request with version `1.0` and id `7`.
2. The server classifies it as an invalid request before dispatch.
3. The server writes exactly one `-32600` response with id `7`.
4. The client can continue using the same process for a subsequent valid request.

## UC-3: All-eight tool parity from an installed package

**Stories:** User Story 1, User Story 3.

1. Test setup builds the plugin once and copies only the allowlisted payload to an isolated package location.
2. A real server process starts through the installed package launcher.
3. The test calls all eight SCHEMA-11 tools with valid request matrices.
4. Each structured result deep-equals the shared query-service result over the same manifest-verified corpus.
5. Snapshot comparisons prove the served corpus remains byte-for-byte unchanged.

## UC-4: Candidate release upgrade and rollback

**Stories:** User Story 3.

1. A clean project starts from the publicly released v0.3.0 tagged source proof.
2. It refreshes the catalog, upgrades to v0.3.1, reloads plugin metadata, and starts a fresh OMP session.
3. The observed installed version is v0.3.1 and non-OMP project hashes equal their baseline.
4. It explicitly reinstalls v0.3.0, reloads, and starts another fresh session.
5. The observed version is v0.3.0, hashes remain equal, and both receipts bind to the candidate/tag identities.

## UC-5: Safe release publication and recovery information

**Stories:** User Story 3, User Story 4.

1. Verify creates one candidate archive, manifest, digests, public-safety report, Docker BDD receipt, and lifecycle receipts.
2. Publish downloads that candidate rather than rebuilding it.
3. It rejects a mismatched tag, archive, receipt, or existing release asset.
4. After success, generated v0.3.1 notes and README describe verified behavior.
5. v0.3.0’s release remains available with a reversible advisory, never a history rewrite.
