const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function isInternalHostname(hostname) {
  const host = String(hostname ?? "").toLowerCase();
  if (LOOPBACK_HOSTS.has(host)) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
  return !host.includes(".");
}

export function assertHostReachableUrl(serviceUrl) {
  const url = String(serviceUrl ?? "");
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new TypeError(`service URL ${url} is not parseable — cannot prove it is host-reachable`);
  }
  if (isInternalHostname(parsed.hostname)) {
    throw new TypeError(
      `service URL ${url} uses the network-internal name "${parsed.hostname}" — unreachable from a host-side client; pass the loopback or DNS endpoint instead`,
    );
  }
  return url;
}
