#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ -z "${GITHUB_ACTIONS:-}" && -z "${DOCKER_HOST:-}" ]]; then
  export DOCKER_HOST="tcp://127.0.0.1:2375"
fi

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  if [[ -z "${OMP_SPEC_KIT_WSL_SHIM:-}" ]] && command -v wsl.exe >/dev/null 2>&1; then
    if wsl.exe -e bash -lc "DOCKER_HOST='${DOCKER_HOST}' docker info >/dev/null"; then
      WIN_ROOT="$(pwd -W 2>/dev/null || true)"
      if [[ "$WIN_ROOT" =~ ^[A-Za-z]:/ ]]; then
        echo "[docker-bdd] Docker unavailable on host; re-executing inside WSL."
        exec wsl.exe --cd "$WIN_ROOT" -e env \
          OMP_SPEC_KIT_WSL_SHIM=1 \
          OMP_SPEC_KIT_BDD_MESSAGE_STDOUT="${OMP_SPEC_KIT_BDD_MESSAGE_STDOUT:-}" \
          DOCKER_HOST="$DOCKER_HOST" \
          bash scripts/docker-bdd.sh
      fi
    fi
  fi
  echo "[docker-bdd] Docker is unavailable on the host and in WSL." >&2
  exit 2
fi

IMAGE="omp-spec-kit-bdd:local"
if [[ "${OMP_SPEC_KIT_BDD_MESSAGE_STDOUT:-}" == "1" ]]; then
  docker build --file tests/distribution/Dockerfile --tag "$IMAGE" . >&2
else
  docker build --file tests/distribution/Dockerfile --tag "$IMAGE" .
fi
docker run --rm \
  --env OMP_SPEC_KIT_BDD_CONTAINER=1 \
  --env OMP_SPEC_KIT_BDD_MESSAGE_STDOUT="${OMP_SPEC_KIT_BDD_MESSAGE_STDOUT:-}" \
  "$IMAGE"
