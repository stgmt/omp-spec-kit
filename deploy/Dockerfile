# spec-registryd — centralized spec registry service (FR-15).
# Runtime needs: node 22 (pinned in package.json), git CLI (clone/commit/push),
# and the service source. Config, specs-repo credentials, and the clone/SQLite
# live on a mounted volume — the image itself holds no secrets.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git \
  && rm -rf /var/lib/apt/lists/* \
  # The container is single-purpose and runs as non-root; mounted specs-repo
  # paths are host-owned, so the dubious-ownership check is disabled here.
  && git config --system --add safe.directory '*'

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

# /data holds: config/projects.json (mounted), specs-clone/, registry.db
RUN mkdir -p /data && chown -R node:node /data
USER node

ENV SPEC_REGISTRY_HOST=0.0.0.0 \
    SPEC_REGISTRY_PORT=8642

EXPOSE 8642

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.SPEC_REGISTRY_PORT ?? 8642) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "--experimental-sqlite", "src/service/index.js"]
