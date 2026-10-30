import net from "node:net";

export async function findAvailablePort({ preferred, probe, expectedFingerprint = null, maxAttempts = 50 }) {
  if (!Number.isInteger(preferred) || preferred <= 0) {
    throw new TypeError(`preferred port must be a positive integer, got ${preferred}`);
  }
  const skipped = [];
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = preferred + offset;
    const result = await probe(port);
    if (result?.status === "free") {
      return { port, outcome: "allocated", skipped };
    }
    if (result?.status === "responded") {
      if (expectedFingerprint !== null && result.fingerprint === expectedFingerprint) {
        return { port, outcome: "reattached", skipped };
      }
      skipped.push({ port, reason: "foreign-service" });
      continue;
    }
    skipped.push({ port, reason: "busy" });
  }
  throw new Error(`no free port found scanning ${preferred}..${preferred + maxAttempts - 1} — every candidate was busy or served a foreign service`);
}

export function tcpProbe({ host = "127.0.0.1", timeoutMs = 1500 } = {}) {
  return async (port) => {
    const open = await new Promise((resolve) => {
      const socket = net.createConnection({ port, host });
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, timeoutMs);
      socket.once("connect", () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
    if (!open) return { status: "free" };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(`http://${host}:${port}/health`, { signal: controller.signal });
      clearTimeout(timer);
      if (response.ok) {
        const body = await response.json().catch(() => ({}));
        if (typeof body?.service === "string") {
          return { status: "responded", service: body.service, fingerprint: body.fingerprint ?? null };
        }
      }
      return { status: "busy" };
    } catch {
      return { status: "busy" };
    }
  };
}
