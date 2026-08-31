FROM oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 AS pinned-bun

FROM node:22-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436

COPY --from=pinned-bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /workspace
ENV CI=1

COPY package.json package-lock.json cucumber.mjs LICENSE README.md CHANGELOG.md ./
COPY tests/fixtures/omp-discovery-runtime/package.json tests/fixtures/omp-discovery-runtime/bun.lock ./tests/fixtures/omp-discovery-runtime/
RUN npm ci --ignore-scripts --no-audit --no-fund \
 && cd tests/fixtures/omp-discovery-runtime \
 && bun install --frozen-lockfile --ignore-scripts --no-progress

COPY .omp-plugin/ .omp-plugin/
COPY .specs/ .specs/
COPY docs/validation/omp-discovery-v18.0.10.md docs/validation/omp-discovery-v18.0.10.md
COPY docs/validation/release-status-v0.3.2.json docs/validation/release-status-v0.3.2.json
COPY docs/advisories/v0.3.0-mcp-root.md docs/advisories/v0.3.0-mcp-root.md
COPY plugins/ plugins/
COPY scripts/ scripts/
COPY src/ src/
COPY tests/ tests/
RUN node scripts/build-plugin.mjs \
 && node scripts/verify-marketplace.mjs \
 && node scripts/verify-package.mjs \
 && cp scripts/probe-omp-discovery-v18.0.10.mjs tests/fixtures/omp-discovery-runtime/probe-omp-discovery-v18.0.10.mjs

ENV OMP_SPEC_KIT_BDD_CONTAINER=1
CMD ["node", "scripts/run-bdd-container.mjs"]
