const DEFAULT_TTL_MINUTES = 30;
const MAX_TTL_MINUTES = 24 * 60;

function claimKey(project, spec) {
  return `${project}/${spec}`;
}

/**
 * Soft lease store (FR-7): one holder per `project/spec`, TTL expiry with no
 * manual action. Backed by the persistent store when provided (leases survive
 * restart), otherwise by a plain Map.
 */
export function createClaimStore({ store } = {}) {
  const claims = new Map();

  function read(project, spec) {
    if (store) {
      const row = store.getClaim(claimKey(project, spec));
      return row ? { project, spec, holder: row.holder, expiresAtMs: row.expiresAtMs, expiresAt: new Date(row.expiresAtMs).toISOString() } : null;
    }
    return claims.get(claimKey(project, spec)) ?? null;
  }

  function write(record) {
    if (store) {
      store.putClaim({ specKey: claimKey(record.project, record.spec), holder: record.holder, expiresAtMs: record.expiresAtMs, createdAt: new Date().toISOString() });
    } else {
      claims.set(claimKey(record.project, record.spec), record);
    }
  }

  function drop(project, spec) {
    if (store) store.deleteClaim(claimKey(project, spec));
    else claims.delete(claimKey(project, spec));
  }

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
      write(record);
      return { spec, holder, expiresAt: record.expiresAt };
    },

    release({ project, spec, holder }) {
      const existing = this.get(project, spec);
      if (!existing) return { released: false, reason: "NOT_HELD" };
      if (existing.holder !== holder) {
        return { released: false, reason: "CLAIM_HELD", holder: existing.holder, expiresAt: existing.expiresAt };
      }
      drop(project, spec);
      return { released: true };
    },

    get(project, spec) {
      const record = read(project, spec);
      if (!record) return null;
      if (record.expiresAtMs <= Date.now()) {
        drop(project, spec);
        return null;
      }
      return record;
    },

    sweep() {
      if (store) {
        for (const record of store.listClaims()) {
          if (record.expiresAtMs <= Date.now()) store.deleteClaim(record.specKey);
        }
        return store.listClaims().length;
      }
      const now = Date.now();
      for (const [key, record] of claims) {
        if (record.expiresAtMs <= now) claims.delete(key);
      }
      return claims.size;
    },
  };
}
