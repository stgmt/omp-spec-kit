import { inspectLinkTypes, provisionLinkTypes } from "../adapters/youtrack-links.js";
import { inspectProjectSchema, provisionProjectSchema } from "../adapters/youtrack-schema.js";
import { YouTrackClient } from "../adapters/youtrack-store.js";

/**
 * The tracker is a projection target, not an optional decoration: a card needs
 * the schema fields and its edges need the link types. Both contracts live in
 * src/adapters (youtrack-schema.js, youtrack-links.js) and are shared with the
 * manual sync script; this module only orchestrates them and keeps the last
 * known state for preflight.
 *
 * Rules: never delete, never retype an existing field, never touch workflows or
 * other projects, and report a conflict instead of guessing.
 */

const AUTHORIZATION_PATTERN = /=>\s*(401|403)\b/u;

function classify(error) {
  const message = String(error?.message ?? error);
  if (/rerun with --migrate/u.test(message)) return "TRACKER_FIELD_CONFLICT";
  if (AUTHORIZATION_PATTERN.test(message)) return "TRACKER_NOT_AUTHORIZED";
  if (/=>\s*404\b/u.test(message)) return "TRACKER_PROJECT_MISSING";
  return "TRACKER_UNAVAILABLE";
}

function emptyState(project, extra = {}) {
  return {
    code: "TRACKER_UNAVAILABLE",
    project,
    projectId: null,
    missing: [],
    missingLinkTypes: [],
    conflicts: [],
    created: [],
    attached: [],
    enumValuesAdded: [],
    linkTypesCreated: [],
    ...extra,
  };
}

/** Read-only: report what the projection needs and what is missing. */
export async function checkTrackerSchema({ client, projectShortName }) {
  try {
    const schema = await inspectProjectSchema({ client, projectShortName });
    const links = await inspectLinkTypes(client);
    const code =
      schema.conflicts.length > 0 || links.conflicts.length > 0
        ? "TRACKER_FIELD_CONFLICT"
        : schema.missing.length > 0 || links.missing.length > 0 || schema.enumValuesMissing.length > 0
          ? "TRACKER_FIELDS_MISSING"
          : "TRACKER_READY";
    return emptyState(projectShortName, {
      code,
      projectId: schema.project.id,
      missing: schema.missing,
      missingLinkTypes: links.missing,
      enumValuesMissing: schema.enumValuesMissing,
      conflicts: [...schema.conflicts, ...links.conflicts],
    });
  } catch (error) {
    return emptyState(projectShortName, {
      code: classify(error),
      message: String(error?.message ?? error).slice(0, 300),
    });
  }
}

/**
 * Idempotent repair: fields, their bundles and the directed link types.
 * A refusal in one half must not stop the other — the final verification
 * reports both and the operator decides.
 */
export async function repairTrackerSchema({ client, projectShortName, log = () => {} }) {
  const created = [];
  const attached = [];
  const enumValuesAdded = [];
  const linkTypesCreated = [];
  const messages = [];
  try {
    try {
      linkTypesCreated.push(...(await provisionLinkTypes(client, { log })).created);
    } catch (error) {
      messages.push(String(error?.message ?? error).slice(0, 300));
    }

    try {
      const schema = await provisionProjectSchema({ client, projectShortName, log });
      created.push(...schema.created);
      attached.push(...schema.attached);
      enumValuesAdded.push(...schema.enumValuesAdded);
    } catch (error) {
      messages.push(String(error?.message ?? error).slice(0, 300));
    }
  } catch (error) {
    return emptyState(projectShortName, {
      code: classify(error),
      message: String(error?.message ?? error).slice(0, 300),
    });
  }
  const verified = await checkTrackerSchema({ client, projectShortName });
  const merged = new Map();
  for (const conflict of verified.conflicts) merged.set(conflict.field ?? conflict.linkType, conflict);
  return {
    ...verified,
    code: verified.code,
    conflicts: [...merged.values()],
    created,
    attached,
    enumValuesAdded,
    linkTypesCreated,
    message: messages.length > 0 ? messages.join(" | ") : null,
  };
}

/**
 * One provisioner per service: keeps the last known state so preflight does not
 * hammer the tracker, and exposes the boot promise so the first projection can
 * wait for the schema instead of racing it.
 */
export function createTrackerProvisioner({ baseUrl, token, projectShortName, enabled = true, log = () => {} }) {
  let client = baseUrl && token ? new YouTrackClient({ host: baseUrl, token }) : null;
  let state = null;
  return {
    /** Replace the transport (tests inject a fake; the service passes the real one). */
    useClient(next) {
      client = next;
      return this;
    },
    lastState() {
      return state;
    },
    async check() {
      if (!client?.get) {
        state = emptyState(projectShortName, { message: "no tracker credentials configured" });
        return state;
      }
      state = await checkTrackerSchema({ client, projectShortName });
      return state;
    },
    async ensure() {
      // `enabled: false` means "the operator prepares the tracker themselves":
      // the state is still read, only the repair is skipped.
      if (!enabled) return this.check();
      if (!client?.get) return this.check();
      state = await repairTrackerSchema({ client, projectShortName, log });
      log(JSON.stringify({
        op: "tracker-provision",
        project: projectShortName,
        code: state.code,
        created: state.created.length,
        attached: state.attached.length,
        linkTypesCreated: state.linkTypesCreated.length,
        conflicts: state.conflicts.length,
      }));
      return state;
    },
  };
}
