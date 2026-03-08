#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/sato-app"

if [[ ! -f "$BACKEND_DIR/app.py" ]]; then
  echo "Missing backend/app.py" >&2
  exit 1
fi

if [[ ! -f "$FRONTEND_DIR/package.json" ]]; then
  echo "Missing sato-app/package.json" >&2
  exit 1
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "Frontend dependencies are missing. Run 'cd sato-app && npm install' first." >&2
  exit 1
fi

if [[ -x "$BACKEND_DIR/.venv/bin/python" ]]; then
  BACKEND_PYTHON="$BACKEND_DIR/.venv/bin/python"
elif [[ -x "$BACKEND_DIR/myenv/bin/python" ]]; then
  BACKEND_PYTHON="$BACKEND_DIR/myenv/bin/python"
else
  BACKEND_PYTHON="${PYTHON:-python3}"
fi

run_step() {
  local label="$1"
  shift

  echo
  echo "==> $label"
  "$@"
}

run_step \
  "Python syntax check" \
  "$BACKEND_PYTHON" -m py_compile \
  "$BACKEND_DIR/app.py" \
  "$BACKEND_DIR/blend_service.py" \
  "$BACKEND_DIR/spotify_client.py" \
  "$BACKEND_DIR/room_store.py" \
  "$BACKEND_DIR/debug_tools.py" \
  "$BACKEND_DIR/e2e_support.py" \
  "$BACKEND_DIR/tests/test_api.py" \
  "$BACKEND_DIR/tests/test_spotify_client.py"

run_step \
  "Backend test suite" \
  "$BACKEND_PYTHON" -m pytest \
  "$BACKEND_DIR/tests/test_api.py" \
  "$BACKEND_DIR/tests/test_spotify_client.py"

run_step \
  "Frontend unit tests" \
  npm --prefix "$FRONTEND_DIR" test -- --run

run_step \
  "Frontend build" \
  npm --prefix "$FRONTEND_DIR" run build

run_step \
  "Browser end-to-end tests" \
  npm --prefix "$FRONTEND_DIR" run test:e2e

echo
echo "All Sato verification checks passed."
