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
          bash scripts/docker-bdd.sh "$@"
      fi
    fi
  fi
  echo "[docker-bdd] Docker is unavailable on the host and in WSL." >&2
  exit 2
fi

if command -v node >/dev/null 2>&1; then
  NODE_BIN=node
elif command -v node.exe >/dev/null 2>&1; then
  NODE_BIN=node.exe
else
  echo "[docker-bdd] Node.js is required to verify the frozen corpus fixture." >&2
  exit 2
fi
"$NODE_BIN" scripts/refresh-real-corpus-manifest.mjs --check >&2

is_unfiltered_run() {
  [[ "$#" -eq 0 ]]
}

RESULTS_DIR="$ROOT/.omp-spec-kit/evidence/bdd-results"
CANONICAL_RESULT="$ROOT/.omp-spec-kit/evidence/last-test-run.ndjson"
CONTAINER_RESULTS_DIR="/omp-spec-kit-bdd-results"
mkdir -p "$RESULTS_DIR"
HOST_RUN_FILE="$(mktemp "$RESULTS_DIR/run.XXXXXX.ndjson")"
CONTAINER_RUN_FILE="$CONTAINER_RESULTS_DIR/$(basename "$HOST_RUN_FILE")"

IMAGE="omp-spec-kit-bdd:local"
if [[ "${OMP_SPEC_KIT_BDD_MESSAGE_STDOUT:-}" == "1" ]]; then
  docker build --file tests/distribution/Dockerfile --tag "$IMAGE" . >&2
else
  docker build --file tests/distribution/Dockerfile --tag "$IMAGE" . >&2
fi

if ! docker run --rm \
  --mount "type=bind,src=$RESULTS_DIR,dst=$CONTAINER_RESULTS_DIR" \
  --env OMP_SPEC_KIT_BDD_CONTAINER=1 \
  --env OMP_SPEC_KIT_BDD_MESSAGE_STDOUT="${OMP_SPEC_KIT_BDD_MESSAGE_STDOUT:-}" \
  --env OMP_SPEC_KIT_BDD_MESSAGE_PATH="$CONTAINER_RUN_FILE" \
  "$IMAGE" \
  node scripts/run-bdd-container.mjs "$@"; then
  echo "[docker-bdd] BDD failed; preserving canonical evidence." >&2
  exit 1
fi

if ! is_unfiltered_run "$@"; then
  echo "[docker-bdd] Filtered run completed; canonical evidence was not updated." >&2
  exit 0
fi

if ! docker run --rm \
  --mount "type=bind,src=$RESULTS_DIR,dst=$CONTAINER_RESULTS_DIR,readonly" \
  "$IMAGE" \
  node --input-type=module -e '
  import { readFileSync } from "node:fs";

  const path = process.argv[1];
  const bytes = readFileSync(path);
  if (bytes.length === 0) throw new Error("result file is empty");

  const required = new Set([
    "meta",
    "source",
    "gherkinDocument",
    "pickle",
    "testRunStarted",
    "testCaseStarted",
    "testStepFinished",
    "testCaseFinished",
    "testRunFinished",
  ]);
  const envelopeKinds = new Set([
    ...required,
    "attachment",
    "hook",
    "parameterType",
    "parseError",
    "stepDefinition",
    "testCase",
    "testStepStarted",
    "undefinedParameterType",
  ]);
  const seen = new Set();
  for (const [index, line] of bytes.toString("utf8").split(/\r?\n/).entries()) {
    if (!line) continue;
    let frame;
    try {
      frame = JSON.parse(line);
    } catch {
      throw new Error(`line ${index + 1} is not JSON`);
    }
    if (!frame || Array.isArray(frame) || typeof frame !== "object") {
      throw new Error(`line ${index + 1} is not a message envelope`);
    }
    const kinds = Object.keys(frame).filter((key) => envelopeKinds.has(key));
    if (kinds.length !== 1) {
      throw new Error(`line ${index + 1} is not a recognized Cucumber Message envelope`);
    }
    seen.add(kinds[0]);
  }
  const missing = [...required].filter((kind) => !seen.has(kind));
  if (missing.length > 0) {
    throw new Error(`result file is missing required message types: ${missing.join(", ")}`);
  }
' "$CONTAINER_RUN_FILE"; then
  echo "[docker-bdd] Result artifact is malformed; preserving canonical evidence." >&2
  exit 2
fi

mv -f "$HOST_RUN_FILE" "$CANONICAL_RESULT"
echo "[docker-bdd] Published canonical Cucumber Messages: $CANONICAL_RESULT" >&2
