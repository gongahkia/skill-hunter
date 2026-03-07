#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/sato-app"

BACKEND_PID=""

cleanup() {
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" 2>/dev/null || true
    wait "${BACKEND_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

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

echo "Starting backend with $BACKEND_PYTHON"
(
  cd "$BACKEND_DIR"
  exec "$BACKEND_PYTHON" app.py
) &
BACKEND_PID=$!

sleep 1

if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  echo "Backend failed to start." >&2
  wait "$BACKEND_PID"
fi

echo "Starting frontend with npm run dev"
cd "$FRONTEND_DIR"
exec npm run dev
