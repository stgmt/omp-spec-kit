#!/usr/bin/env node
/**
 * Run the tool E2E against the live auth contour (`spec-auth-e2e`).
 *
 * `tests/e2e/run-live.mjs --bootstrap-only` must have brought the stack up.
 * A writer token is minted through the same fixture helper the service suite
 * uses, so this is a real verified YouTrack identity, not a test stub.
 */
import { loadLiveFixture } from "../tests/e2e/lib/live-fixture.mjs";
import { SERVICE_URL } from "../tests/e2e/lib/compose.mjs";
import { runToolE2e } from "./tool-e2e.mjs";

const fixture = await loadLiveFixture();
const user = process.env.OMP_SPEC_E2E_USER ?? "alice";
const project = process.env.OMP_SPEC_E2E_PROJECT ?? "stgmt/alpha";
const token = await fixture.userToken(user);
const result = await runToolE2e({ url: `${SERVICE_URL.replace(/\/+$/u, "")}/mcp`, token, project });
console.log(JSON.stringify(result, null, 2));
