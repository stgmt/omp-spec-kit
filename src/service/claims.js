const DEFAULT_TTL_MINUTES = 30;
const MAX_TTL_MINUTES = 24 * 60;

function claimKey(project, spec) {
  return `${project}/${spec}`;
}

/**
 * Soft lease store (FR-7): one holder per `project/spec`, TTL expiry with no
 * manual action. Backed by a plain Map in phase 1; TASK-6 moves the same
 * interface onto the persistent store so leases survive restart.
 */
export function createClaimStore() {
  const claims = new Map();

  return {
    claim({ project, spec, holder, ttlMinutes = DEFAULT_TTL_MINUTES }) {
      const ttl = Number.isSafeInteger(ttlMinutes) && ttlMinutes >= 1 && ttlMinutes <= MAX_TTL_MINUTES ? ttlMinutes : DEFAULT_TTL_MINUTES;
      const existing = this.get(project, spec);
      if (existing && existing.holder !== holder) {
        const error = new Error(`spec is claimed by ${existing.holder}`);
        error.code = "CLAIM_HELD";
        error.holder = existing.holder;
        error.expiresAt = existing.expiresAt;
        throw error;
      }
      const expiresAtMs = Date.now() + ttl * 60_000;
      const record = { project, spec, holder, expiresAtMs, expiresAt: new Date(expiresAtMs).toISOString() };
      claims.set(claimKey(project, spec), record);
      return { spec, holder, expiresAt: record.expiresAt };
    },

    release({ project, spec, holder }) {
      const existing = this.get(project, spec);
      if (!existing) return { released: false, reason: "NOT_HELD" };
      if (existing.holder !== holder) {
        return { released: false, reason: "CLAIM_HELD", holder: existing.holder, expiresAt: existing.expiresAt };
      }
      claims.delete(claimKey(project, spec));
      return { released: true };
    },

    get(project, spec) {
      const record = claims.get(claimKey(project, spec));
      if (!record) return null;
      if (record.expiresAtMs <= Date.now()) {
        claims.delete(claimKey(project, spec));
        return null;
      }
      return record;
    },

    sweep() {
      const now = Date.now();
      for (const [key, record] of claims) {
        if (record.expiresAtMs <= now) claims.delete(key);
      }
      return claims.size;
    },
  };
}
