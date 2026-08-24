FROM node:22-bookworm-slim

WORKDIR /workspace
ENV CI=1

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY . .
RUN node scripts/build-plugin.mjs \
 && node scripts/verify-marketplace.mjs \
 && node scripts/verify-package.mjs

ENV OMP_SPEC_KIT_BDD_CONTAINER=1
CMD ["node", "scripts/run-bdd-container.mjs"]
